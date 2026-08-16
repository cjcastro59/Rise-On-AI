"""
================================================================
05_evaluate_standalone.py  —  Phase 3.2
STANDALONE Evaluation Script
================================================================

PURPOSE
───────
This script is a self-contained evaluation runner that needs only:
  1. A test CSV   (data/test.csv  OR  any CSV with 'text' + 'label' columns)
  2. A fine-tuned model folder  (outputs/best_model/)

It does NOT require the training pipeline to have been run in this
session. It does NOT import from the other pipeline scripts.
Use this when:
  • You only want to re-evaluate after model updates
  • You want to evaluate on a DIFFERENT test set (e.g., real user data)
  • You're running on a machine that only has the model, not the training env
  • You want a quick sanity-check without the full pipeline

WHAT IT PRODUCES
────────────────
All outputs land in the same  outputs/  directory as 04_evaluate_model.py:
  05_eval_report.json              Full structured metrics
  05_eval_report.md                Markdown report (Capstone-ready)
  05_metrics_overall.csv           Overall / macro / weighted table
  05_metrics_per_class.csv         Per-class precision / recall / F1
  05_confusion_matrix_keyword.png
  05_confusion_matrix_base.png     (if --compare-base, default: ON)
  05_confusion_matrix_finetuned.png
  05_comparison_overall.png        3-way bar chart
  05_comparison_perclass_f1.png    Per-class F1 bar chart
  05_errors_keyword.csv
  05_errors_base.csv               (if --compare-base)
  05_errors_finetuned.csv

USAGE
─────
  # Evaluate with defaults (uses outputs/best_model/ and data/test.csv)
  python 05_evaluate_standalone.py

  # Custom paths
  python 05_evaluate_standalone.py --model path/to/model --test path/to/test.csv

  # Skip base model download (faster, no internet needed)
  python 05_evaluate_standalone.py --skip-base

  # Supply a completely different dataset for evaluation
  python 05_evaluate_standalone.py --test path/to/real_user_data.csv

REQUIREMENTS
────────────
  pip install torch transformers scikit-learn pandas numpy matplotlib seaborn tqdm
  (All already in requirements.txt — no extra installs needed)
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
matplotlib.use("Agg")
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
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR  = BASE_DIR / "outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)

LABELS    = ["positive", "negative", "distress"]
LABEL2IDX = {l: i for i, l in enumerate(LABELS)}
IDX2LABEL = {i: l for l, i in LABEL2IDX.items()}

# Column name aliases accepted in the input CSV
_TEXT_COLS  = ["text", "content", "sentence", "message", "entry"]
_LABEL_COLS = ["label", "sentiment", "target", "class", "category"]

RANDOM_SEED = 42

STAGE_LABELS = {
    "keyword":   "Keyword Baseline",
    "base":      "XLM-R Base (pre-trained)",
    "finetuned": "XLM-R Fine-tuned",
}

# ─────────────────────────────────────────────────────────────────────────────
# REPRODUCIBILITY
# ─────────────────────────────────────────────────────────────────────────────
def lock_seed(seed: int = RANDOM_SEED) -> None:
    import random as _r
    _r.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    if torch.cuda.is_available():
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark     = False


lock_seed()

# ─────────────────────────────────────────────────────────────────────────────
# PLOT STYLE
# ─────────────────────────────────────────────────────────────────────────────
sns.set_theme(style="whitegrid", palette="Set2")
plt.rcParams["figure.dpi"] = 140

# ─────────────────────────────────────────────────────────────────────────────
# PREPROCESSING  (must match training-time and Next.js 1-for-1)
# ─────────────────────────────────────────────────────────────────────────────
_URL_RE   = re.compile(r"https?://[^\s]+")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_HTML_RE  = re.compile(r"<[^>]*>")
_WS_RE    = re.compile(r"\s+")

# Label normalisation: all accepted aliases → canonical label name
_LABEL_NORM: dict[str, str] = {
    # positive
    "positive": "positive", "pos": "positive", "good": "positive",
    "happy": "positive", "masaya": "positive", "joy": "positive", "0": "positive",
    # negative
    "negative": "negative", "neg": "negative", "bad": "negative",
    "sad": "negative", "malungkot": "negative", "1": "negative",
    # distress
    "distress": "distress", "dst": "distress", "crisis": "distress",
    "suicidal": "distress", "danger": "distress", "emergency": "distress",
    "critical": "distress", "2": "distress",
}


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


def normalise_label(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip().lower()
    return _LABEL_NORM.get(s)


# ─────────────────────────────────────────────────────────────────────────────
# DATASET LOADER  (flexible — handles any CSV with text + label columns)
# ─────────────────────────────────────────────────────────────────────────────
def load_eval_csv(path: Path) -> pd.DataFrame:
    """
    Load a CSV/JSONL file as an evaluation dataset.
    Accepts any column names from _TEXT_COLS / _LABEL_COLS aliases.
    Returns a clean DataFrame with exactly two columns: 'text', 'label'.
    """
    suffix = path.suffix.lower()
    if suffix in (".csv",):
        df = pd.read_csv(path)
    elif suffix in (".jsonl",):
        df = pd.read_json(path, lines=True)
    elif suffix in (".json",):
        df = pd.read_json(path)
    else:
        raise ValueError(f"Unsupported file type: {suffix!r}. Use .csv or .jsonl")

    # Detect text column
    tcol = next((c for c in _TEXT_COLS if c in df.columns), None)
    lcol = next((c for c in _LABEL_COLS if c in df.columns), None)

    if tcol is None:
        raise ValueError(
            f"No recognised text column found. Got: {list(df.columns)}\n"
            f"Rename your text column to one of: {_TEXT_COLS}"
        )
    if lcol is None:
        raise ValueError(
            f"No recognised label column found. Got: {list(df.columns)}\n"
            f"Rename your label column to one of: {_LABEL_COLS}"
        )

    df = df[[tcol, lcol]].copy()
    df.columns = ["text", "label"]

    # Preprocess text
    df["text"] = df["text"].map(preprocess)

    # Normalise labels
    df["label"] = df["label"].map(normalise_label)
    n_invalid = df["label"].isna().sum()
    if n_invalid:
        print(f"[WARN] Dropping {n_invalid} rows with unrecognised labels.")
    df = df.dropna(subset=["label"])
    df = df[df["text"].str.len() > 0].reset_index(drop=True)

    counts = df["label"].value_counts().to_dict()
    print(f"[LOAD] {len(df)} samples from {path.name}  |  {counts}")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORD BASELINE
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
    t = preprocess(text).lower()
    if not t:
        return "positive"

    def hits(bag: set) -> int:
        return sum(1 for phrase in bag if phrase in t) + sum(
            1 for w in re.findall(r"[a-z]+", t) if w in bag
        )

    pos = hits(_POS_EN) + hits(_POS_TL)
    neg = hits(_NEG_EN) + hits(_NEG_TL)
    dst = hits(_DST_EN) + hits(_DST_TL)
    dst *= 2
    if dst >= 2 and dst >= pos and dst >= neg:
        return "distress"
    if neg > pos:
        return "negative"
    return "positive"


# ─────────────────────────────────────────────────────────────────────────────
# HF PREDICTOR  (shared for base + fine-tuned)
# ─────────────────────────────────────────────────────────────────────────────
def _best_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class HFPredictor:
    def __init__(
        self,
        model_name_or_path: str,
        stage_label: str,
        max_seq_len: int = 256,
        random_head: bool = False,
    ) -> None:
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        self.device      = _best_device()
        self.stage_label = stage_label
        self.max_seq_len = max_seq_len
        print(f"[LOAD] {stage_label}: {model_name_or_path}  (device={self.device})")

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name_or_path, use_fast=True
        )
        if random_head:
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

    @torch.inference_mode()
    def predict_many(self, texts: list[str], batch_size: int = 64) -> list[str]:
        lock_seed(RANDOM_SEED)
        preds: list[str] = []
        for i in tqdm(range(0, len(texts), batch_size), desc=self.stage_label):
            batch = texts[i : i + batch_size]
            enc = self.tokenizer(
                batch,
                return_tensors="pt",
                truncation=True,
                padding="max_length",
                max_length=self.max_seq_len,
            )
            enc    = {k: v.to(self.device) for k, v in enc.items()}
            logits = self.model(**enc).logits
            idxs   = logits.argmax(dim=-1).cpu().tolist()
            preds.extend(IDX2LABEL[i] for i in idxs)
        return preds


# ─────────────────────────────────────────────────────────────────────────────
# METRICS
# ─────────────────────────────────────────────────────────────────────────────
def compute_metrics(y_true: list[str], y_pred: list[str]) -> dict:
    yt = [LABEL2IDX[l] for l in y_true]
    yp = [LABEL2IDX[l] for l in y_pred]

    m: dict = {
        "n_samples":          len(yt),
        "accuracy":           float(accuracy_score(yt, yp)),
        "precision_macro":    float(precision_score(yt, yp, average="macro",    zero_division=0)),
        "recall_macro":       float(recall_score   (yt, yp, average="macro",    zero_division=0)),
        "f1_macro":           float(f1_score       (yt, yp, average="macro",    zero_division=0)),
        "precision_weighted": float(precision_score(yt, yp, average="weighted", zero_division=0)),
        "recall_weighted":    float(recall_score   (yt, yp, average="weighted", zero_division=0)),
        "f1_weighted":        float(f1_score       (yt, yp, average="weighted", zero_division=0)),
    }
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
    cm = confusion_matrix(yt, yp, labels=[LABEL2IDX[l] for l in LABELS])
    m["confusion_matrix"]          = cm.tolist()
    m["classification_report_raw"] = cr
    return m


# ─────────────────────────────────────────────────────────────────────────────
# PLOTS
# ─────────────────────────────────────────────────────────────────────────────
def _plot_confusion_matrix(cm: list, title: str, path: Path) -> None:
    arr = np.array(cm)
    plt.figure(figsize=(6, 5))
    ax  = sns.heatmap(
        arr, annot=True, fmt="d", cmap="Blues",
        xticklabels=LABELS, yticklabels=LABELS, cbar=True, square=True,
    )
    ax.set_xlabel("Predicted", fontsize=11)
    ax.set_ylabel("Actual",    fontsize=11)
    ax.set_title(title,        fontsize=12, pad=12)
    plt.tight_layout()
    plt.savefig(str(path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] {path.name}")


def _plot_overall(metrics_map: dict[str, dict], path: Path) -> None:
    mk    = ["accuracy", "precision_macro", "recall_macro", "f1_macro", "f1_weighted"]
    ml    = ["Accuracy", "Precision\n(Macro)", "Recall\n(Macro)", "F1\n(Macro)", "F1\n(Weighted)"]
    stgs  = [s for s in ("keyword", "base", "finetuned") if s in metrics_map]
    clrs  = {"keyword": "#C9B8E8", "base": "#88C7C1", "finetuned": "#F4A261"}
    w     = 0.22
    x     = np.arange(len(mk))
    n     = len(stgs)

    fig, ax = plt.subplots(figsize=(10, 5.5))
    for i, s in enumerate(stgs):
        vals   = [metrics_map[s].get(k, 0.0) for k in mk]
        offset = (i - (n - 1) / 2) * w
        bars   = ax.bar(x + offset, vals, w, label=STAGE_LABELS[s],
                        color=clrs[s], edgecolor="#555", linewidth=0.6)
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + w / 2, h + 0.012, f"{h:.2f}",
                    ha="center", va="bottom", fontsize=7.5)

    ax.set_ylabel("Score", fontsize=11)
    ax.set_title("Phase 3.2 — Model Comparison: Overall Metrics", fontsize=13, pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(ml, fontsize=9)
    ax.set_ylim(0, 1.15)
    ax.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(str(path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] {path.name}")


def _plot_perclass_f1(metrics_map: dict[str, dict], path: Path) -> None:
    stgs = [s for s in ("keyword", "base", "finetuned") if s in metrics_map]
    clrs = {"keyword": "#C9B8E8", "base": "#88C7C1", "finetuned": "#F4A261"}
    w    = 0.22
    x    = np.arange(len(LABELS))
    n    = len(stgs)

    fig, ax = plt.subplots(figsize=(8, 5))
    for i, s in enumerate(stgs):
        vals   = [metrics_map[s].get(f"per_{l}", {}).get("f1", 0.0) for l in LABELS]
        offset = (i - (n - 1) / 2) * w
        bars   = ax.bar(x + offset, vals, w, label=STAGE_LABELS[s],
                        color=clrs[s], edgecolor="#555", linewidth=0.6)
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + w / 2, h + 0.012, f"{h:.2f}",
                    ha="center", va="bottom", fontsize=8)

    ax.set_ylabel("F1-Score", fontsize=11)
    ax.set_title("Phase 3.2 — Per-Class F1-Score Comparison", fontsize=13, pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels([l.capitalize() for l in LABELS], fontsize=10)
    ax.set_ylim(0, 1.15)
    ax.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(str(path), bbox_inches="tight")
    plt.close()
    print(f"[PLOT] {path.name}")


# ─────────────────────────────────────────────────────────────────────────────
# ANALYSIS HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def save_errors(df: pd.DataFrame, y_true: list, y_pred: list, fname: str) -> pd.DataFrame:
    err             = df.copy()
    err["true"]     = list(y_true)
    err["predicted"]= list(y_pred)
    err             = err[err["true"] != err["predicted"]].reset_index(drop=True)
    err.to_csv(OUT_DIR / fname, index=False, encoding="utf-8")
    print(f"[SAVE] {len(err)} errors → {fname}")
    return err


def analyse_lowest(m: dict) -> dict:
    f1_map = {l: m.get(f"per_{l}", {}).get("f1",        0.0) for l in LABELS}
    rec_map = {l: m.get(f"per_{l}", {}).get("recall",    0.0) for l in LABELS}
    prec_map = {l: m.get(f"per_{l}", {}).get("precision", 0.0) for l in LABELS}
    sup_map  = {l: m.get(f"per_{l}", {}).get("support",   0  ) for l in LABELS}

    low_f1 = min(f1_map.items(),   key=lambda kv: kv[1])
    low_rec = min(rec_map.items(),  key=lambda kv: kv[1])
    low_prec = min(prec_map.items(), key=lambda kv: kv[1])
    max_sup = max(sup_map.values()) or 1
    min_sup = min(sup_map.values()) or 1

    return {
        "lowest_f1": {"class": low_f1[0],   "value": round(low_f1[1],   4)},
        "lowest_recall": {"class": low_rec[0],  "value": round(low_rec[1],  4)},
        "lowest_precision": {"class": low_prec[0], "value": round(low_prec[1], 4)},
        "supports": sup_map,
        "support_ratio_min_to_max": round(min_sup / max_sup, 3),
        "flag_imbalance": (min_sup / max_sup) < 0.5,
    }


def analyse_errors(errors_df: pd.DataFrame | None, cm: list) -> dict:
    pairs: list[dict] = []
    arr = np.array(cm, dtype=int)
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            if i != j and arr[i, j] > 0:
                pairs.append({
                    "true_label": LABELS[i],
                    "predicted_label":  LABELS[j],
                    "count": int(arr[i, j]),
                    "description": f"True '{LABELS[i]}' predicted as '{LABELS[j]}'",
                })
    pairs.sort(key=lambda x: x["count"], reverse=True)

    avg_len: float = 0.0
    common_kw: list[str] = []
    if errors_df is not None and len(errors_df) > 0 and "text" in errors_df.columns:
        lens = [len(str(x)) for x in errors_df["text"]]
        avg_len = round(float(np.mean(lens)), 1) if lens else 0.0
        raw = " ".join(str(x).lower() for x in errors_df["text"])
        words = re.findall(r"[a-z]+", raw)
        STOP = {
            "ang","the","ng","ko","na","i","you","me","to","a","sa","is","it",
            "of","and","or","but","in","on","my","that","this","not","no","yes",
            "so","very","too","with","for","from","at","by","as","an","be","are",
            "was","were","naman","lang","yung","kasi","pero",
        }
        freq    = Counter(w for w in words if w not in STOP and len(w) > 2)
        common_kw = [w for w, _ in freq.most_common(12)]

    return {
        "total_errors": int(len(errors_df)) if errors_df is not None else 0,
        "top_misclassification_pairs": pairs[:6],
        "error_text_avg_length_chars": avg_len,
        "common_keywords_in_errors": common_kw,
    }


def build_recommendations(m_ft: dict, analysis: dict, misclass: dict) -> list[dict]:
    recs: list[dict] = []

    # Safety-critical: distress recall
    dst_rec = m_ft.get("per_distress", {}).get("recall", 1.0)
    if dst_rec < 0.85:
        recs.append({
            "priority": "CRITICAL",
            "category": "SAFETY",
            "title": f"Distress Recall = {dst_rec:.4f} (threshold: 0.85)",
            "recommendation": (
                "Low distress recall means at-risk users may not be flagged. "
                "Actions: (1) add ≥200 real distress samples to training set, "
                "(2) raise distress class weight in loss function (×1.5–2.0), "
                "(3) lower production inference threshold for 'distress'."
            ),
        })

    # Lowest F1 class
    low_f1 = analysis.get("lowest_f1", {})
    if low_f1.get("value", 1.0) < 0.70:
        recs.append({
            "priority": "HIGH",
            "category": "DATA",
            "title": f"Class '{low_f1['class']}' F1 = {low_f1['value']:.4f}",
            "recommendation": (
                f"Collect more labelled examples for class '{low_f1['class']}'. "
                "Techniques: back-translation, synonym replacement, crowd-sourcing."
            ),
        })

    # Class imbalance
    if analysis.get("flag_imbalance"):
        recs.append({
            "priority": "MEDIUM",
            "category": "BALANCING",
            "title": f"Test-set imbalance (min/max ratio = {analysis.get('support_ratio_min_to_max')})",
            "recommendation": (
                "Apply stratified splits, weighted random sampler, or focal loss. "
                "Ensure training set is balanced before the next fine-tuning run."
            ),
        })

    # Top confusion pair
    top = (misclass.get("top_misclassification_pairs") or [{}])[0]
    if top:
        n = top.get("count", 0)
        recs.append({
            "priority": "HIGH" if n >= 5 else "MEDIUM",
            "category":"ERROR ANALYSIS",
            "title": f"Top confusion: {top.get('description')} (N={n})",
            "recommendation": (
                f"Review 05_errors_finetuned.csv rows where true='{top.get('true_label')}' "
                f"is predicted as '{top.get('predicted_label')}'. "
                "Common fix: add contrastive training examples at the class boundary."
            ),
        })

    # Short misclassified texts
    avg = misclass.get("error_text_avg_length_chars", 0)
    if avg and 0 < avg < 40:
        recs.append({
            "priority": "LOW",
            "category":"DATA QUALITY",
            "title": f"Short misclassified texts (avg {avg} chars)",
            "recommendation": (
                "Short texts lack context. Enforce a minimum length in the app, "
                "or use a keyword fallback for inputs shorter than 20 chars."
            ),
        })

    if not recs:
        recs.append({
            "priority":       "LOW",
            "category":       "GENERAL",
            "title":          "All metrics are within acceptable range",
            "recommendation": "Monitor production errors and retrain on new gold-labelled data.",
        })
    return recs


# ─────────────────────────────────────────────────────────────────────────────
# CSV TABLES
# ─────────────────────────────────────────────────────────────────────────────
def save_csvs(report: dict) -> list[Path]:
    out: list[Path] = []

    # Overall
    rows = []
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        rows.append({
            "stage": STAGE_LABELS.get(stage, stage),
            "n_samples": m.get("n_samples"),
            "accuracy": m.get("accuracy"),
            "precision_macro":  m.get("precision_macro"),
            "recall_macro": m.get("recall_macro"),
            "f1_macro":  m.get("f1_macro"),
            "precision_weighted":  m.get("precision_weighted"),
            "recall_weighted": m.get("recall_weighted"),
            "f1_weighted": m.get("f1_weighted"),
            "avg_latency_ms_per_sample": m.get("avg_latency_ms_per_sample"),
        })
    if rows:
        p = OUT_DIR / "05_metrics_overall.csv"
        pd.DataFrame(rows).to_csv(p, index=False, encoding="utf-8")
        out.append(p)
        print(f"[SAVE] {p.name}")

    # Per-class
    per_rows = []
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        for l in LABELS:
            d = m.get(f"per_{l}", {})
            per_rows.append({
                "stage": STAGE_LABELS.get(stage, stage),
                "class": l,
                "support": d.get("support"),
                "precision": d.get("precision"),
                "recall": d.get("recall"),
                "f1": d.get("f1"),
            })
    if per_rows:
        p = OUT_DIR / "05_metrics_per_class.csv"
        pd.DataFrame(per_rows).to_csv(p, index=False, encoding="utf-8")
        out.append(p)
        print(f"[SAVE] {p.name}")

    return out


# ─────────────────────────────────────────────────────────────────────────────
# MARKDOWN REPORT
# ─────────────────────────────────────────────────────────────────────────────
def _pct(x: float | None) -> str:
    return "N/A" if x is None else f"{x * 100:.2f}%"


def build_markdown(
    report: dict,
    analysis: dict,
    misclass: dict,
    recs: list[dict],
    csvs: list[Path],
    test_path: Path,
) -> Path:
    meta = report.get("meta", {})
    m_ft = report.get("finetuned")
    L: list[str] = []

    L.append("# AI Model Evaluation — Phase 3.2 Report (Standalone)")
    L.append("")
    L.append("> **Rise On AI · Capstone 2**  ")
    L.append(f"> Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
    L.append(f"> Evaluation dataset: `{test_path.name}`")
    L.append("")
    L.append("---")
    L.append("")

    # Setup
    L.append("## 1. Evaluation Setup")
    L.append("")
    L.append("| Item | Value |")
    L.append("|------|-------|")
    L.append(f"| Random seed | `{RANDOM_SEED}` |")
    L.append(f"| Dataset | `{test_path.name}` (TEST ONLY — not used in training) |")
    L.append(f"| Test samples (N) | `{meta.get('test_size', 'N/A')}` |")
    L.append(f"| Label distribution | `{json.dumps(meta.get('label_distribution', {}))}` |")
    L.append(f"| Classes | 3 — Positive / Negative / Distress |")
    L.append(f"| Languages | English, Filipino (Tagalog), Taglish |")
    L.append(f"| Base model | `{meta.get('base_model_name', 'FacebookAI/xlm-roberta-base')}` |")
    L.append("")

    # Overall comparison
    L.append("## 2. Overall Metrics Comparison")
    L.append("")
    L.append("| Stage | N | Accuracy | Prec (Macro) | Rec (Macro) | F1 (Macro) | F1 (Weighted) | Latency |")
    L.append("|-------|---|----------|--------------|-------------|------------|---------------|---------|")
    for stage in ("keyword", "base", "finetuned"):
        m = report.get(stage)
        if not m:
            continue
        lat = m.get("avg_latency_ms_per_sample")
        lat_s = f"{lat:.3f} ms" if lat is not None else "N/A"
        L.append(
            f"| {STAGE_LABELS[stage]} | {m.get('n_samples')} "
            f"| {_pct(m.get('accuracy'))} "
            f"| {_pct(m.get('precision_macro'))} "
            f"| {_pct(m.get('recall_macro'))} "
            f"| {_pct(m.get('f1_macro'))} "
            f"| {_pct(m.get('f1_weighted'))} "
            f"| {lat_s} |"
        )
    L.append("")

    # Per-class metrics
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
                f"| {_pct(d.get('precision'))} "
                f"| {_pct(d.get('recall'))} "
                f"| {_pct(d.get('f1'))} |"
            )
        L.append("")

    # Confusion matrices (text form)
    L.append("## 4. Confusion Matrices")
    L.append("")
    for stage, title, png in [
        ("keyword",   "Keyword Baseline",        "05_confusion_matrix_keyword.png"),
        ("base",      "XLM-R Base (pre-trained)","05_confusion_matrix_base.png"),
        ("finetuned", "XLM-R Fine-tuned",         "05_confusion_matrix_finetuned.png"),
    ]:
        m = report.get(stage)
        if not m:
            continue
        cm = m.get("confusion_matrix") or []
        L.append(f"### {title}")
        L.append("")
        L.append("| Actual \\ Predicted | Positive | Negative | Distress |")
        L.append("|--------------------|----------|----------|----------|")
        for i, lbl in enumerate(LABELS):
            row = cm[i] if i < len(cm) else [0, 0, 0]
            L.append(f"| {lbl.capitalize()} | {row[0] if len(row)>0 else 0} | {row[1] if len(row)>1 else 0} | {row[2] if len(row)>2 else 0} |")
        L.append("")
        L.append(f"> PNG: `{png}`")
        L.append("")

    # Lowest performing class
    L.append("## 5. Lowest Performing Class (Fine-Tuned)")
    L.append("")
    if analysis:
        L.append("| Metric | Class | Score |")
        L.append("|--------|-------|-------|")
        L.append(f"| Lowest F1        | `{analysis['lowest_f1']['class']}`        | {analysis['lowest_f1']['value']:.4f} |")
        L.append(f"| Lowest Recall    | `{analysis['lowest_recall']['class']}`    | {analysis['lowest_recall']['value']:.4f} |")
        L.append(f"| Lowest Precision | `{analysis['lowest_precision']['class']}` | {analysis['lowest_precision']['value']:.4f} |")
        L.append("")
        flag = "⚠️ IMBALANCED" if analysis.get("flag_imbalance") else "✅ ACCEPTABLE"
        L.append(f"Support: `{analysis.get('supports', {})}` — {flag}")
        L.append(f"  (min/max ratio = {analysis.get('support_ratio_min_to_max')})")
    L.append("")

    # Misclassification analysis
    L.append("## 6. Misclassification Analysis")
    L.append("")
    if misclass:
        L.append(f"- Total errors (fine-tuned): **{misclass.get('total_errors', 0)}**")
        L.append(f"- Avg length of misclassified texts: **{misclass.get('error_text_avg_length_chars', 'N/A')} chars**")
        kw = misclass.get("common_keywords_in_errors", [])
        if kw:
            L.append(f"- Common words in errors: {', '.join(kw[:8])}")
        L.append("")
        L.append("### Top Confusion Pairs")
        L.append("")
        pairs = misclass.get("top_misclassification_pairs") or []
        if pairs:
            # Possible causes map
            _causes = {
                ("negative",  "distress"): "Overlap in hopeless / depressive phrasing",
                ("distress",  "negative"): "Subtle distress cues read as general sadness",
                ("positive",  "negative"): "Sarcasm or mixed-sentiment entries",
                ("negative",  "positive"): "Hopeful ending overrides negative body",
                ("distress",  "positive"): "Rare — likely label noise",
                ("positive",  "distress"): "Rare — likely label noise",
            }
            L.append("| Rank | Actual → Predicted | Count | Likely Cause |")
            L.append("|------|--------------------|-------|--------------|")
            for rank, p in enumerate(pairs, 1):
                cause = _causes.get((p.get("true_label"), p.get("predicted_label")), "Review error CSV")
                L.append(f"| {rank} | {p.get('true_label')} → {p.get('predicted_label')} | {p.get('count')} | {cause} |")
        L.append("")
    L.append("> Error rows: `05_errors_keyword.csv`, `05_errors_base.csv`, `05_errors_finetuned.csv`")
    L.append("")

    # Recommendations
    L.append("## 7. Recommendations")
    L.append("")
    for i, r in enumerate(recs, 1):
        L.append(f"### 7.{i} `[{r.get('priority')}]` {r.get('category')} — {r.get('title')}")
        L.append("")
        L.append(f"> {r.get('recommendation')}")
        L.append("")

    # Artifacts
    L.append("## 8. Saved Artifacts")
    L.append("")
    artifacts = [
        ("05_eval_report.json",               "Full structured metrics (JSON)"),
        ("05_eval_report.md",                 "This report (Markdown)"),
        ("05_metrics_overall.csv",            "Overall / macro / weighted metrics"),
        ("05_metrics_per_class.csv",          "Per-class precision / recall / F1"),
        ("05_comparison_overall.png",         "3-way overall metrics bar chart"),
        ("05_comparison_perclass_f1.png",     "Per-class F1 bar chart"),
        ("05_confusion_matrix_keyword.png",   "Confusion matrix — Keyword Baseline"),
        ("05_confusion_matrix_base.png",      "Confusion matrix — XLM-R Base"),
        ("05_confusion_matrix_finetuned.png", "Confusion matrix — Fine-tuned"),
        ("05_errors_keyword.csv",             "Misclassified rows — Keyword Baseline"),
        ("05_errors_base.csv",                "Misclassified rows — XLM-R Base"),
        ("05_errors_finetuned.csv",           "Misclassified rows — Fine-tuned"),
    ]
    L.append("| File | Description |")
    L.append("|------|-------------|")
    for fname, desc in artifacts:
        L.append(f"| `{fname}` | {desc} |")
    L.append("")
    L.append("---")
    L.append("_End of Phase 3.2 Standalone Evaluation — Rise On AI Capstone 2._")

    p = OUT_DIR / "05_eval_report.md"
    p.write_text("\n".join(L), encoding="utf-8")
    print(f"[SAVE] {p.name}")
    return p


# ─────────────────────────────────────────────────────────────────────────────
# CONSOLE PRINT HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _print_metrics(stage: str, m: dict) -> None:
    print(f"\n  ── {STAGE_LABELS.get(stage, stage)} ──")
    print(f"     Accuracy          : {m['accuracy']:.4f}")
    print(f"     Precision (Macro) : {m['precision_macro']:.4f}")
    print(f"     Recall    (Macro) : {m['recall_macro']:.4f}")
    print(f"     F1        (Macro) : {m['f1_macro']:.4f}")
    print(f"     F1     (Weighted) : {m['f1_weighted']:.4f}")
    print(f"     Latency           : {m.get('avg_latency_ms_per_sample', 'N/A')} ms/sample")
    print(f"     Per-class F1:")
    for l in LABELS:
        print(f"       {l:<12} : {m.get(f'per_{l}', {}).get('f1', 0.0):.4f}"
              f"  (support={m.get(f'per_{l}', {}).get('support', 0)})")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Phase 3.2 Standalone Evaluation — "
                    "Keyword Baseline / XLM-R Base / Fine-tuned"
    )
    parser.add_argument(
        "--model",
        default=str(OUT_DIR / "best_model"),
        help="Path to fine-tuned model folder  [default: outputs/best_model/]",
    )
    parser.add_argument(
        "--test",
        default=str(DATA_DIR / "test.csv"),
        help="Path to evaluation CSV/JSONL  [default: data/test.csv]",
    )
    parser.add_argument(
        "--base-model",
        default="FacebookAI/xlm-roberta-base",
        help="HF model ID for base pre-trained comparison",
    )
    parser.add_argument("--max-len", type=int, default=256)
    parser.add_argument(
        "--skip-base",
        action="store_true",
        help="Skip XLM-R base model evaluation (faster, no HF download needed)",
    )
    parser.add_argument(
        "--skip-keyword",
        action="store_true",
        help="Skip keyword baseline evaluation",
    )
    args = parser.parse_args()

    lock_seed(RANDOM_SEED)

    # ── Load dataset ──────────────────────────────────────────────────────────
    test_path = Path(args.test)
    if not test_path.exists():
        print(f"[ERROR] Test file not found: {test_path}")
        print("  Run 01_prepare_dataset.py first, or supply --test path/to/your.csv")
        sys.exit(1)

    df = load_eval_csv(test_path)
    y_true = list(df["label"].astype(str))
    texts  = list(df["text"].astype(str))
    label_dist = {l: int(y_true.count(l)) for l in LABELS}

    print(f"\n{'='*60}")
    print(f"  Phase 3.2 Standalone Evaluation")
    print(f"  Test set : {test_path.name}  (N={len(df)})")
    print(f"  Labels   : {label_dist}")
    print(f"  Model    : {Path(args.model).name}")
    print(f"{'='*60}\n")

    report: dict = {
        "meta": {
            "test_file":          str(test_path),
            "test_size":          len(df),
            "label_distribution": label_dist,
            "dataset_split":      "EVALUATION ONLY",
            "random_seed":        RANDOM_SEED,
            "base_model_name":    args.base_model,
            "evaluation_date":    pd.Timestamp.now().isoformat(),
        }
    }
    metrics_map: dict[str, dict] = {}

    # ── Stage 1: Keyword ─────────────────────────────────────────────────────
    if not args.skip_keyword:
        print("▶ [1/3] Keyword Baseline  (no ML)")
        t0     = time.perf_counter()
        y_kw   = [keyword_predict(t) for t in tqdm(texts, desc="Keyword", leave=False)]
        lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
        m_kw   = compute_metrics(y_true, y_kw)
        m_kw["avg_latency_ms_per_sample"] = round(lat_ms, 4)
        report["keyword"]      = m_kw
        metrics_map["keyword"] = m_kw
        _print_metrics("keyword", m_kw)
        _plot_confusion_matrix(
            m_kw["confusion_matrix"],
            "Confusion Matrix — Keyword Baseline",
            OUT_DIR / "05_confusion_matrix_keyword.png",
        )
        save_errors(df, y_true, y_kw, "05_errors_keyword.csv")

    # ── Stage 2: XLM-R Base ──────────────────────────────────────────────────
    if not args.skip_base:
        print("\n▶ [2/3] XLM-R Base (pre-trained, random head)")
        try:
            base_p = HFPredictor(
                model_name_or_path=args.base_model,
                stage_label="XLM-R Base",
                max_seq_len=args.max_len,
                random_head=True,
            )
            t0     = time.perf_counter()
            y_base = base_p.predict_many(texts)
            lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
            m_base = compute_metrics(y_true, y_base)
            m_base["avg_latency_ms_per_sample"] = round(lat_ms, 4)
            report["base"]      = m_base
            metrics_map["base"] = m_base
            _print_metrics("base", m_base)
            _plot_confusion_matrix(
                m_base["confusion_matrix"],
                "Confusion Matrix — XLM-R Base (pre-trained, random head)",
                OUT_DIR / "05_confusion_matrix_base.png",
            )
            save_errors(df, y_true, y_base, "05_errors_base.csv")
            del base_p
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception as exc:
            print(f"[WARN] Base model evaluation failed (continuing): {exc}")

    # ── Stage 3: Fine-tuned ───────────────────────────────────────────────────
    model_path = Path(args.model)
    has_weights = (
        (model_path / "model.safetensors").exists()
        or (model_path / "pytorch_model.bin").exists()
    )

    m_ft: dict | None = None
    err_ft: pd.DataFrame | None = None

    if has_weights:
        print("\n▶ [3/3] XLM-R Fine-tuned")
        ft_p = HFPredictor(
            model_name_or_path=str(model_path),
            stage_label="XLM-R Fine-tuned",
            max_seq_len=args.max_len,
            random_head=False,
        )
        t0 = time.perf_counter()
        y_ft = ft_p.predict_many(texts)
        lat_ms = (time.perf_counter() - t0) * 1000 / max(1, len(texts))
        m_ft = compute_metrics(y_true, y_ft)
        m_ft["avg_latency_ms_per_sample"] = round(lat_ms, 4)
        report["finetuned"]      = m_ft
        metrics_map["finetuned"] = m_ft
        _print_metrics("finetuned", m_ft)
        _plot_confusion_matrix(
            m_ft["confusion_matrix"],
            "Confusion Matrix — XLM-R Fine-tuned",
            OUT_DIR / "05_confusion_matrix_finetuned.png",
        )
        err_ft = save_errors(df, y_true, y_ft, "05_errors_finetuned.csv")

        # Improvement table
        print("\n" + "═"*62)
        print("  IMPROVEMENT  (Fine-tuned vs Keyword / Base)")
        print("═"*62)
        print(f"  {'Metric':<26}  {'Keyword':>8}  {'Base':>8}  {'Fine-tuned':>10}  {'Δ vs Base':>10}")
        print("  " + "─"*58)
        for k in ["accuracy","precision_macro","recall_macro","f1_macro",
                  "precision_weighted","recall_weighted","f1_weighted"]:
            ft_v = m_ft.get(k, 0.0)
            kw_v = report.get("keyword",   {}).get(k)
            bm_v = report.get("base",      {}).get(k)
            kw_s = f"{kw_v:.3f}" if kw_v is not None else "  N/A"
            bm_s = f"{bm_v:.3f}" if bm_v is not None else "  N/A"
            delta = ft_v - bm_v if bm_v is not None else None
            dlt_s = (("+" if delta >= 0 else "") + f"{100*delta:.2f} pp") if delta is not None else "  N/A"
            print(f"  {k:<26}  {kw_s:>8}  {bm_s:>8}  {ft_v:>10.3f}  {dlt_s:>10}")
        print("═"*62 + "\n")
    else:
        print(f"\n[WARN] No fine-tuned model found at {model_path}")
        print("       Run 02_finetune_xlmroberta.py first, then re-run this script.")

    # ── Charts ────────────────────────────────────────────────────────────────
    if len(metrics_map) >= 2:
        _plot_overall(metrics_map, OUT_DIR / "05_comparison_overall.png")
        _plot_perclass_f1(metrics_map, OUT_DIR / "05_comparison_perclass_f1.png")

    # ── Analysis (only on fine-tuned model) ───────────────────────────────────
    analysis: dict = {}
    misclass: dict = {}
    recs: list[dict] = []

    if m_ft is not None:
        analysis = analyse_lowest(m_ft)
        misclass = analyse_errors(err_ft, m_ft.get("confusion_matrix") or [[0]*3]*3)
        recs     = build_recommendations(m_ft, analysis, misclass)

        print("─"*60)
        print("📊 LOWEST PERFORMING CLASS (Fine-tuned):")
        print(f"   Lowest F1        → {analysis['lowest_f1']['class']:<12} {analysis['lowest_f1']['value']:.4f}")
        print(f"   Lowest Recall    → {analysis['lowest_recall']['class']:<12} {analysis['lowest_recall']['value']:.4f}")
        print(f"   Lowest Precision → {analysis['lowest_precision']['class']:<12} {analysis['lowest_precision']['value']:.4f}")
        print(f"   Imbalance flag   → {analysis.get('flag_imbalance')}")
        print("")
        print("🔎 TOP MISCLASSIFICATION PAIRS:")
        for p in (misclass.get("top_misclassification_pairs") or [])[:3]:
            print(f"   • {p['description']}  (N={p['count']})")
        print("")
        print("💡 RECOMMENDATIONS:")
        for r in recs:
            print(f"   [{r['priority']}] {r['title']}")
        print("─"*60 + "\n")

    report["analysis"] = analysis
    report["misclassification_analysis"] = misclass
    report["recommendations"] = recs

    # ── Save all ──────────────────────────────────────────────────────────────
    print("[SAVING ARTIFACTS]")
    csvs = save_csvs(report)
    md_path = build_markdown(report, analysis, misclass, recs, csvs, test_path)

    json_path = OUT_DIR / "05_eval_report.json"
    json_path.write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"[SAVE] {json_path.name}")

    print("\n" + "═"*70)
    print("📂  STANDALONE EVALUATION ARTIFACTS  (outputs/ directory)")
    print("═"*70)
    print(f"  JSON Report        : 05_eval_report.json")
    print(f"  Markdown Report    : 05_eval_report.md")
    for p in csvs:
        print(f"  CSV Table          : {p.name}")
    for png in [
        "05_comparison_overall.png", "05_comparison_perclass_f1.png",
        "05_confusion_matrix_keyword.png", "05_confusion_matrix_base.png",
        "05_confusion_matrix_finetuned.png",
    ]:
        if (OUT_DIR / png).exists():
            print(f"  Plot               : {png}")
    print("═"*70)
    print("\nStandalone evaluation complete.")


if __name__ == "__main__":
    main()
