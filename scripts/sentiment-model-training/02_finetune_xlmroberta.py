"""
================================================================
02_finetune_xlmroberta.py — Phase 3.1
XLM-RoBERTa Fine-Tuning + Hyperparameter Tuning + LoRA (PEFT)
================================================================

✅ Base model: FacebookAI/xlm-roberta-base (or large)
✅ Supports LoRA / QLoRA for GPU-memory-efficient fine-tuning
✅ Random hyperparameter search over LR, rank, weight_decay, warmup
✅ Early stopping + best model selection by macro F1-score
✅ FP16 mixed precision + gradient accumulation
✅ Full training logs + config + best checkpoints saved
✅ Automatic detection of GPU (CUDA / MPS / CPU)
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from datasets import Dataset, DatasetDict
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from tqdm.auto import tqdm

# ------------------------------
# PATHS
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "outputs"
LOG_DIR = BASE_DIR / "logs"
for d in (DATA_DIR, OUT_DIR, LOG_DIR):
    d.mkdir(parents=True, exist_ok=True)

LABELS = ["positive", "negative", "distress"]
LABEL2IDX = {l: i for i, l in enumerate(LABELS)}
IDX2LABEL = {i: l for l, i in LABEL2IDX.items()}
RANDOM_SEED = 42


# ------------------------------
# CONFIG / HYPERPARAMETER SPACE
# ------------------------------
@dataclass
class TrainConfig:
    base_model: str = "FacebookAI/xlm-roberta-base"  # or "xlm-roberta-large"
    max_seq_len: int = 256

    # LoRA / PEFT
    use_lora: bool = True
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05

    # Training
    learning_rate: float = 3e-5
    num_train_epochs: int = 6
    per_device_train_batch_size: int = 16
    per_device_eval_batch_size: int = 32
    gradient_accumulation_steps: int = 1
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
    fp16: bool = True  # auto-disabled on CPU
    early_stopping_patience: int = 4

    # HP search
    hp_trials: int = 1  # >1 = random search
    output_dir: str = str(OUT_DIR / "best_model")

    def to_dict(self) -> dict:
        return asdict(self)


HP_RANDOM_SPACE = {
    "learning_rate": [1e-5, 2e-5, 3e-5, 5e-5, 8e-5],
    "lora_r": [8, 16, 32],
    "lora_alpha": [16, 32, 64],
    "warmup_ratio": [0.05, 0.1, 0.2],
    "weight_decay": [0.0, 0.01, 0.05],
}


# ------------------------------
# TOKENIZATION
# ------------------------------
def tokenize_dataset(dataset: DatasetDict, tokenizer, max_seq_len: int) -> DatasetDict:
    def _tok(batch):
        return tokenizer(
            [str(t) for t in batch["text"]],
            truncation=True,
            padding="max_length",
            max_length=max_seq_len,
        )
    return dataset.map(_tok, batched=True, num_proc=1)


# ------------------------------
# LOAD DATA
# ------------------------------
def load_splits() -> DatasetDict:
    splits = {}
    for split in ("train", "val", "test"):
        p = DATA_DIR / f"{split}.csv"
        if not p.exists():
            raise FileNotFoundError(
                f"Missing {p}. Run 01_prepare_dataset.py first!"
            )
        df = pd.read_csv(p)
        df["label"] = df["label"].map(LABEL2IDX).astype(int)
        splits[split] = Dataset.from_pandas(df)
    return DatasetDict(splits)


# ------------------------------
# METRICS COMPUTATION
# ------------------------------
def compute_metrics(eval_pred: Any) -> dict:
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": float(accuracy_score(labels, preds)),
        "precision_macro": float(precision_score(labels, preds, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(labels, preds, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(labels, preds, average="macro", zero_division=0)),
        "f1_weighted": float(f1_score(labels, preds, average="weighted", zero_division=0)),
        **{
            f"f1_{l}": float(f1_score(labels, preds, labels=[LABEL2IDX[l]], average="macro", zero_division=0))
            for l in LABELS
        },
    }


# ------------------------------
# MODEL BUILDER
# ------------------------------
def build_model_and_tokenizer(cfg: TrainConfig):
    from transformers import (
        AutoTokenizer,
        AutoModelForSequenceClassification,
        EarlyStoppingCallback,
        TrainingArguments,
        Trainer,
        set_seed,
    )
    from peft import LoraConfig, get_peft_model, TaskType

    set_seed(RANDOM_SEED)

    # ---- Device / mixed precision ----
    use_cuda = torch.cuda.is_available()
    use_mps = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
    fp16_flag = cfg.fp16 and use_cuda
    if use_cuda:
        print(f"[DEVICE] Using CUDA: {torch.cuda.get_device_name(0)}")
    elif use_mps:
        print("[DEVICE] Using Apple MPS GPU")
    else:
        print("[DEVICE] Using CPU (this will be slow!)")

    # ---- Tokenizer ----
    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model, use_fast=True)

    # ---- Model ----
    model = AutoModelForSequenceClassification.from_pretrained(
        cfg.base_model,
        num_labels=len(LABELS),
        id2label=IDX2LABEL,
        label2id=LABEL2IDX,
    )

    # ---- LoRA / PEFT ----
    if cfg.use_lora:
        # For XLM-R, we target the query/value matrices in attention
        try:
            target_modules = ["q_proj", "v_proj"]
            lora_cfg = LoraConfig(
                r=cfg.lora_r,
                lora_alpha=cfg.lora_alpha,
                target_modules=target_modules,
                lora_dropout=cfg.lora_dropout,
                bias="none",
                task_type=TaskType.SEQ_CLS,
            )
            model = get_peft_model(model, lora_cfg)
            model.print_trainable_parameters()
        except Exception as e:
            print(f"[WARN] Failed to apply LoRA (will continue full FT): {e}")

    return tokenizer, model, fp16_flag


# ------------------------------
# TRAINER RUN (single HP trial)
# ------------------------------
def run_trial(cfg: TrainConfig, tokenized_ds: DatasetDict, trial_idx: int) -> dict:
    from transformers import (
        TrainingArguments,
        Trainer,
        EarlyStoppingCallback,
    )

    out_dir = Path(cfg.output_dir)
    trial_out = OUT_DIR / f"trial_{trial_idx:02d}"
    trial_out.mkdir(parents=True, exist_ok=True)

    tokenizer, model, fp16_flag = build_model_and_tokenizer(cfg)

    args = TrainingArguments(
        output_dir=str(trial_out),
        run_name=f"trial_{trial_idx}",
        learning_rate=cfg.learning_rate,
        per_device_train_batch_size=cfg.per_device_train_batch_size,
        per_device_eval_batch_size=cfg.per_device_eval_batch_size,
        gradient_accumulation_steps=cfg.gradient_accumulation_steps,
        num_train_epochs=cfg.num_train_epochs,
        warmup_ratio=cfg.warmup_ratio,
        weight_decay=cfg.weight_decay,
        fp16=fp16_flag,
        logging_dir=str(LOG_DIR),
        logging_strategy="steps",
        logging_steps=20,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_f1_macro",
        greater_is_better=True,
        seed=RANDOM_SEED,
        data_seed=RANDOM_SEED,
        report_to=[],  # Disable wandb by default
        push_to_hub=False,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=tokenized_ds["train"],
        eval_dataset=tokenized_ds["val"],
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=cfg.early_stopping_patience)],
    )

    # Train
    trainer.train()

    # Best eval metrics
    best_checkpoint = trainer.state.best_model_checkpoint
    best_metrics = {}
    for l in reversed(trainer.state.log_history):
        if "eval_f1_macro" in l:
            best_metrics = {k: v for k, v in l.items() if k.startswith("eval_") or k == "epoch"}
            break

    result = {
        "trial": trial_idx,
        "config": cfg.to_dict(),
        "best_checkpoint": best_checkpoint,
        "eval": best_metrics,
    }
    (trial_out / "trial_result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    # If we have the best model yet, save final merged model
    return result


# ------------------------------
# HYPERPARAMETER TUNING + BEST MODEL SAVE
# ------------------------------
def save_best_model(tokenizer, best_model_dir: Path):
    """Merge LoRA adapters back to base model & save full model for inference."""
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    from peft import PeftModel

    # Check if this was a LoRA model (adapter_config exists)
    adapter_path = best_model_dir / "adapter_config.json"
    if adapter_path.exists():
        base_model_name = None
        # Read base model name from adapter config if possible
        try:
            cfg = json.loads(adapter_path.read_text(encoding="utf-8"))
            base_model_name = cfg.get("base_model_name_or_path")
        except Exception:
            pass
        if not base_model_name:
            base_model_name = "FacebookAI/xlm-roberta-base"

        base = AutoModelForSequenceClassification.from_pretrained(
            base_model_name, num_labels=len(LABELS),
            id2label=IDX2LABEL, label2id=LABEL2IDX,
        )
        merged = PeftModel.from_pretrained(base, str(best_model_dir))
        merged = merged.merge_and_unload()
        merged.save_pretrained(str(OUT_DIR / "best_model"))
        tokenizer.save_pretrained(str(OUT_DIR / "best_model"))
        print(f"[SAVE] Merged LoRA + base model saved → {OUT_DIR / 'best_model'}")
    else:
        # Full-fine-tuned: just copy files
        import shutil
        if best_model_dir != OUT_DIR / "best_model":
            if (OUT_DIR / "best_model").exists():
                shutil.rmtree(OUT_DIR / "best_model")
            shutil.copytree(best_model_dir, OUT_DIR / "best_model",
                            ignore=shutil.ignore_patterns("checkpoint-*"))
        tokenizer.save_pretrained(str(OUT_DIR / "best_model"))
        print(f"[SAVE] Best model copied → {OUT_DIR / 'best_model'}")


def main():
    parser = argparse.ArgumentParser(description="Fine-tune XLM-RoBERTa with HP tuning")
    parser.add_argument("--trials", type=int, default=1,
                        help="Number of random search hyperparameter trials")
    parser.add_argument("--model", default="FacebookAI/xlm-roberta-base",
                        help="Base model (xlm-roberta-base or xlm-roberta-large)")
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--no-lora", action="store_true", help="Full fine-tuning (no LoRA)")
    args = parser.parse_args()

    print(f"[LOAD] Loading preprocessed splits from {DATA_DIR}...")
    raw_ds = load_splits()

    # Default config (trial 0)
    default_cfg = TrainConfig(
        base_model=args.model,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        use_lora=not args.no_lora,
    )

    # We build the tokenizer ONCE from default cfg (base model is the same for all trials)
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(default_cfg.base_model, use_fast=True)
    tokenized = tokenize_dataset(raw_ds, tokenizer, default_cfg.max_seq_len)

    rng = random.Random(RANDOM_SEED)
    trial_results = []
    best_f1 = -1.0
    best_checkpoint: Path | None = None
    best_cfg: TrainConfig = default_cfg

    for trial in range(max(1, args.trials)):
        cfg = TrainConfig(
            base_model=default_cfg.base_model,
            max_seq_len=default_cfg.max_seq_len,
            num_train_epochs=default_cfg.num_train_epochs,
            per_device_train_batch_size=default_cfg.per_device_train_batch_size,
            per_device_eval_batch_size=default_cfg.per_device_eval_batch_size,
            use_lora=default_cfg.use_lora,
        )

        if trial > 0:
            # Random HP search
            cfg.learning_rate = rng.choice(HP_RANDOM_SPACE["learning_rate"])
            cfg.lora_r = rng.choice(HP_RANDOM_SPACE["lora_r"])
            cfg.lora_alpha = rng.choice(HP_RANDOM_SPACE["lora_alpha"])
            cfg.warmup_ratio = rng.choice(HP_RANDOM_SPACE["warmup_ratio"])
            cfg.weight_decay = rng.choice(HP_RANDOM_SPACE["weight_decay"])

        print(f"\n\n{'='*60}")
        print(f"▶ TRIAL {trial+1}/{args.trials} | "
              f"LR={cfg.learning_rate:.1e} LoRA-r={cfg.lora_r} "
              f"wd={cfg.weight_decay} warmup={cfg.warmup_ratio}")
        print('='*60)

        try:
            result = run_trial(cfg, tokenized, trial)
        except Exception as e:
            print(f"[FATAL] Trial {trial} FAILED: {e}")
            import traceback
            traceback.print_exc()
            continue

        trial_results.append(result)
        trial_f1 = float(result["eval"].get("eval_f1_macro", 0.0))
        ckpt = result["best_checkpoint"]
        print(f"\n[Trial {trial}] RESULT: f1_macro={trial_f1:.4f}")

        if trial_f1 > best_f1 and ckpt:
            best_f1 = trial_f1
            best_checkpoint = Path(ckpt)
            best_cfg = cfg

    # Summarize trials
    summary_path = OUT_DIR / "02_hp_trials_summary.json"
    summary_path.write_text(json.dumps(trial_results, indent=2), encoding="utf-8")
    print(f"\n[HP TUNING] {len(trial_results)} trials done. Summary → {summary_path}")
    print(f"[HP TUNING] Best f1_macro={best_f1:.4f}")

    if best_checkpoint is not None:
        print(f"[HP TUNING] Best checkpoint: {best_checkpoint}")
        # Save the final merged model
        save_best_model(tokenizer, best_checkpoint)

        # Save final training config
        final_cfg = best_cfg.to_dict()
        final_cfg["best_eval_f1_macro"] = best_f1
        (OUT_DIR / "best_model" / "training_config.json").write_text(
            json.dumps(final_cfg, indent=2), encoding="utf-8"
        )

    print("\nFine-tuning complete! 🎉 Next: python 03_export_model.py (optional) then python 04_evaluate_model.py")


if __name__ == "__main__":
    main()
