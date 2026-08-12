"""
================================================================
04_evaluate_model.py  — Phase 3.2
AI Evaluation: Accuracy / Precision / Recall / F1 / Confusion Matrix
                BEFORE vs AFTER Fine-Tuning Comparison
================================================================

✅ Evaluates on held-out test.csv (unseen during training)
✅ Computes:
   - Accuracy
   - Precision (macro / weighted / per-class)
   - Recall    (macro / weighted / per-class)
   - F1-Score  (macro / weighted / per-class)
   - Confusion Matrix (plotted + CSV)
   - Full classification report
✅ Compares:
   - BEFORE Fine-Tuning  (fallback: keyword / rule-based baseline OR base model)
   - AFTER  Fine-Tuning  (the fine-tuned XLM-RoBERTa from outputs/best_model/)
✅ Saves:
   - 04_evaluation_report.json     (full numeric report)
   - 04_before_vs_after.png        (bar chart of all key metrics)
   - 04_confusion_matrix_before.png
   - 04_confusion_matrix_after.png
   - 04_errors_before.csv          (misclassified rows for qualitative review)
   - 04_errors_after.csv
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # non-interactive backend (no GUI needed)
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from tqdm.auto import tqdm

# ------------------------------
# PATHS & CONSTANTS
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


# ====================================================================
# 🔒 REPRODUCIBILITY: Lock ALL random seeds globally (Step 1 of Phase 3.2)
# ====================================================================
def set_global_seed(seed: int = RANDOM_SEED) -> None:
    """Lock seeds for Python, Numpy, PyTorch, Sklearn — fully reproducible."""
    import random as _pyrandom
    _pyrandom.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    try:
        # scikit-learn uses numpy random state by default, but let's be explicit:
        import sklearn
        if hasattr(sklearn, "utils") and hasattr(sklearn.utils, "check_random_state"):
            sklearn.utils.check_random_state(seed)
    except Exception:
        pass
    # CUDA deterministic ops (optional, slight perf hit for reproducibility)
    if torch.cuda.is_available():
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


set_global_seed(RANDOM_SEED)


# ---- Plot style ----
sns.set_theme(style="whitegrid", palette="Set2")
plt.rcParams["figure.dpi"] = 140

# ------------------------------
# PREPROCESSING (same as everywhere!)
# ------------------------------
URL_RE = re.compile(r"https?://[^\s]+")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
HTML_RE = re.compile(r"<[^>]*>")
WS_RE = re.compile(r"\s+")


def preprocess(text: str) -> str:
    if not isinstance(text, str):
        return ""
    t = text.strip()
    t = WS_RE.sub(" ", t)
    t = unicodedata.normalize("NFC", t)
    t = HTML_RE.sub(" ", t)
    t = URL_RE.sub(" ", t)
    t = EMAIL_RE.sub(" ", t)
    return t.strip()


# ====================================================================
# BASELINE PREDICTOR (BEFORE FINE-TUNING):
# Reproducible keyword-based scoring (similar to app-level fallback)
# so we have a fair "before" to compare against.
# ====================================================================

POS_EN = {
    "happy", "glad", "joy", "joyful", "grateful", "thankful", "blessed",
    "love", "amazing", "great", "good", "wonderful", "excellent", "smile",
    "proud", "excited", "peaceful", "calm", "grin", "laugh", "positive",
    "hope", "hopeful", "success", "successful", "win", "won",
}
NEG_EN = {
    "sad", "down", "tired", "exhausted", "angry", "hate", "lonely", "alone",
    "stressed", "anxious", "anxiety", "worried", "worry", "bad", "fail",
    "failed", "disappointed", "frustrated", "upset", "hurt", "empty",
    "hopeless", "nothing", "regret", "regretting", "bored",
}
DST_EN = {
    "suicide", "suicidal", "killmyself", "kill myself", "want to die",
    "end my life", "no point living", "no point in living", "goodbye letter",
    "self harm", "self-harm", "cutting myself", "cut myself", "hurt myself",
    "unbearable", "can't take it anymore", "cant take it anymore",
    "disappear", "nobody cares", "no one cares",
}
POS_TL = {
    "masaya", "saya", "tuwa", "salamat", "grateful", "salamat", "blessed",
    "mahalin", "mahal", "maganda", "magaling", "mabuti", "masayang",
    "ipinagpapasalamat", "tagumpay", "nanalo", "panalo", "proud", "payapa",
    "sana all", "masarap", "kilig", "hope", "pag-asa", "pag asa",
}
NEG_TL = {
    "malungkot", "lungkot", "pagod", "sobrang pagod", "galit", "naiinis",
    "mag-isa", "nag-iisa", "stress", "stress na stress", "nababahala",
    "aalala", "nag-aalala", "problema", "problema na", "bigo", "nabigo",
    "bigong", "nadismaya", "sawa", "sawang sawa", "nasasaktan",
    "walang pag-asa", "walang pag asa", "pagsisisi", "nagsisisi",
    "hinayang", "sawama", "bored",
}
DST_TL = {
    "ayaw ko nang mabuhay", "ayaw ko na mabuhay", "tapusin na ito",
    "tapos na ako", "ayaw ko na", "mawawala na lang", "goodbye letter",
    "saktan ko ang sarili ko", "saktan ko sarili ko",
    "magsuicide", "magpakamatay", "mag pakamatay",
    "hirap na hirap na ako", "di ko na kaya", "hindi ko na kaya",
    "wala nang kwenta", "walang kwenta",
}


def baseline_predict(text: str) -> str:
    """Keyword-based baseline ("before fine-tuning") predictor."""
    t = preprocess(text).lower()
    if not t:
        return "positive"

    def hits(words, bag):
        return sum(1 for w in bag if w in t) + sum(
            1 for w in re.findall(r"[a-z]+", t) if w in bag
        )

    pos = hits(t, POS_EN) + hits(t, POS_TL)
    neg = hits(t, NEG_EN) + hits(t, NEG_TL)
    dst = hits(t, DST_EN) + hits(t, DST_TL)

    # Distress gets highest priority (weighted)
    dst *= 2
    if dst >= 2 and dst >= pos and dst >= neg:
        return "distress"
    if neg > pos:
        return "negative"
    return "positive"


# ====================================================================
# FINE-TUNED MODEL PREDICTOR (AFTER)
# ====================================================================
class FineTunedPredictor:
    def __init__(self, model_path: Path, max_seq_len: int = 256):
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        self.device = (
            "cuda" if torch.cuda.is_available() else
            ("mps" if (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()) else "cpu")
        )
        print(f"[EVAL] Loading fine-tuned model from {model_path} (device={self.device})")
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_path), use_fast=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(str(model_path))
        self.model.to(self.device)
        self.model.eval()
        self.max_seq_len = max_seq_len

    @torch.inference_mode()
    def predict_many(self, texts: list[str], batch_size: int = 64) -> list[str]:
        preds = []
        for i in tqdm(range(0, len(texts), batch_size), desc="Fine-tuned predict"):
            batch = texts[i:i+batch_size]
            enc = self.tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=self.max_seq_len,
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits
            argmax = logits.argmax(dim=-1).cpu().tolist()
            preds.extend(IDX2LABEL[i] for i in argmax)
        return preds


# ====================================================================
# METRICS
# ====================================================================
def compute_full_metrics(y_true: list[str], y_pred: list[str]) -> dict:
    # Label order is fixed: positive, negative, distress
    y_true_idx = [LABEL2IDX[l] for l in y_true]
    y_pred_idx = [LABEL2IDX[l] for l in y_pred]

    metrics = {
        "n_samples": len(y_true),
        "accuracy": float(accuracy_score(y_true_idx, y_pred_idx)),
        # ---- MACRO averages ----
        "precision_macro": float(precision_score(
            y_true_idx, y_pred_idx, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(
            y_true_idx, y_pred_idx, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(
            y_true_idx, y_pred_idx, average="macro", zero_division=0)),
        # ---- WEIGHTED averages (ADDED for Phase 3.2!) ----
        "precision_weighted": float(precision_score(
            y_true_idx, y_pred_idx, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(
            y_true_idx, y_pred_idx, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(
            y_true_idx, y_pred_idx, average="weighted", zero_division=0)),
    }

    # Per-class scores
    per_label = classification_report(
        y_true_idx, y_pred_idx,
        labels=[LABEL2IDX[l] for l in LABELS],
        target_names=LABELS,
        output_dict=True,
        zero_division=0,
    )
    for l in LABELS:
        d = per_label.get(l, {})
        metrics[f"per_{l}"] = {
            "precision": float(d.get("precision", 0.0)),
            "recall":    float(d.get("recall", 0.0)),
            "f1":        float(d.get("f1-score", 0.0)),
            "support":   int(d.get("support", 0)),
        }

    # Confusion matrix
    cm = confusion_matrix(
        y_true_idx, y_pred_idx,
        labels=[LABEL2IDX[l] for l in LABELS],
    )
    metrics["confusion_matrix"] = cm.tolist()
    metrics["classification_report_raw"] = per_label
    return metrics


# ====================================================================
# 🆕 PRE-TRAINED BASE MODEL PREDICTOR (for REAL "Base vs Fine-tuned" comparison)
# Loads the ORIGINAL pre-trained XLM-R with a randomly initialized 3-class head
# (no fine-tuning!) — this is Phase 3.2's "before" comparison point.
# ====================================================================
class BasePreTrainedPredictor:
    def __init__(self, base_model: str = "FacebookAI/xlm-roberta-base", max_seq_len: int = 256):
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        self.device = (
            "cuda" if torch.cuda.is_available() else
            ("mps" if (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()) else "cpu")
        )
        print(f"[EVAL] Loading PRE-TRAINED BASE model: {base_model} (device={self.device})")
        self.tokenizer = AutoTokenizer.from_pretrained(base_model, use_fast=True)
        # Randomly initialized head with 3 classes → this is the "before fine-tuning" baseline model
        self.model = AutoModelForSequenceClassification.from_pretrained(
            base_model,
            num_labels=len(LABELS),
            id2label=IDX2LABEL,
            label2id=LABEL2IDX,
        )
        self.model.to(self.device)
        self.model.eval()
        self.max_seq_len = max_seq_len

    @torch.inference_mode()
    def predict_many(self, texts: list[str], batch_size: int = 64) -> list[str]:
        preds = []
        for i in tqdm(range(0, len(texts), batch_size), desc="Base pre-trained predict"):
            batch = texts[i:i+batch_size]
            enc = self.tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=self.max_seq_len,
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits
            argmax = logits.argmax(dim=-1).cpu().tolist()
            preds.extend(IDX2LABEL[i] for i in argmax)
        return preds


def plot_confusion_matrix(cm: list[list[int]], title: str, save_path: Path) -> None:
    cm_arr = np.array(cm)
    plt.figure(figsize=(6, 5))
    ax = sns.heatmap(
        cm_arr,
        annot=True, fmt="d", cmap="Blues",
        xticklabels=LABELS, yticklabels=LABELS,
        cbar=True, square=True,
    )
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label", fontsize=11)
    ax.set_title(title, fontsize=12, pad=12)
    plt.tight_layout()
    plt.savefig(str(save_path), bbox_inches="tight")
    plt.close()


def plot_before_vs_after(before: dict, after: dict, save_path: Path) -> None:
    keys = [
        "accuracy",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "f1_weighted",
    ]
    labels_pretty = [
        "Accuracy", "Precision\n(Macro)", "Recall\n(Macro)",
        "F1 (Macro)", "F1 (Weighted)",
    ]
    x = np.arange(len(keys))
    width = 0.35
    fig, ax = plt.subplots(figsize=(9, 5.5))
    b = ax.bar(x - width/2, [before[k] for k in keys], width,
               label="Before Fine-Tuning (Keyword Baseline)", color="#B9A7D5", edgecolor="#7a63b5")
    a = ax.bar(x + width/2, [after[k] for k in keys], width,
               label="After Fine-Tuning (XLM-RoBERTa)", color="#76C7C0", edgecolor="#317873")

    ax.set_ylabel("Score")
    ax.set_title("Before vs After Fine-Tuning — Key Metrics", fontsize=13, pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(labels_pretty, fontsize=9)
    ax.set_ylim(0, 1.12)
    ax.legend(loc="lower right")
    for bars in (b, a):
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h + 0.01,
                    f"{h:.2f}", ha="center", va="bottom", fontsize=8)
    plt.tight_layout()
    plt.savefig(str(save_path), bbox_inches="tight")
    plt.close()


def save_error_csv(df: pd.DataFrame, y_true, y_pred, fname: str):
    errors = df[[c for c in df.columns if c != "label"]].copy()
    errors["label_true"] = list(y_true)
    errors["label_pred"] = list(y_pred)
    errors = errors[errors["label_true"] != errors["label_pred"]]
    errors.to_csv(OUT_DIR / fname, index=False, encoding="utf-8")
    print(f"[EVAL] {len(errors)} misclassifications saved → {OUT_DIR / fname}")
    return errors.reset_index(drop=True)


# ====================================================================
# 🆕 PHASE 3.2 ANALYSIS TOOLS
# ====================================================================

def identify_lowest_performing_class(metrics: dict) -> dict:
    """Identify which class has lowest F1, Recall, Precision (for Capstone findings)."""
    f1_per = {l: metrics.get(f"per_{l}", {}).get("f1", 0.0) for l in LABELS}
    recall_per = {l: metrics.get(f"per_{l}", {}).get("recall", 0.0) for l in LABELS}
    precision_per = {l: metrics.get(f"per_{l}", {}).get("precision", 0.0) for l in LABELS}

    def _lowest(d: dict) -> tuple[str, float]:
        items = sorted(d.items(), key=lambda kv: kv[1])
        return items[0] if items else ("unknown", 0.0)

    lowest_f1_class, lowest_f1_val = _lowest(f1_per)
    lowest_rec_class, lowest_rec_val = _lowest(recall_per)
    lowest_prec_class, lowest_prec_val = _lowest(precision_per)

    # Support-imbalance check
    supports = {l: int(metrics.get(f"per_{l}", {}).get("support", 0)) for l in LABELS}
    max_sup = max(supports.values()) or 1
    min_sup = min(supports.values()) or 1

    return {
        "lowest_f1": {"class": lowest_f1_class, "value": round(lowest_f1_val, 4)},
        "lowest_recall": {"class": lowest_rec_class, "value": round(lowest_rec_val, 4)},
        "lowest_precision": {"class": lowest_prec_class, "value": round(lowest_prec_val, 4)},
        "support_ratio_min_to_max": round(min_sup / max_sup, 3),
        "supports": supports,
        "flag_imbalance": min_sup / max_sup < 0.5,  # Less than half means imbalance concern
    }


def analyze_misclassifications(errors_df: pd.DataFrame, cm: list[list[int]]) -> dict:
    """Analyze top error patterns: which true→predicted pairs happen most."""
    top_pairs: list[dict] = []
    cm_arr = np.array(cm, dtype=int)
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            if i != j and cm_arr[i, j] > 0:
                top_pairs.append({
                    "true_label": LABELS[i],
                    "predicted_label": LABELS[j],
                    "count": int(cm_arr[i, j]),
                    "description": f"True '{LABELS[i]}' misclassified as '{LABELS[j]}'",
                })
    top_pairs.sort(key=lambda x: x["count"], reverse=True)

    # Qualitative stats on error texts (if errors_df available)
    avg_err_len = 0
    common_err_keywords: list[str] = []
    if errors_df is not None and len(errors_df) > 0 and "text" in errors_df.columns:
        lens = [len(str(x)) for x in errors_df["text"].astype(str)]
        avg_err_len = round(float(np.mean(lens)), 1) if lens else 0
        all_words = " ".join(str(x).lower() for x in errors_df["text"])
        words = re.findall(r"[a-z]+", all_words)
        stopwords = {
            "ang", "the", "ng", "ko", "na", "i", "you", "me", "to", "a", "sa",
            "is", "it", "of", "and", "or", "but", "in", "on", "my", "that",
            "this", "not", "no", "yes", "so", "very", "too", "with", "for",
            "from", "at", "by", "as", "an", "be", "are", "was", "were",
        }
        freq = Counter(w for w in words if w not in stopwords and len(w) > 2)
        common_err_keywords = [w for w, _ in freq.most_common(12)]

    return {
        "total_errors": int(len(errors_df)) if errors_df is not None else 0,
        "top_misclassification_pairs": top_pairs[:6],
        "error_text_avg_length_chars": avg_err_len,
        "common_keywords_in_errors": common_err_keywords,
    }


def generate_recommendations(
    metrics_fine_tuned: dict,
    analysis: dict,
    misclass: dict,
    label_distribution: dict,
) -> list[dict]:
    """Generate concrete, data-driven recommendations for the Capstone report."""
    recs: list[dict] = []

    # Low F1 → more training data for the affected class
    f1_issue = analysis["lowest_f1"]
    if f1_issue["value"] < 0.7:
        recs.append({
            "priority": "HIGH",
            "category": "DATA",
            "title": f"Class '{f1_issue['class']}' has low F1-score ({f1_issue['value']:.2f})",
            "recommendation": (
                f"Increase training / validation examples for class '{f1_issue['class']}' "
                "(target: at least 50% of the majority class's sample count). "
                "Consider guided data augmentation: synonym replacement, back-translation "
                "(Tagalog ↔ English), and rule-based paraphrasing."
            ),
        })

    # Imbalance recommendation
    if analysis.get("flag_imbalance"):
        sup = analysis["supports"]
        recs.append({
            "priority": "MEDIUM",
            "category": "BALANCING",
            "title": "Class imbalance detected in test set",
            "recommendation": (
                f"Label distribution is {sup}. Apply: "
                "(a) class weights in trainer, "
                "(b) stratified train/val/test splitting (already done), "
                "(c) optional upsampling of minority classes OR downsampling of majority class."
            ),
        })

    # Distress Recall → highest priority (safety)
    distress_recall = metrics_fine_tuned.get("per_distress", {}).get("recall", 0.0)
    if distress_recall < 0.85:
        recs.append({
            "priority": "CRITICAL",
            "category": "SAFETY",
            "title": f"Distress-class Recall is low ({distress_recall:.2f})",
            "recommendation": (
                "Low distress recall is a SAFETY risk (missing at-risk users). "
                "Recommend: (1) Add 200+ real distress examples to train set, "
                "(2) Increase distress class weight by factor of 1.5–2.0 in loss function, "
                "(3) Lower inference threshold for 'distress' if needed (bias toward safety)."
            ),
        })

    # Negative ↔ Distress confusion pattern
    top_pair = (misclass.get("top_misclassification_pairs") or [{}])[0]
    if top_pair:
        recs.append({
            "priority": "HIGH" if top_pair.get("count", 0) >= 5 else "MEDIUM",
            "category": "ERROR ANALYSIS",
            "title": f"Top misclassification: {top_pair.get('description')} (N={top_pair.get('count', 0)})",
            "recommendation": (
                f"Inspect the exported error CSV (04_errors_after.csv) for pattern: "
                f"{top_pair.get('description')}. "
                "Common fixes: expand keyword features, add more fine-tuning examples of "
                f"class '{top_pair.get('true_label')}' that exhibit similar wording, "
                "and/or clean ambiguous/noisy labels."
            ),
        })

    # Short error texts
    avg_len = misclass.get("error_text_avg_length_chars", 0)
    if avg_len and 0 < avg_len < 30:
        recs.append({
            "priority": "LOW",
            "category": "DATA QUALITY",
            "title": f"Misclassified texts are short (avg {avg_len} chars)",
            "recommendation": (
                "Short texts lack context and are legitimately hard to classify. "
                "Consider: (1) in-app minimum text length for journal entries, "
                "(2) context-concatenation (e.g., include user's last 2 entries as side info), "
                "(3) hybrid keyword fallback for very short inputs."
            ),
        })

    if not recs:
        recs.append({
            "priority": "LOW",
            "category": "GENERAL",
            "title": "Metrics are within acceptable range",
            "recommendation": (
                "All key metrics look good. Next steps: monitor real-world production "
                "misclassifications via user/counselor feedback, periodically retrain on new "
                "gold-labeled data."
            ),
        })

    return recs


# ====================================================================
# 🆕 REPORTING: CSV + Markdown outputs (Capstone-doc ready)
# ====================================================================

def save_metrics_csvs(report: dict) -> list[Path]:
    """Save flattened metrics as CSV (easy to paste into Capstone tables)."""
    written: list[Path] = []

    # --- 1. Overall metrics (OVERALL + MACRO + WEIGHTED) ---
    overall_rows = []
    for stage in ("before", "base", "after"):
        m = report.get(stage)
        if not m:
            continue
        row = {
            "stage": stage,
            "n_samples": m.get("n_samples"),
            "accuracy": m.get("accuracy"),
            "precision_macro": m.get("precision_macro"),
            "recall_macro": m.get("recall_macro"),
            "f1_macro": m.get("f1_macro"),
            "precision_weighted": m.get("precision_weighted"),
            "recall_weighted": m.get("recall_weighted"),
            "f1_weighted": m.get("f1_weighted"),
            "avg_latency_ms_per_sample": m.get("avg_latency_ms_per_sample"),
        }
        overall_rows.append(row)
    if overall_rows:
        p = OUT_DIR / "04_metrics_overall.csv"
        pd.DataFrame(overall_rows).to_csv(p, index=False, encoding="utf-8")
        written.append(p)

    # --- 2. Per-class metrics ---
    per_rows = []
    for stage in ("before", "base", "after"):
        m = report.get(stage)
        if not m:
            continue
        for l in LABELS:
            d = m.get(f"per_{l}", {})
            per_rows.append({
                "stage": stage,
                "class": l,
                "support": d.get("support"),
                "precision": d.get("precision"),
                "recall": d.get("recall"),
                "f1": d.get("f1"),
            })
    if per_rows:
        p = OUT_DIR / "04_metrics_per_class.csv"
        pd.DataFrame(per_rows).to_csv(p, index=False, encoding="utf-8")
        written.append(p)

    return written


def generate_markdown_report(
    report: dict,
    analysis: dict,
    misclass: dict,
    recommendations: list[dict],
    csvs: list[Path],
) -> Path:
    """Generate a full Capstone-doc-ready Markdown evaluation report."""
    meta = report.get("meta", {})
    after = report.get("after")
    before = report.get("before")
    base = report.get("base")

    def fmt_pct(x: float | None) -> str:
        return "N/A" if x is None else f"{100*x:.2f}%"

    def fmt(x: float | None, n=4) -> str:
        return "N/A" if x is None else f"{x:.{n}f}"

    lines: list[str] = []
    lines.append("# AI Model Evaluation — Phase 3.2 Report")
    lines.append("")
    lines.append("## 1. Evaluation Setup")
    lines.append("")
    lines.append(f"- **Date**: {pd.Timestamp.now().isoformat()}")
    lines.append(f"- **Random seed (reproducibility)**: {RANDOM_SEED}")
    lines.append(f"- **Evaluation dataset split**: **TEST only** (`{DATA_DIR.name}/test.csv`)")
    lines.append(f"- **Total test samples (N)**: {meta.get('test_size', 'N/A')}")
    lines.append(f"- **Label distribution (test set)**: `{json.dumps(meta.get('label_distribution', {}))}`")
    lines.append(f"- **Classes (3-way)**: Positive / Negative / Distress (no Neutral)")
    lines.append(f"- **Languages supported**: English, Filipino (Tagalog), Taglish (mixed)")
    lines.append("")
    lines.append("## 2. Comparison: Base Model → Fine-Tuned Model")
    lines.append("")
    lines.append("### 2.1 Overall Metrics")
    lines.append("")
    lines.append("| Stage | N | Accuracy | Prec (Macro) | Recall (Macro) | F1 (Macro) | Prec (Weighted) | Recall (Weighted) | F1 (Weighted) |")
    lines.append("|-------|---|----------|--------------|----------------|------------|-----------------|-------------------|---------------|")
    for stage in ("before", "base", "after"):
        m = report.get(stage)
        if not m:
            continue
        lines.append(
            f"| {stage.capitalize()} | {m.get('n_samples')} | "
            f"{fmt_pct(m.get('accuracy'))} | "
            f"{fmt_pct(m.get('precision_macro'))} | "
            f"{fmt_pct(m.get('recall_macro'))} | "
            f"{fmt_pct(m.get('f1_macro'))} | "
            f"{fmt_pct(m.get('precision_weighted'))} | "
            f"{fmt_pct(m.get('recall_weighted'))} | "
            f"{fmt_pct(m.get('f1_weighted'))} |"
        )
    lines.append("")
    lines.append("### 2.2 Per-Class Metrics (Fine-Tuned)")
    lines.append("")
    if after:
        lines.append("| Class | Support | Precision | Recall | F1 |")
        lines.append("|-------|---------|-----------|--------|----|")
        for l in LABELS:
            d = after.get(f"per_{l}", {})
            lines.append(
                f"| {l.capitalize()} | {d.get('support')} | "
                f"{fmt_pct(d.get('precision'))} | "
                f"{fmt_pct(d.get('recall'))} | "
                f"{fmt_pct(d.get('f1'))} |"
            )
        lines.append("")
    lines.append("## 3. Lowest Performing Class")
    lines.append("")
    lines.append(f"- **Lowest F1**: class `{analysis['lowest_f1']['class']}` = {analysis['lowest_f1']['value']:.4f}")
    lines.append(f"- **Lowest Recall**: class `{analysis['lowest_recall']['class']}` = {analysis['lowest_recall']['value']:.4f}")
    lines.append(f"- **Lowest Precision**: class `{analysis['lowest_precision']['class']}` = {analysis['lowest_precision']['value']:.4f}")
    lines.append(f"- **Support min/max ratio**: {analysis['support_ratio_min_to_max']:.3f} → "
                 f"`{'IMBALANCED' if analysis.get('flag_imbalance') else 'ACCEPTABLE'}`")
    lines.append("")
    lines.append("## 4. Misclassification Patterns")
    lines.append("")
    lines.append(f"- Total errors (fine-tuned): **{misclass['total_errors']}**")
    if misclass.get("error_text_avg_length_chars"):
        lines.append(f"- Avg length of misclassified text: **{misclass['error_text_avg_length_chars']} chars**")
    if misclass.get("common_keywords_in_errors"):
        lines.append(f"- Common words among errors: {', '.join(misclass['common_keywords_in_errors'][:8])}")
    lines.append("")
    lines.append("### 4.1 Top Confusion Pairs")
    lines.append("")
    pairs = misclass.get("top_misclassification_pairs") or []
    if pairs:
        lines.append("| Rank | Actual → Predicted | Count |")
        lines.append("|------|--------------------|-------|")
        for rank, p in enumerate(pairs, 1):
            lines.append(f"| {rank} | {p.get('true_label')} → {p.get('predicted_label')} | {p.get('count')} |")
    lines.append("")
    lines.append("## 5. Confusion Matrix (Fine-Tuned)")
    lines.append("")
    if after:
        cm = after.get("confusion_matrix") or []
        lines.append("| Actual \\ Predicted | Positive | Negative | Distress |")
        lines.append("|--------------------|----------|----------|----------|")
        for i, l in enumerate(LABELS):
            row = (cm[i] if i < len(cm) else [0, 0, 0])
            lines.append(f"| {l.capitalize()} | {row[0] if len(row)>0 else 0} | {row[1] if len(row)>1 else 0} | {row[2] if len(row)>2 else 0} |")
        lines.append("")
        lines.append("(PNG versions saved: `04_confusion_matrix_before.png`, `04_confusion_matrix_after.png`, `04_before_vs_after.png`)")
    lines.append("")
    lines.append("## 6. Recommendations (Data-Driven)")
    lines.append("")
    if recommendations:
        for i, r in enumerate(recommendations, 1):
            lines.append(f"### 6.{i} [{r.get('priority')}] {r.get('category')}: {r.get('title')}")
            lines.append("")
            lines.append(f"> {r.get('recommendation')}")
            lines.append("")
    lines.append("## 7. Artifacts")
    lines.append("")
    lines.append("- JSON metrics: `04_evaluation_report.json`")
    for p in csvs:
        lines.append(f"- Capstone-ready CSV: `{p.name}`")
    lines.append("- Misclassified samples: `04_errors_before.csv`, `04_errors_after.csv`")
    lines.append("")
    lines.append("---")
    lines.append("_End of Phase 3.2 Evaluation Report — Rise On AI Capstone 2._")

    p = OUT_DIR / "04_evaluation_report.md"
    p.write_text("\n".join(lines), encoding="utf-8")
    return p


# ====================================================================
# MAIN
# ====================================================================
def main():
    parser = argparse.ArgumentParser(description="AI Evaluation (before vs after fine-tuning)")
    parser.add_argument("--model", default=str(OUT_DIR / "best_model"),
                        help="Path to fine-tuned model folder")
    parser.add_argument("--base-model", default="FacebookAI/xlm-roberta-base",
                        help="Pre-trained base model name (for Base vs Fine-tuned comparison")
    parser.add_argument("--max-len", type=int, default=256)
    parser.add_argument("--skip-before", action="store_true",
                        help="Skip keyword baseline 'before' evaluation")
    parser.add_argument("--compare-base", action="store_true",
                        help="Also evaluate the raw PRE-TRAINED base XLM-R (no fine-tuning!)")
    args = parser.parse_args()

    # Lock seeds again at runtime (extra safety for reproducibility)
    set_global_seed(RANDOM_SEED)

    test_csv = DATA_DIR / "test.csv"
    if not test_csv.exists():
        raise FileNotFoundError(
            f"Missing {test_csv}. Run 01_prepare_dataset.py first!"
        )

    df = pd.read_csv(test_csv)
    df["text"] = df["text"].map(preprocess)
    # Filter any weird empties
    df = df[df["text"].str.len() > 0].reset_index(drop=True)

    y_true = list(df["label"].astype(str))
    texts = list(df["text"].astype(str))
    label_distribution = {l: int(y_true.count(l)) for l in LABELS}

    report: dict = {"meta": {
        "test_size": len(df),
        "label_distribution": label_distribution,
        "dataset_split": "TEST ONLY",  # Explicitly Phase 3.2 requirement!
        "random_seed": RANDOM_SEED,
        "base_model_name": args.base_model,
    }}

    errors_after_df = None
    m_after: dict | None = None
    m_before: dict | None = None

    # ---------------- 0. BASE PRE-TRAINED MODEL (optional) ----------------
    if args.compare_base:
        print("\n▶ [BASE PRE-TRAINED] Raw XLM-R with random init 3-class head...")
        try:
            base_predictor = BasePreTrainedPredictor(
                base_model=args.base_model, max_seq_len=args.max_len
            )
            start = time.perf_counter()
            y_pred_base = base_predictor.predict_many(texts)
            lat_ms = (time.perf_counter() - start) * 1000 / max(1, len(texts))
            m_base = compute_full_metrics(y_true, y_pred_base)
            m_base["avg_latency_ms_per_sample"] = round(lat_ms, 2)
            report["base"] = m_base
            print(f"   -> F1 Macro (base) : {m_base['f1_macro']:.4f}")
            print(f"   -> Accuracy  (base) : {m_base['accuracy']:.4f}")
        except Exception as e:
            print(f"[WARN] Base model comparison failed (continuing): {e}")

    # ---------------- 1. BEFORE (Baseline / keyword) ----------------
    if not args.skip_before:
        print("\n▶ [BEFORE FINE-TUNING] Baseline keyword predictor...")
        start = time.perf_counter()
        y_pred_before = [baseline_predict(t) for t in tqdm(texts, desc="Baseline")]
        lat_ms = (time.perf_counter() - start) * 1000 / max(1, len(texts))
        m_before = compute_full_metrics(y_true, y_pred_before)
        m_before["avg_latency_ms_per_sample"] = round(lat_ms, 2)
        report["before"] = m_before

        print(f"   -> F1 Macro (before) : {m_before['f1_macro']:.4f}")
        print(f"   -> Accuracy  (before) : {m_before['accuracy']:.4f}")

        plot_confusion_matrix(
            m_before["confusion_matrix"],
            title="Confusion Matrix: BEFORE Fine-Tuning (Keyword)",
            save_path=OUT_DIR / "04_confusion_matrix_before.png",
        )
        save_error_csv(df, y_true, y_pred_before, "04_errors_before.csv")
    else:
        print("[EVAL] Skipping baseline 'before' per request.")

    # ---------------- 2. AFTER (Fine-tuned XLM-RoBERTa) ----------------
    model_path = Path(args.model)
    if (model_path / "model.safetensors").exists() or (model_path / "pytorch_model.bin").exists():
        print("\n▶ [AFTER FINE-TUNING] Fine-tuned XLM-RoBERTa...")
        predictor = FineTunedPredictor(model_path, max_seq_len=args.max_len)
        start = time.perf_counter()
        y_pred_after = predictor.predict_many(texts)
        lat_ms = (time.perf_counter() - start) * 1000 / max(1, len(texts))

        m_after = compute_full_metrics(y_true, y_pred_after)
        m_after["avg_latency_ms_per_sample"] = round(lat_ms, 2)
        report["after"] = m_after

        print(f"   -> F1 Macro (after)  : {m_after['f1_macro']:.4f}")
        print(f"   -> Accuracy  (after)  : {m_after['accuracy']:.4f}")

        plot_confusion_matrix(
            m_after["confusion_matrix"],
            title="Confusion Matrix: AFTER Fine-Tuning (XLM-RoBERTa)",
            save_path=OUT_DIR / "04_confusion_matrix_after.png",
        )
        errors_after_df = save_error_csv(df, y_true, y_pred_after, "04_errors_after.csv")

        # --- Before vs After comparison plot ---
        if m_before is not None:
            print("\n[EVAL] Generating before/after comparison plot...")
            plot_before_vs_after(
                m_before, m_after,
                save_path=OUT_DIR / "04_before_vs_after.png",
            )

            # Print improvement summary
            print("\n========================================")
            print("  IMPROVEMENT (After vs Before Fine-Tuning)")
            print("========================================")
            keys = [
                "accuracy", "precision_macro", "recall_macro", "f1_macro",
                "precision_weighted", "recall_weighted", "f1_weighted",
            ]
            for k in keys:
                try:
                    delta = m_after[k] - m_before[k]
                    sign = "+" if delta >= 0 else ""
                    print(f"   {k:22s}  {m_before[k]:.3f} → {m_after[k]:.3f}   ({sign}{100*delta:.2f} pp)")
                except Exception:
                    continue
            print("========================================\n")
    else:
        print(f"[WARN] No fine-tuned model at {model_path} — skipping 'after' evaluation.")

    # ---------------- 3. Capstone-Ready ANALYSIS, RECOMMENDATIONS, REPORTS ----------------
    analysis = {}
    misclass = {}
    recs: list[dict] = []
    csvs_written: list[Path] = []
    md_path: Path | None = None

    if m_after is not None:
        # 3.1 Lowest performing class
        analysis = identify_lowest_performing_class(m_after)
        print("\n📊 [ANALYSIS] Lowest performing class:")
        print(f"   F1     → {analysis['lowest_f1']['class']} = {analysis['lowest_f1']['value']:.4f}")
        print(f"   Recall → {analysis['lowest_recall']['class']} = {analysis['lowest_recall']['value']:.4f}")
        print(f"   Imbalance flag → {analysis.get('flag_imbalance')}")

        # 3.2 Misclassification patterns
        misclass = analyze_misclassifications(
            errors_after_df, m_after.get("confusion_matrix") or [[0]*3]*3
        )
        print(f"\n🔎 [ANALYSIS] Top misclassification patterns:")
        for p in (misclass.get("top_misclassification_pairs") or [])[:3]:
            print(f"   • {p.get('description')} (N={p.get('count')})")

        # 3.3 Recommendations
        recs = generate_recommendations(m_after, analysis, misclass, label_distribution)
        print(f"\n💡 [RECOMMENDATIONS] {len(recs)} generated:")
        for r in recs[:3]:
            print(f"   • [{r.get('priority')}] {r.get('title')}")

    # 3.4 Save structured CSVs + Markdown (for Capstone docs)
    csvs_written = save_metrics_csvs(report)
    if m_after is not None or m_before is not None:
        md_path = generate_markdown_report(
            report, analysis, misclass, recs, csvs_written
        )

    # 3.5 Attach analysis/recommendations to the JSON report
    report["analysis"] = analysis
    report["misclassification_analysis"] = misclass
    report["recommendations"] = recs

    # ---------------- 4. Save JSON report (FINAL) ----------------
    report_path = OUT_DIR / "04_evaluation_report.json"
    report_path.write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")

    # ---------------- 5. Print summary of saved artifacts ----------------
    print("\n" + "="*70)
    print("📂 SAVED EVALUATION ARTIFACTS (for Capstone documentation)")
    print("="*70)
    print(f"  JSON Report             : {report_path}")
    if md_path:
        print(f"  Markdown Report (docs!) : {md_path}")
    for p in csvs_written:
        print(f"  CSV Table               : {p}")
    print(f"  CM Plot (Before)        : {OUT_DIR / '04_confusion_matrix_before.png'}")
    print(f"  CM Plot (After)         : {OUT_DIR / '04_confusion_matrix_after.png'}")
    print(f"  Before/After Plot       : {OUT_DIR / '04_before_vs_after.png'}")
    print(f"  Errors CSV (Before)     : {OUT_DIR / '04_errors_before.csv'}")
    print(f"  Errors CSV (After)      : {OUT_DIR / '04_errors_after.csv'}")
    print("="*70)

    print("\nEvaluation complete! 📊")


if __name__ == "__main__":
    main()
