"""
================================================================
04_evaluate_model.py  —  Phase 3.2
AI Model Evaluation: Accuracy / Precision / Recall / F1 / Confusion Matrix
                     3-Way Comparison: Keyword Baseline → XLM-R Base → Fine-Tuned
================================================================

WHAT THIS SCRIPT DOES
─────────────────────
✅ Evaluates on held-out test.csv ONLY (never seen during training)
✅ Computes — Overall, Per-Class, Macro Avg, Weighted Avg:
     • Accuracy
     • Precision
     • Recall
     • F1-score
     • Confusion Matrix (numeric + saved PNG)
✅ 3-way reproducible comparison:
     1. Keyword Baseline            ("before" — no ML)
     2. XLM-R Pre-trained Base      ("base"   — random 3-class head, no fine-tuning)
     3. XLM-R Fine-tuned            ("after"  — our trained model)
✅ Identifies lowest-performing class (F1, Recall, Precision)
✅ Analyzes common misclassification patterns
✅ Generates data-driven recommendations
✅ Saves CAPSTONE-READY artifacts:
     • 04_evaluation_report.json      Full structured report
     • 04_evaluation_report.md        Markdown for Capstone docs
     • 04_metrics_overall.csv         Overall / macro / weighted table
     • 04_metrics_per_class.csv       Per-class table
     • 04_confusion_matrix_keyword.png
     • 04_confusion_matrix_base.png
     • 04_confusion_matrix_finetuned.png
     • 04_comparison_overall.png      3-way bar chart (overall metrics)
     • 04_comparison_perclass_f1.png  Per-class F1 bar chart
     • 04_errors_keyword.csv
     • 04_errors_base.csv
     • 04_errors_finetuned.csv

REPRODUCIBILITY
───────────────
  Random seed 42 is locked on Python / NumPy / PyTorch / CUDA before ANY
  inference call.  Results are identical across re-runs given the same
  test.csv and model weights.

USAGE
─────
  python 04_evaluate_model.py                          # full 3-way comparison
  python 04_evaluate_model.py --skip-base              # skip base model (faster)
  python 04_evaluate_model.py --skip-keyword           # skip keyword baseline
  python 04_evaluate_model.py --model path/to/model    # custom model path
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
matplotlib.use("Agg")   # headless — no display needed
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

# ─────────────────────────────────────────────────────────────────────────────
# PATHS & CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "outputs"
LOG_DIR = BASE_DIR / "logs"
for _d in (DATA_DIR, OUT_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

LABELS = ["positive", "negative", "distress"]
LABEL2IDX = {l: i for i, l in enumerate(LABELS)}
IDX2LABEL = {i: l for l, i in LABEL2IDX.items()}
RANDOM_SEED = 42

# Stage display names used in plots / tables
STAGE_LABELS = {
    "keyword": "Keyword Baseline",
    "base": "XLM-R Base (pre-trained)",
    "finetuned": "XLM-R Fine-tuned",
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. REPRODUCIBILITY — lock ALL random seeds globally
# ─────────────────────────────────────────────────────────────────────────────
def set_global_seed(seed: int = RANDOM_SEED) -> None:
    import random as _pyrandom
    _pyrandom.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    if torch.cuda.is_available():
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


set_global_seed(RANDOM_SEED)

# ─────────────────────────────────────────────────────────────────────────────
# 2. PLOT STYLE
# ─────────────────────────────────────────────────────────────────────────────
sns.set_theme(style="whitegrid", palette="Set2")
plt.rcParams["figure.dpi"] = 140

# ─────────────────────────────────────────────────────────────────────────────
# 3. PREPROCESSING  (must match training-time and Next.js 1-for-1)
# ─────────────────────────────────────────────────────────────────────────────
_URL_RE = re.compile(r"https?://[^\s]+")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_HTML_RE  = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"\s+")


def preprocess(text: str) -> str:
    if not isinstance(text, str):
        return ""
    t = text.strip()
    t = _WS_RE.sub(" ", t)
    t = unicodedata.normalize("NFC", t)
    t = _HTML_RE.sub(" ", t)
    t = _URL_RE.sub(" ", t)
    t = _EMAIL_RE.sub(" ", t)
    return t.strip()


# ─────────────────────────────────────────────────────────────────────────────
# 4. KEYWORD BASELINE  ("before" — no ML at all)
# ─────────────────────────────────────────────────────────────────────────────
_POS_EN = {
    "happy","glad","joy","joyful","grateful","thankful","blessed","love",
    "amazing","great","good","wonderful","excellent","smile","proud","excited",
    "peaceful","calm","grin","laugh","positive","hope","hopeful","success",
    "successful","win","won",
}
_NEG_EN = {
    "sad","down","tired","exhausted","angry","hate","lonely","alone","stressed",
    "anxious","anxiety","worried","worry","bad","fail","failed","disappointed",
    "frustrated","upset","hurt","empty","hopeless","nothing","regret",
    "regretting","bored",
}
_DST_EN = {
    "suicide","suicidal","killmyself","kill myself","want to die","end my life",
    "no point living","no point in living","goodbye letter","self harm",
    "self-harm","cutting myself","cut myself","hurt myself","unbearable",
    "can't take it anymore","cant take it anymore","disappear","nobody cares",
    "no one cares",
}
_POS_TL = {
    "masaya","saya","tuwa","salamat","blessed","mahalin","mahal","maganda",
    "magaling","mabuti","masayang","ipinagpapasalamat","tagumpay","nanalo",
    "panalo","proud","payapa","sana all","masarap","kilig","pag-asa","pag asa",
}
_NEG_TL = {
    "malungkot","lungkot","pagod","sobrang pagod","galit","naiinis","mag-isa",
    "nag-iisa","stress","stress na stress","nababahala","aalala","nag-aalala",
    "problema","bigo","nabigo","bigong","nadismaya","sawa","sawang sawa",
    "nasasaktan","walang pag-asa","walang pag asa","pagsisisi","nagsisisi",
    "hinayang","bored",
}
_DST_TL = {
    "ayaw ko nang mabuhay","ayaw ko na mabuhay","tapusin na ito","tapos na ako",
    "ayaw ko na","mawawala na lang","goodbye letter","saktan ko ang sarili ko",
    "saktan ko sarili ko","magsuicide","magpakamatay","mag pakamatay",
    "hirap na hirap na ako","di ko na kaya","hindi ko na kaya",
    "wala nang kwenta","walang kwenta",
}


def keyword_predict(text: str) -> str:
    """Pure keyword/rule-based prediction (no ML). Used as the 'before' baseline."""
    t = preprocess(text).lower()
    if not t:
        return "positive"

    def hits(bag: set) -> int:
        return sum(1 for w in bag if w in t) + sum(
            1 for w in re.findall(r"[a-z]+", t) if w in bag
        )

    pos = hits(_POS_EN) + hits(_POS_TL)
    neg = hits(_NEG_EN) + hits(_NEG_TL)
    dst = hits(_DST_EN) + hits(_DST_TL)
    dst *= 2  # distress carries higher weight for safety
    if dst >= 2 and dst >= pos and dst >= neg:
        return "distress"
    if neg > pos:
        return "negative"
    return "positive"


# ─────────────────────────────────────────────────────────────────────────────
# 5. TRANSFORMER PREDICTORS  (Base + Fine-tuned)
# ─────────────────────────────────────────────────────────────────────────────
def _best_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class HFPredictor:
    """Generic HuggingFace sequence-classifier predictor (base OR fine-tuned)."""

    def __init__(
        self,
        model_name_or_path: str,
        label_name: str,
        max_seq_len: int = 256,
        random_head: bool = False,
    ) -> None:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        self.device = _best_device()
        print(f"[EVAL] Loading '{label_name}': {model_name_or_path}  (device={self.device})")

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name_or_path, use_fast=True
        )
        if random_head:
            # Pre-trained backbone + randomly-initialised 3-class head
            # This is the "before fine-tuning" model comparison (not keyword heuristic)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name_or_path,
                num_labels=len(LABELS),
                id2label=IDX2LABEL,
                label2id=LABEL2IDX,
                ignore_mismatched_sizes=True,
            )
        else:
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name_or_path
            )

        self.model.to(self.device)
        self.model.eval()
        self.max_seq_len = max_seq_len
        self.label_name = label_name

    @torch.inference_mode()
    def predict_many(self, texts: list[str], batch_size: int = 64) -> list[str]:
        set_global_seed(RANDOM_SEED)   # re-lock seed for each predictor run
        preds: list[str] = []
        for i in tqdm(range(0, len(texts), batch_size), desc=self.label_name):
            batch = texts[i : i + batch_size]
            enc = self.tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=self.max_seq_len,
            )
            enc = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits
            indices = logits.argmax(dim=-1).cpu().tolist()
            preds.extend(IDX2LABEL[idx] for idx in indices)
        return preds


# ─────────────────────────────────────────────────────────────────────────────
# 6. METRICS
# ─────────────────────────────────────────────────────────────────────────────
def compute_full_metrics(y_true: list[str], y_pred: list[str]) -> dict:
    yt = [LABEL2IDX[l] for l in y_true]
    yp = [LABEL2IDX[l] for l in y_pred]

    m: dict = {
        "n_samples": len(yt),
        # Overall
        "accuracy": float(accuracy_score(yt, yp)),
        # Macro
        "precision_macro": float(precision_score(yt, yp, average="macro",    zero_division=0)),
        "recall_macro": float(recall_score   (yt, yp, average="macro",    zero_division=0)),
        "f1_macro": float(f1_score       (yt, yp, average="macro",    zero_division=0)),
        # Weighted
        "precision_weighted": float(precision_score(yt, yp, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score   (yt, yp, average="weighted", zero_division=0)),
        "f1_weighted":float(f1_score       (yt, yp, average="weighted", zero_division=0)),
    }

    # Per-class
    cr = classification_report(
        yt, yp,
        labels=[LABEL2IDX[l] for l in LABELS],
        target_names=LABELS,
        output_dict=True,
        zero_division=0,
    )
    for l in LABELS:
        d = cr.get(l, {})
        m[f"per_{l}"] = {
            "precision": float(d.get("precision", 0.0)),
            "recall":    float(d.get("recall",    0.0)),
            "f1":        float(d.get("f1-score",  0.0)),
            "support":   int  (d.get("support",   0  )),
        }

    # Confusion matrix (rows = true, cols = predicted)
    cm = confusion_matrix(yt, yp, labels=[LABEL2IDX[l] for l in LABELS])
    m["confusion_matrix"]         = cm.tolist()
    m["classification_report_raw"] = cr
    return m


# ─────────────────────────────────────────────────────────────────────────────
# 7. PLOTS
# ─────────────────────────────────────────────────────────────────────────────
def plot_confusion_matrix(
    cm: list[list[int]],
    title: str,
    save_path: Path,
) -> None:
    arr = np.array(cm)
    plt.figure(figsize=(6, 5))
    ax = sns.heatmap(
        arr, annot=True, fmt="d", cmap="Blues",
        xticklabels=LABELS, yticklabels=LABELS,
        cbar=True, square=True,
    )
    ax.set_xlabel("Predicted Label",  fontsize=11)
    ax.set_ylabel("True Label",       fontsize=11)
    ax.set_title(title,               fontsize=12, pad=12)
    plt.tight_layout()
    plt.savefig(str(save_path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] Saved → {save_path.name}")


def plot_comparison_overall(
    metrics_map: dict[str, dict],
    save_path: Path,
) -> None:
    """
    3-way grouped bar chart: Keyword Baseline / XLM-R Base / XLM-R Fine-tuned
    across five overall metrics.
    """
    metric_keys   = ["accuracy", "precision_macro", "recall_macro", "f1_macro", "f1_weighted"]
    metric_labels = ["Accuracy", "Precision\n(Macro)", "Recall\n(Macro)", "F1\n(Macro)", "F1\n(Weighted)"]

    stages  = [s for s in ("keyword", "base", "finetuned") if s in metrics_map]
    colors  = {"keyword": "#C9B8E8", "base": "#88C7C1", "finetuned": "#F4A261"}
    n_met   = len(metric_keys)
    n_stg   = len(stages)
    width   = 0.22
    x       = np.arange(n_met)

    fig, ax = plt.subplots(figsize=(10, 5.5))
    for idx, stage in enumerate(stages):
        m      = metrics_map[stage]
        vals   = [m.get(k, 0.0) for k in metric_keys]
        offset = (idx - (n_stg - 1) / 2) * width
        bars   = ax.bar(x + offset, vals, width,
                        label=STAGE_LABELS[stage],
                        color=colors[stage],
                        edgecolor="#555", linewidth=0.6)
        for bar in bars:
            h = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2, h + 0.012,
                f"{h:.2f}", ha="center", va="bottom", fontsize=7.5,
            )

    ax.set_ylabel("Score",  fontsize=11)
    ax.set_title("Phase 3.2 — Model Comparison: Overall Metrics", fontsize=13, pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(metric_labels, fontsize=9)
    ax.set_ylim(0, 1.15)
    ax.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(str(save_path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] Saved → {save_path.name}")


def plot_comparison_perclass_f1(
    metrics_map: dict[str, dict],
    save_path: Path,
) -> None:
    """Per-class F1 grouped bar chart (one group per class)."""
    stages  = [s for s in ("keyword", "base", "finetuned") if s in metrics_map]
    colors  = {"keyword": "#C9B8E8", "base": "#88C7C1", "finetuned": "#F4A261"}
    n_cls   = len(LABELS)
    n_stg   = len(stages)
    width   = 0.22
    x       = np.arange(n_cls)

    fig, ax = plt.subplots(figsize=(8, 5))
    for idx, stage in enumerate(stages):
        m      = metrics_map[stage]
        vals   = [m.get(f"per_{l}", {}).get("f1", 0.0) for l in LABELS]
        offset = (idx - (n_stg - 1) / 2) * width
        bars   = ax.bar(x + offset, vals, width,
                        label=STAGE_LABELS[stage],
                        color=colors[stage],
                        edgecolor="#555", linewidth=0.6)
        for bar in bars:
            h = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2, h + 0.012,
                f"{h:.2f}", ha="center", va="bottom", fontsize=8,
            )

    ax.set_ylabel("F1-Score", fontsize=11)
    ax.set_title("Phase 3.2 — Per-Class F1-Score Comparison", fontsize=13, pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels([l.capitalize() for l in LABELS], fontsize=10)
    ax.set_ylim(0, 1.15)
    ax.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(str(save_path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] Saved → {save_path.name}")


# ─────────────────────────────────────────────────────────────────────────────
# 8. ERROR / MISCLASSIFICATION HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def save_error_csv(df: pd.DataFrame, y_true: list, y_pred: list, fname: str) -> pd.DataFrame:
    err = df.copy()
    err["label_true"] = list(y_true)
    err["label_pred"] = list(y_pred)
    err = err[err["label_true"] != err["label_pred"]].reset_index(drop=True)
    err.to_csv(OUT_DIR / fname, index=False, encoding="utf-8")
    print(f"[EVAL] {len(err)} misclassifications → {fname}")
    return err


def identify_lowest_performing_class(m: dict) -> dict:
    f1_per   = {l: m.get(f"per_{l}", {}).get("f1",        0.0) for l in LABELS}
    rec_per  = {l: m.get(f"per_{l}", {}).get("recall",    0.0) for l in LABELS}
    prec_per = {l: m.get(f"per_{l}", {}).get("precision", 0.0) for l in LABELS}

    def _lowest(d: dict) -> tuple[str, float]:
        return min(d.items(), key=lambda kv: kv[1])

    low_f1_cls,   low_f1_val   = _lowest(f1_per)
    low_rec_cls,  low_rec_val  = _lowest(rec_per)
    low_prec_cls, low_prec_val = _lowest(prec_per)

    supports = {l: m.get(f"per_{l}", {}).get("support", 0) for l in LABELS}
    max_sup  = max(supports.values()) or 1
    min_sup  = min(supports.values()) or 1

    return {
        "lowest_f1":        {"class": low_f1_cls,   "value": round(low_f1_val,   4)},
        "lowest_recall":    {"class": low_rec_cls,  "value": round(low_rec_val,  4)},
        "lowest_precision": {"class": low_prec_cls, "value": round(low_prec_val, 4)},
        "support_ratio_min_to_max": round(min_sup / max_sup, 3),
        "supports": supports,
        "flag_imbalance": (min_sup / max_sup) < 0.5,
    }


def analyze_misclassifications(
    errors_df: pd.DataFrame | None,
    cm: list[list[int]],
) -> dict:
    top_pairs: list[dict] = []
    arr = np.array(cm, dtype=int)
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            if i != j and arr[i, j] > 0:
                top_pairs.append({
                    "true_label":      LABELS[i],
                    "predicted_label": LABELS[j],
                    "count":           int(arr[i, j]),
                    "description":     f"True '{LABELS[i]}' predicted as '{LABELS[j]}'",
                })
    top_pairs.sort(key=lambda x: x["count"], reverse=True)

    avg_len: float = 0.0
    common_kw: list[str] = []
    if errors_df is not None and len(errors_df) > 0 and "text" in errors_df.columns:
        lens    = [len(str(x)) for x in errors_df["text"]]
        avg_len = round(float(np.mean(lens)), 1) if lens else 0.0
        raw     = " ".join(str(x).lower() for x in errors_df["text"])
        words   = re.findall(r"[a-z]+", raw)
        STOP    = {
            "ang","the","ng","ko","na","i","you","me","to","a","sa","is","it",
            "of","and","or","but","in","on","my","that","this","not","no","yes",
            "so","very","too","with","for","from","at","by","as","an","be","are",
            "was","were","naman","lang","yung","kasi","pero",
        }
        freq    = Counter(w for w in words if w not in STOP and len(w) > 2)
        common_kw = [w for w, _ in freq.most_common(12)]

    return {
        "total_errors":                int(len(errors_df)) if errors_df is not None else 0,
        "top_misclassification_pairs": top_pairs[:6],
        "error_text_avg_length_chars": avg_len,
        "common_keywords_in_errors":   common_kw,
    }


def generate_recommendations(
    m_finetuned: dict,
    analysis: dict,
    misclass: dict,
    label_dist: dict,
) -> list[dict]:
    recs: list[dict] = []

    # Distress recall — highest priority (safety-critical)
    dst_recall = m_finetuned.get("per_distress", {}).get("recall", 1.0)
    if dst_recall < 0.85:
        recs.append({
            "priority":       "CRITICAL",
            "category":       "SAFETY",
            "title":          f"Distress class Recall is {dst_recall:.2f} (below 0.85 safety threshold)",
            "recommendation": (
                "A low distress recall means at-risk users may be missed. Actions: "
                "(1) Add ≥200 real-world distress examples to the training set. "
                "(2) Increase distress class weight in CrossEntropyLoss by ×1.5–2.0. "
                "(3) Consider lowering the distress inference threshold in production "
                "(bias toward false-positives rather than false-negatives for safety)."
            ),
        })

    # Lowest F1 class
    f1_issue = analysis["lowest_f1"]
    if f1_issue["value"] < 0.70:
        recs.append({
            "priority":       "HIGH",
            "category":       "DATA",
            "title":          f"Class '{f1_issue['class']}' has low F1-score ({f1_issue['value']:.4f})",
            "recommendation": (
                f"Increase training examples for class '{f1_issue['class']}' "
                "to at least 50 % of the majority class count. "
                "Techniques: back-translation (EN↔TL), synonym replacement, "
                "rule-based paraphrasing, or crowd-sourced annotation."
            ),
        })

    # Class imbalance
    if analysis.get("flag_imbalance"):
        sup = analysis["supports"]
        recs.append({
            "priority":       "MEDIUM",
            "category":       "BALANCING",
            "title":          "Class imbalance detected in test set",
            "recommendation": (
                f"Support distribution is {sup}. "
                "Ensure training split applies stratified sampling (already enforced in 01_prepare_dataset.py). "
                "Additionally consider: weighted random sampler, upsampling minority classes, "
                "or focal loss to penalise easy majority-class predictions."
            ),
        })

    # Top confusion pair
    top_pair = (misclass.get("top_misclassification_pairs") or [{}])[0]
    if top_pair:
        n = top_pair.get("count", 0)
        recs.append({
            "priority":       "HIGH" if n >= 5 else "MEDIUM",
            "category":       "ERROR ANALYSIS",
            "title":          f"Top confusion: {top_pair.get('description')} (N={n})",
            "recommendation": (
                f"Review 04_errors_finetuned.csv for rows where true='{top_pair.get('true_label')}' "
                f"is predicted as '{top_pair.get('predicted_label')}'. "
                "Common causes: ambiguous phrasing shared between two classes, noisy labels, "
                "or too few fine-grained training examples at the boundary. "
                "Fix: add more contrastive examples and consider label-smoothing."
            ),
        })

    # Short misclassified texts
    avg_len = misclass.get("error_text_avg_length_chars", 0)
    if avg_len and 0 < avg_len < 40:
        recs.append({
            "priority":       "LOW",
            "category":       "DATA QUALITY",
            "title":          f"Misclassified texts are very short (avg {avg_len} chars)",
            "recommendation": (
                "Short texts lack discriminative context. "
                "Mitigations: enforce a minimum entry length in the app UI, "
                "concatenate the user's previous journal entry as context, "
                "or apply a keyword-based fallback when text length < 20 chars."
            ),
        })

    if not recs:
        recs.append({
            "priority":       "LOW",
            "category":       "GENERAL",
            "title":          "All key metrics are within acceptable range",
            "recommendation": (
                "Continue monitoring production misclassifications via counselor feedback. "
                "Retrain periodically on gold-labelled real-world data."
            ),
        })

    return recs


# ─────────────────────────────────────────────────────────────────────────────
# 9. CAPSTONE-READY CSV OUTPUTS
# ─────────────────────────────────────────────────────────────────────────────
def save_metrics_csvs(report: dict) -> list[Path]:
    written: list[Path] = []

    # Overall / macro / weighted table
    rows: list[dict] = []
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        rows.append({
            "stage":                   STAGE_LABELS.get(stage, stage),
            "n_samples":               m.get("n_samples"),
            "accuracy":                m.get("accuracy"),
            "precision_macro":         m.get("precision_macro"),
            "recall_macro":            m.get("recall_macro"),
            "f1_macro":                m.get("f1_macro"),
            "precision_weighted":      m.get("precision_weighted"),
            "recall_weighted":         m.get("recall_weighted"),
            "f1_weighted":             m.get("f1_weighted"),
            "avg_latency_ms_per_sample": m.get("avg_latency_ms_per_sample"),
        })
    if rows:
        p = OUT_DIR / "04_metrics_overall.csv"
        pd.DataFrame(rows).to_csv(p, index=False, encoding="utf-8")
        written.append(p)
        print(f"[SAVE] {p.name}")

    # Per-class table
    per_rows: list[dict] = []
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        for l in LABELS:
            d = m.get(f"per_{l}", {})
            per_rows.append({
                "stage":     STAGE_LABELS.get(stage, stage),
                "class":     l,
                "support":   d.get("support"),
                "precision": d.get("precision"),
                "recall":    d.get("recall"),
                "f1":        d.get("f1"),
            })
    if per_rows:
        p = OUT_DIR / "04_metrics_per_class.csv"
        pd.DataFrame(per_rows).to_csv(p, index=False, encoding="utf-8")
        written.append(p)
        print(f"[SAVE] {p.name}")

    return written


# ─────────────────────────────────────────────────────────────────────────────
# 10. MARKDOWN REPORT  (Capstone-doc ready)
# ─────────────────────────────────────────────────────────────────────────────
def _fmt_pct(x: float | None) -> str:
    return "N/A" if x is None else f"{x * 100:.2f}%"

def _fmt(x: float | None, n: int = 4) -> str:
    return "N/A" if x is None else f"{x:.{n}f}"


def generate_markdown_report(
    report:          dict,
    analysis:        dict,
    misclass:        dict,
    recommendations: list[dict],
    csvs:            list[Path],
) -> Path:
    meta       = report.get("meta", {})
    m_ft       = report.get("finetuned")
    m_base     = report.get("base")
    m_keyword  = report.get("keyword")

    L: list[str] = []

    L.append("# AI Model Evaluation — Phase 3.2 Report")
    L.append("")
    L.append("> **Rise On AI · Capstone 2**  ")
    L.append(f"> Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
    L.append("")
    L.append("---")
    L.append("")

    # ── 1. Setup ──────────────────────────────────────────────────────────────
    L.append("## 1. Evaluation Setup")
    L.append("")
    L.append(f"| Item | Value |")
    L.append(f"|------|-------|")
    L.append(f"| Random seed (reproducibility) | `{RANDOM_SEED}` |")
    L.append(f"| Dataset split used | **TEST ONLY** — never seen during training |")
    L.append(f"| Test samples (N) | `{meta.get('test_size', 'N/A')}` |")
    L.append(f"| Label distribution | `{json.dumps(meta.get('label_distribution', {}))}` |")
    L.append(f"| Number of classes | 3 (Positive / Negative / Distress) |")
    L.append(f"| Languages | English, Filipino (Tagalog), Taglish |")
    L.append(f"| Base model (HF) | `{meta.get('base_model_name', 'FacebookAI/xlm-roberta-base')}` |")
    L.append("")

    # ── 2. Overall comparison ─────────────────────────────────────────────────
    L.append("## 2. Overall Metrics Comparison")
    L.append("")
    L.append("Three models are compared on the **same** held-out test set:")
    L.append("")
    L.append("| Stage | N | Accuracy | Prec (Macro) | Rec (Macro) | F1 (Macro) | F1 (Weighted) | Avg Latency |")
    L.append("|-------|---|----------|--------------|-------------|------------|---------------|-------------|")
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        lat = m.get("avg_latency_ms_per_sample")
        lat_str = f"{lat:.2f} ms" if lat is not None else "N/A"
        L.append(
            f"| {STAGE_LABELS[stage]} | {m.get('n_samples')} "
            f"| {_fmt_pct(m.get('accuracy'))} "
            f"| {_fmt_pct(m.get('precision_macro'))} "
            f"| {_fmt_pct(m.get('recall_macro'))} "
            f"| {_fmt_pct(m.get('f1_macro'))} "
            f"| {_fmt_pct(m.get('f1_weighted'))} "
            f"| {lat_str} |"
        )
    L.append("")
    L.append("> Charts: `04_comparison_overall.png` · `04_comparison_perclass_f1.png`")
    L.append("")

    # ── 3. Per-class metrics ──────────────────────────────────────────────────
    L.append("## 3. Per-Class Metrics")
    L.append("")
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        L.append(f"### {STAGE_LABELS[stage]}")
        L.append("")
        L.append("| Class | Support | Precision | Recall | F1 |")
        L.append("|-------|---------|-----------|--------|----|")
        for l in LABELS:
            d = m.get(f"per_{l}", {})
            L.append(
                f"| {l.capitalize()} "
                f"| {d.get('support', 'N/A')} "
                f"| {_fmt_pct(d.get('precision'))} "
                f"| {_fmt_pct(d.get('recall'))} "
                f"| {_fmt_pct(d.get('f1'))} |"
            )
        L.append("")

    # ── 4. Confusion matrices ─────────────────────────────────────────────────
    L.append("## 4. Confusion Matrices")
    L.append("")
    for stage, label, png in [
        ("keyword",   "Keyword Baseline",        "04_confusion_matrix_keyword.png"),
        ("base",      "XLM-R Base (pre-trained)","04_confusion_matrix_base.png"),
        ("finetuned", "XLM-R Fine-tuned",         "04_confusion_matrix_finetuned.png"),
    ]:
        m = report.get(stage)
        if not m:
            continue
        cm = m.get("confusion_matrix") or []
        L.append(f"### {label}")
        L.append("")
        L.append("| Actual \\ Predicted | Positive | Negative | Distress |")
        L.append("|--------------------|----------|----------|----------|")
        for i, lbl in enumerate(LABELS):
            row = cm[i] if i < len(cm) else [0, 0, 0]
            L.append(f"| {lbl.capitalize()} | {row[0] if len(row)>0 else 0} | {row[1] if len(row)>1 else 0} | {row[2] if len(row)>2 else 0} |")
        L.append("")
        L.append(f"> PNG: `{png}`")
        L.append("")

    # ── 5. Lowest performing class ────────────────────────────────────────────
    L.append("## 5. Lowest Performing Class (Fine-Tuned Model)")
    L.append("")
    if analysis:
        L.append(f"| Metric | Class | Score |")
        L.append(f"|--------|-------|-------|")
        L.append(f"| Lowest F1        | `{analysis['lowest_f1']['class']}`        | {analysis['lowest_f1']['value']:.4f} |")
        L.append(f"| Lowest Recall    | `{analysis['lowest_recall']['class']}`    | {analysis['lowest_recall']['value']:.4f} |")
        L.append(f"| Lowest Precision | `{analysis['lowest_precision']['class']}` | {analysis['lowest_precision']['value']:.4f} |")
        L.append("")
        imbalance_flag = "⚠️ IMBALANCED" if analysis.get("flag_imbalance") else "✅ ACCEPTABLE"
        L.append(f"**Test-set support distribution:** `{analysis.get('supports', {})}` → {imbalance_flag}")
        L.append(f"  (min/max support ratio = {analysis.get('support_ratio_min_to_max', 'N/A')})")
    L.append("")

    # ── 6. Misclassification analysis ────────────────────────────────────────
    L.append("## 6. Misclassification Analysis (Fine-Tuned)")
    L.append("")
    if misclass:
        L.append(f"- Total errors: **{misclass.get('total_errors', 0)}**")
        L.append(f"- Average length of misclassified texts: **{misclass.get('error_text_avg_length_chars', 'N/A')} chars**")
        kw = misclass.get("common_keywords_in_errors", [])
        if kw:
            L.append(f"- Common words in errors: {', '.join(kw[:8])}")
        L.append("")
        L.append("### 6.1 Top Confusion Pairs")
        L.append("")
        pairs = misclass.get("top_misclassification_pairs") or []
        if pairs:
            L.append("| Rank | Actual → Predicted | Count | Possible Cause |")
            L.append("|------|--------------------|-------|----------------|")
            causes = {
                ("negative",  "distress"): "Overlap in depressive / hopeless language",
                ("distress",  "negative"): "Subtle distress cues misread as general sadness",
                ("positive",  "negative"): "Sarcasm or mixed-sentiment entries",
                ("negative",  "positive"): "Hopeful ending overrides negative body text",
                ("distress",  "positive"): "Rare — check for label noise",
                ("positive",  "distress"): "Rare — check for label noise",
            }
            for rank, p in enumerate(pairs, 1):
                cause = causes.get((p.get("true_label"), p.get("predicted_label")), "Review error CSV")
                L.append(f"| {rank} | {p.get('true_label')} → {p.get('predicted_label')} | {p.get('count')} | {cause} |")
        L.append("")
    L.append("> Full misclassified rows: `04_errors_keyword.csv`, `04_errors_base.csv`, `04_errors_finetuned.csv`")
    L.append("")

    # ── 7. Recommendations ───────────────────────────────────────────────────
    L.append("## 7. Recommendations (Data-Driven)")
    L.append("")
    for i, r in enumerate(recommendations, 1):
        L.append(f"### 7.{i} `[{r.get('priority')}]` {r.get('category')} — {r.get('title')}")
        L.append("")
        L.append(f"> {r.get('recommendation')}")
        L.append("")

    # ── 8. Artifacts ──────────────────────────────────────────────────────────
    L.append("## 8. Saved Artifacts")
    L.append("")
    artifacts = [
        ("04_evaluation_report.json",        "Full structured metrics (JSON)"),
        ("04_evaluation_report.md",           "This report (Markdown)"),
        ("04_metrics_overall.csv",            "Overall / macro / weighted table (CSV)"),
        ("04_metrics_per_class.csv",          "Per-class precision/recall/F1 table (CSV)"),
        ("04_comparison_overall.png",         "3-way overall metrics bar chart"),
        ("04_comparison_perclass_f1.png",     "Per-class F1 bar chart"),
        ("04_confusion_matrix_keyword.png",   "Confusion matrix — Keyword Baseline"),
        ("04_confusion_matrix_base.png",      "Confusion matrix — XLM-R Base"),
        ("04_confusion_matrix_finetuned.png", "Confusion matrix — Fine-tuned model"),
        ("04_errors_keyword.csv",             "Misclassified samples — Keyword Baseline"),
        ("04_errors_base.csv",                "Misclassified samples — XLM-R Base"),
        ("04_errors_finetuned.csv",           "Misclassified samples — Fine-tuned model"),
    ]
    L.append("| File | Description |")
    L.append("|------|-------------|")
    for fname, desc in artifacts:
        L.append(f"| `{fname}` | {desc} |")
    L.append("")
    L.append("---")
    L.append("_End of Phase 3.2 Evaluation Report — Rise On AI Capstone 2._")

    out_path = OUT_DIR / "04_evaluation_report.md"
    out_path.write_text("\n".join(L), encoding="utf-8")
    print(f"[SAVE] {out_path.name}")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# 11. MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Phase 3.2: Reproducible AI evaluation — Keyword / Base / Fine-tuned"
    )
    parser.add_argument(
        "--model",
        default=str(OUT_DIR / "best_model"),
        help="Path to fine-tuned model folder (default: outputs/best_model/)",
    )
    parser.add_argument(
        "--base-model",
        default="FacebookAI/xlm-roberta-base",
        help="HF model ID for base pre-trained comparison",
    )
    parser.add_argument("--max-len",      type=int, default=256)
    parser.add_argument("--skip-keyword", action="store_true",
                        help="Skip keyword baseline evaluation")
    parser.add_argument("--skip-base",    action="store_true",
                        help="Skip base XLM-R (pre-trained, no fine-tuning) evaluation")
    args = parser.parse_args()

    # ── Seed ──────────────────────────────────────────────────────────────────
    set_global_seed(RANDOM_SEED)

    # ── Load test split ───────────────────────────────────────────────────────
    test_csv = DATA_DIR / "test.csv"
    if not test_csv.exists():
        print(f"[ERROR] {test_csv} not found. Run 01_prepare_dataset.py first.")
        sys.exit(1)

    df      = pd.read_csv(test_csv)
    df["text"] = df["text"].map(preprocess)
    df      = df[df["text"].str.len() > 0].reset_index(drop=True)
    y_true  = list(df["label"].astype(str))
    texts   = list(df["text"].astype(str))
    label_dist = {l: int(y_true.count(l)) for l in LABELS}

    print(f"\n[TEST SET] N={len(df)} | Distribution: {label_dist}")

    report: dict = {
        "meta": {
            "test_size": len(df),
            "label_distribution": label_dist,
            "dataset_split": "TEST ONLY",
            "random_seed": RANDOM_SEED,
            "base_model_name": args.base_model,
            "evaluation_date": pd.Timestamp.now().isoformat(),
        }
    }
    metrics_map: dict[str, dict] = {}

    # ── Stage 1: Keyword baseline ─────────────────────────────────────────────
    if not args.skip_keyword:
        print("\n" + "─"*60)
        print("▶  STAGE 1 / 3 — Keyword Baseline  (no ML)")
        print("─"*60)
        t0 = time.perf_counter()
        y_pred_kw = [keyword_predict(t) for t in tqdm(texts, desc="Keyword")]
        lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
        m_kw = compute_full_metrics(y_true, y_pred_kw)
        m_kw["avg_latency_ms_per_sample"] = round(lat_ms, 4)
        report["keyword"]    = m_kw
        metrics_map["keyword"] = m_kw
        print(f"   Accuracy : {m_kw['accuracy']:.4f}")
        print(f"   F1 Macro : {m_kw['f1_macro']:.4f}")
        plot_confusion_matrix(
            m_kw["confusion_matrix"],
            "Confusion Matrix — Keyword Baseline",
            OUT_DIR / "04_confusion_matrix_keyword.png",
        )
        save_error_csv(df, y_true, y_pred_kw, "04_errors_keyword.csv")

    # ── Stage 2: XLM-R Base (pre-trained, random head) ───────────────────────
    if not args.skip_base:
        print("\n" + "─"*60)
        print(f"▶  STAGE 2 / 3 — XLM-R Base (pre-trained, random head)")
        print("─"*60)
        try:
            base_predictor = HFPredictor(
                model_name_or_path=args.base_model,
                label_name="XLM-R Base",
                max_seq_len=args.max_len,
                random_head=True,
            )
            t0 = time.perf_counter()
            y_pred_base = base_predictor.predict_many(texts)
            lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
            m_base = compute_full_metrics(y_true, y_pred_base)
            m_base["avg_latency_ms_per_sample"] = round(lat_ms, 4)
            report["base"]      = m_base
            metrics_map["base"] = m_base
            print(f"   Accuracy : {m_base['accuracy']:.4f}")
            print(f"   F1 Macro : {m_base['f1_macro']:.4f}")
            plot_confusion_matrix(
                m_base["confusion_matrix"],
                "Confusion Matrix — XLM-R Base (pre-trained, random head)",
                OUT_DIR / "04_confusion_matrix_base.png",
            )
            save_error_csv(df, y_true, y_pred_base, "04_errors_base.csv")
            del base_predictor   # free memory before loading fine-tuned
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception as exc:
            print(f"[WARN] Base model evaluation failed: {exc}")
            import traceback; traceback.print_exc()

    # ── Stage 3: Fine-tuned XLM-RoBERTa ──────────────────────────────────────
    model_path = Path(args.model)
    has_weights = (
        (model_path / "model.safetensors").exists()
        or (model_path / "pytorch_model.bin").exists()
    )

    m_ft:  dict | None = None
    err_ft: pd.DataFrame | None = None

    if has_weights:
        print("\n" + "─"*60)
        print("▶  STAGE 3 / 3 — Fine-tuned XLM-RoBERTa")
        print("─"*60)
        ft_predictor = HFPredictor(
            model_name_or_path=str(model_path),
            label_name="XLM-R Fine-tuned",
            max_seq_len=args.max_len,
            random_head=False,
        )
        t0 = time.perf_counter()
        y_pred_ft = ft_predictor.predict_many(texts)
        lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
        m_ft = compute_full_metrics(y_true, y_pred_ft)
        m_ft["avg_latency_ms_per_sample"] = round(lat_ms, 4)
        report["finetuned"]      = m_ft
        metrics_map["finetuned"] = m_ft
        print(f"   Accuracy : {m_ft['accuracy']:.4f}")
        print(f"   F1 Macro : {m_ft['f1_macro']:.4f}")
        plot_confusion_matrix(
            m_ft["confusion_matrix"],
            "Confusion Matrix — XLM-R Fine-tuned",
            OUT_DIR / "04_confusion_matrix_finetuned.png",
        )
        err_ft = save_error_csv(df, y_true, y_pred_ft, "04_errors_finetuned.csv")

        # ── Improvement summary ────────────────────────────────────────────────
        print("\n" + "═"*60)
        print("  IMPROVEMENT SUMMARY  (relative to keyword baseline & base model)")
        print("═"*60)
        keys = ["accuracy", "precision_macro", "recall_macro", "f1_macro",
                "precision_weighted", "recall_weighted", "f1_weighted"]
        hdr  = f"  {'Metric':<24}  {'Keyword':>8}  {'Base':>8}  {'Fine-tuned':>10}  {'Δ vs Base':>10}"
        print(hdr)
        print("  " + "─" * (len(hdr) - 2))
        for k in keys:
            ft_val = m_ft.get(k, 0.0)
            kw_val = report.get("keyword", {}).get(k)
            bm_val = report.get("base",    {}).get(k)
            kw_s   = f"{kw_val:.3f}" if kw_val is not None else "  N/A"
            bm_s   = f"{bm_val:.3f}" if bm_val is not None else "  N/A"
            delta  = ft_val - bm_val if bm_val is not None else None
            dlt_s  = (("+" if delta >= 0 else "") + f"{100*delta:.2f} pp") if delta is not None else "  N/A"
            print(f"  {k:<24}  {kw_s:>8}  {bm_s:>8}  {ft_val:>10.3f}  {dlt_s:>10}")
        print("═"*60 + "\n")

    else:
        print(f"[WARN] No fine-tuned model weights at {model_path} — skipping Stage 3.")
        print("        Run 02_finetune_xlmroberta.py first, then re-run this script.")

    # ── Comparison charts ─────────────────────────────────────────────────────
    if len(metrics_map) >= 2:
        plot_comparison_overall(
            metrics_map,
            OUT_DIR / "04_comparison_overall.png",
        )
        plot_comparison_perclass_f1(
            metrics_map,
            OUT_DIR / "04_comparison_perclass_f1.png",
        )

    # ── Analysis + recommendations (fine-tuned) ───────────────────────────────
    analysis: dict = {}
    misclass: dict = {}
    recs: list[dict] = []

    if m_ft is not None:
        analysis = identify_lowest_performing_class(m_ft)
        misclass = analyze_misclassifications(err_ft, m_ft.get("confusion_matrix") or [[0]*3]*3)
        recs     = generate_recommendations(m_ft, analysis, misclass, label_dist)

        print("─"*60)
        print("📊 LOWEST PERFORMING CLASS (Fine-tuned):")
        print(f"   Lowest F1        → {analysis['lowest_f1']['class']:<12} {analysis['lowest_f1']['value']:.4f}")
        print(f"   Lowest Recall    → {analysis['lowest_recall']['class']:<12} {analysis['lowest_recall']['value']:.4f}")
        print(f"   Lowest Precision → {analysis['lowest_precision']['class']:<12} {analysis['lowest_precision']['value']:.4f}")
        print(f"   Imbalance flag   → {analysis.get('flag_imbalance')}")
        print("")
        print("🔎 TOP MISCLASSIFICATION PAIRS:")
        for p in (misclass.get("top_misclassification_pairs") or [])[:3]:
            print(f"   • {p.get('description')}  (N={p.get('count')})")
        print("")
        print("💡 RECOMMENDATIONS:")
        for r in recs:
            print(f"   [{r.get('priority')}] {r.get('title')}")
        print("─"*60)

    report["analysis"]                 = analysis
    report["misclassification_analysis"] = misclass
    report["recommendations"]          = recs

    # ── Save all artifacts ────────────────────────────────────────────────────
    print("\n[SAVING ARTIFACTS]")
    csvs_written = save_metrics_csvs(report)
    md_path = None
    if m_ft is not None or metrics_map:
        md_path = generate_markdown_report(report, analysis, misclass, recs, csvs_written)

    report_path = OUT_DIR / "04_evaluation_report.json"
    report_path.write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"[SAVE] {report_path.name}")

    # ── Final artifact summary ────────────────────────────────────────────────
    print("\n" + "═"*70)
    print("📂  EVALUATION ARTIFACTS  (outputs/ directory)")
    print("═"*70)
    print(f"  JSON Report                : 04_evaluation_report.json")
    if md_path:
        print(f"  Markdown Report (Capstone) : 04_evaluation_report.md")
    for p in csvs_written:
        print(f"  CSV Table                  : {p.name}")
    for png in [
        "04_confusion_matrix_keyword.png",
        "04_confusion_matrix_base.png",
        "04_confusion_matrix_finetuned.png",
        "04_comparison_overall.png",
        "04_comparison_perclass_f1.png",
    ]:
        if (OUT_DIR / png).exists():
            print(f"  Plot                       : {png}")
    print("═"*70)
    print("\nPhase 3.2 evaluation complete.")


if __name__ == "__main__":
    main()
