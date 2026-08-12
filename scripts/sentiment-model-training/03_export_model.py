"""
================================================================
03_export_model.py — Phase 3.1
Export Best Model — PyTorch (Safetensors) + ONNX
================================================================

✅ Exports:
1. outputs/best_model/               -> PyTorch HF transformers format (safetensors)
2. outputs/onnx/model.onnx           -> Standard ONNX (cross-platform)
3. outputs/onnx/model_int8.onnx      -> (Optional) Dynamic quantization INT8 ONNX (SMALLER + FASTER CPU!)
4. outputs/model_card.json           -> Meta info + labels, max_len, benchmark
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "outputs"
DATA_DIR = BASE_DIR / "data"
ONNX_DIR = OUT_DIR / "onnx"
ONNX_DIR.mkdir(parents=True, exist_ok=True)

LABELS = ["positive", "negative", "distress"]
IDX2LABEL = {i: l for i, l in enumerate(LABELS)}
LABEL2IDX = {l: i for i, l in enumerate(LABELS)}


def get_model_card(model_path: Path, export_info: dict) -> dict:
    training_cfg = {}
    cfg_path = model_path / "training_config.json"
    if cfg_path.exists():
        training_cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

    return {
        "model_name": "rise-on-ai-xlmlroberta-sentiment",
        "labels": LABELS,
        "label2idx": LABEL2IDX,
        "max_seq_len": export_info.get("max_seq_len", 256),
        "language": ["en", "tl", "taglish"],
        "base_model": training_cfg.get("base_model", "FacebookAI/xlm-roberta-base"),
        "training_config": training_cfg,
        "export_info": export_info,
    }


def benchmark_pytorch(model, tokenizer, sample_texts: list[str], reps=5) -> dict:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    model.eval()
    all_times = []
    for _ in range(max(1, reps)):
        for t in sample_texts:
            start = time.perf_counter()
            enc = tokenizer(
                [t], return_tensors="pt", truncation=True,
                padding="max_length", max_length=256,
            )
            with torch.inference_mode():
                _ = model(**enc)
            all_times.append((time.perf_counter() - start) * 1000)
    return {
        "mean_ms": round(float(np.mean(all_times)), 2),
        "p50_ms": round(float(np.percentile(all_times, 50)), 2),
        "p95_ms": round(float(np.percentile(all_times, 95)), 2),
        "samples": len(sample_texts),
    }


def export_pytorch(model, tokenizer, cfg, sample_texts: list[str]) -> dict:
    torch_path = OUT_DIR / "best_model"
    torch_path.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(torch_path), safe_serialization=True)
    tokenizer.save_pretrained(str(torch_path))
    print(f"[EXPORT] PyTorch (HF + Safetensors) → {torch_path}")
    bench = benchmark_pytorch(model, tokenizer, sample_texts)
    print(f"[BENCH] PyTorch speed: mean={bench['mean_ms']}ms p95={bench['p95_ms']}ms")
    return {"format": "pytorch_hf", "path": str(torch_path), "benchmark": bench}


def export_onnx(model, tokenizer, cfg, quantize: bool) -> list[dict]:
    results = []
    try:
        from transformers.onnx import export, OnnxConfig
        from optimum.onnxruntime import ORTQuantizer, ORTModelForSequenceClassification
        from onnxruntime.quantization import QuantType, quantize_dynamic
        from transformers import AutoConfig, AutoTokenizer
    except Exception as e:
        print(f"[WARN] ONNX export skipped (missing optimum/onnxruntime): {e}")
        return results

    # ---- Export vanilla ONNX (FP32) via optimum or manual tracing ----
    try:
        onnx_fp32 = ONNX_DIR / "model.onnx"
        # Use optimum if available for clean export with proper configs
        try:
            from optimum.onnxruntime import ORTModelForSequenceClassification as ORTCLS
            ort_model = ORTCLS.from_pretrained(
                str(OUT_DIR / "best_model"),
                from_transformers=True,
                export=True,
            )
            ort_model.save_pretrained(str(ONNX_DIR))
            tokenizer.save_pretrained(str(ONNX_DIR))
        except Exception:
            # Manual tracing fallback
            import torch.onnx
            model.eval()
            dummy = tokenizer(
                ["sample"],
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=cfg.max_seq_len,
            )
            dynamic_axes = {
                "input_ids": {0: "batch", 1: "seq"},
                "attention_mask": {0: "batch", 1: "seq"},
                "output": {0: "batch"},
            }
            torch.onnx.export(
                model,
                (dummy["input_ids"], dummy["attention_mask"]),
                str(onnx_fp32),
                input_names=["input_ids", "attention_mask"],
                output_names=["logits"],
                dynamic_axes=dynamic_axes,
                opset_version=15,
                do_constant_folding=True,
            )

        if onnx_fp32.exists():
            results.append({"format": "onnx_fp32", "path": str(onnx_fp32)})
            print(f"[EXPORT] ONNX FP32 → {onnx_fp32}  ({onnx_fp32.stat().st_size/1024/1024:.1f} MB)")

        # ---- Optional: INT8 Dynamic Quantization ----
        if quantize:
            onnx_int8 = ONNX_DIR / "model_int8.onnx"
            try:
                from onnxruntime.quantization import quantize_dynamic, QuantType
                quantize_dynamic(
                    model_input=str(onnx_fp32),
                    model_output=str(onnx_int8),
                    weight_type=QuantType.QInt8,
                )
                results.append({"format": "onnx_int8", "path": str(onnx_int8)})
                print(f"[EXPORT] ONNX INT8 → {onnx_int8}  ({onnx_int8.stat().st_size/1024/1024:.1f} MB)")
            except Exception as e:
                print(f"[WARN] ONNX INT8 quantization failed: {e}")
    except Exception as e:
        print(f"[WARN] ONNX export failed: {e}")
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=str(OUT_DIR / "best_model"),
                        help="Path to fine-tuned model folder")
    parser.add_argument("--no-quant", action="store_true",
                        help="Skip INT8 ONNX quantization")
    parser.add_argument("--max-len", type=int, default=256)
    args = parser.parse_args()

    model_path = Path(args.model)
    if not (model_path / "model.safetensors").exists() and \
       not (model_path / "pytorch_model.bin").exists():
        raise FileNotFoundError(
            f"No model weights in {model_path}. Run 02_finetune_xlmroberta.py first."
        )

    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    tokenizer = AutoTokenizer.from_pretrained(str(model_path), use_fast=True)
    model = AutoModelForSequenceClassification.from_pretrained(str(model_path))

    # Sample benchmark texts
    sample_texts = [
        "I feel so happy and grateful for everything today.",
        "Nag-aalala ako nang sobra, hindi ako makatulog nitong mga nakaraang araw.",
        "I don't want to go on anymore. There is no hope for me.",
        "Medyo malungkot ngayon pero okay naman ako.",
    ] * 5

    export_info = {"max_seq_len": args.max_len, "exports": []}

    # ---- 1. PyTorch HF export (already done, but re-save best practice card) ----
    pt_bench = export_pytorch(model, tokenizer, args, sample_texts)
    export_info["exports"].append(pt_bench)

    # ---- 2. ONNX export ----
    onnx_results = export_onnx(model, tokenizer, args, quantize=not args.no_quant)
    export_info["exports"].extend(onnx_results)

    # ---- 3. Model card ----
    card = get_model_card(model_path, export_info)
    card_path = OUT_DIR / "model_card.json"
    card_path.write_text(json.dumps(card, indent=2), encoding="utf-8")
    print(f"\n[EXPORT] Model card → {card_path}")

    print("\nDone! 🚀 Next step: python 04_evaluate_model.py")


if __name__ == "__main__":
    main()
