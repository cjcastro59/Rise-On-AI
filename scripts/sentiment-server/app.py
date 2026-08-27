"""
Rise On AI - OPTIMIZED XLM-RoBERTa Sentiment Classification Server
Locally hosted, no API key needed!

=== PERFORMANCE OPTIMIZATIONS INCLUDED:
✅ 1. FP16 / CUDA / MPS (GPU acceleration if available
✅ 2. torch.compile() support for PyTorch 2.0+ graph optimization
✅ 3. Optimal CPU thread pinning
✅ 4. Batch prediction endpoint /predict/batch
✅ 5. Fast tokenizer with padding & dynamic batching
✅ 6. Response gzip/brotli compression via middleware
✅ 7. DEMO MODE for testing without real model

--- HOW TO RUN ---
cd scripts/sentiment-server
python -m venv .venv
.venv\Scripts\Activate.ps1       (Windows)
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2

Production (with multiple workers!)
"""
from __future__ import annotations

import os
import random
import time
import gzip
from typing import List, Dict, Optional, Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

# ------------------------------
# App setup
# ------------------------------
app = FastAPI(title="Rise On AI - XLM-RoBERTa Sentiment API (Optimized)")

# Enable GZIP Compression middleware (huge speed win for JSON)
app.add_middleware(GZipMiddleware, minimum_size=500)

# ------------------------------
# CONFIG (edit via env vars!)
# ------------------------------
MODEL_PATH = os.environ.get(
    "SENTIMENT_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "..", "sentiment-model-training", "outputs", "best_model")
)
LABELS = ["positive", "negative", "distress"]
MAX_SEQ_LEN = int(os.environ.get("MAX_SEQ_LEN", "256"))  # Reduced from 512 for speed!
BATCH_SIZE = int(os.environ.get("INFERENCE_BATCH_SIZE", "32"))
USE_HALF = os.environ.get("USE_HALF", "1") == "1"  # FP16 if GPU
USE_COMPILE = os.environ.get("USE_COMPILE", "0") == "1"  # torch.compile
DEMO_MODE = False
model = None
tokenizer = None
device = "cpu"
torch_dtype = None

# ------------------------------
# REQUEST / RESPONSE TYPES
# ------------------------------
class PredictRequest(BaseModel):
    inputs: str
    options: Optional[Dict[str, Any]] = None

class PredictBatchRequest(BaseModel):
    inputs: List[str] = Field(..., min_length=1, max_length=256)
    options: Optional[Dict[str, Any]] = None

# ------------------------------
# 2. PERFORMANCE: CPU threads
# ------------------------------
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
except Exception as _import_err:
    print(f"[!] Transformers/Torch not installed yet: {_import_err}")
    DEMO_MODE = True
else:
    # Set optimal threads based on CPU cores!
    if os.environ.get("OMP_NUM_THREADS") is None:
        torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))
        torch.set_num_interop_threads(1)

    # ------------------------------
    # 1. LOAD MODEL with optimizations
    # ------------------------------
    try:
        print(f"[*] Loading model: {MODEL_PATH} (max_seq_len={MAX_SEQ_LEN})")
        _load_start = time.time()

        # AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            MODEL_PATH,
            use_fast=True,  # Force fast tokenizer (Rust-based)
            model_max_length=MAX_SEQ_LEN,
        )

        # Device detection (CUDA (NVIDIA GPU) -> MPS (Apple Silicon) -> CPU
        if torch.cuda.is_available():
            device = "cuda"
            torch_dtype = torch.float16 if USE_HALF else torch.float32
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
            torch_dtype = torch.float16 if USE_HALF else torch.float32
        else:
            device = "cpu"
            torch_dtype = torch.float32

        print(f"[*] Using device: {device} (dtype={torch_dtype})")

        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_PATH,
            torch_dtype=torch_dtype,
        )
        model.to(device)
        model.eval()

        # torch.compile for PyTorch 2.0 speed boost
        if USE_COMPILE and hasattr(torch, "compile") and device != "mps":
            try:
                model = torch.compile(model, mode="reduce-overhead")
                print("[*] torch.compile() applied!")
            except Exception as _compile_e:
                print(f"[!] torch.compile() skipped: {_compile_e}")

        _elapsed = time.time() - _load_start
        print(f"[✔] Model loaded in {_elapsed:.2f}s on {device}!")

    except Exception as e:
        print(f"[!] WARNING: Could not load model ({e}). Running DEMO MODE.")
        DEMO_MODE = True

# ------------------------------
# Preprocessing (matches Next.js 1:1!)
# ------------------------------
import re
import unicodedata

def preprocess(text: str) -> str:
    if not text:
        return ""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"https?://[^\s]+", " ", text)
    text = re.sub(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", " ", text)
    return text.strip()

def _score_to_result(scores: List[float]) -> List[Dict[str, float]]:
    """Normalize probability list to sorted label/score objects."""
    if len(scores) != len(LABELS):
        res = []
        for i, s in enumerate(scores[: len(LABELS)]):
            res.append({"label": LABELS[i % len(LABELS)], "score": float(s)})
    else:
        res = [{"label": LABELS[i], "score": float(scores[i])} for i in range(len(LABELS))]
    res.sort(key=lambda x: x["score"], reverse=True)
    return res

# ------------------------------
# CORE INFERENCE
# ------------------------------
def _infer(texts: List[str]) -> List[List[Dict[str, float]]]:
    if DEMO_MODE:
        results: List[List[Dict[str, float]]] = []
        for text in texts:
            seed = hash(text) % (2**31)
            rng = random.Random(seed)
            a = rng.random()
            b = rng.random() * (1 - a)
            c = max(0.0, 1 - a - b)
            scores = [a, b, c]
            total = sum(scores) or 1.0
            scores = [s / total for s in scores]
            results.append(_score_to_result(scores))
        return results

    import torch

    if tokenizer is None or model is None:
        raise RuntimeError("Model/tokenizer not loaded")

    # ------------------------------
    # 3. TOKENIZE
    # ------------------------------
    tokenized = tokenizer(
        texts,
        truncation=True,
        padding=True,
        max_length=MAX_SEQ_LEN,
        return_tensors="pt",
    )

    # Move to device
    tokenized = {k: v.to(device) for k, v in tokenized.items()}

    with torch.inference_mode():  # Faster than no_grad()!
        outputs = model(**tokenized)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1).cpu().tolist()

    return [_score_to_result(row) for row in probs]

# ------------------------------
# ENDPOINTS
# ------------------------------

@app.get("/")
def root():
    return {
        "ok": True,
        "model": MODEL_PATH,
        "demo_mode": DEMO_MODE,
        "device": device,
        "max_seq_len": MAX_SEQ_LEN,
        "batch_size": BATCH_SIZE,
        "labels": LABELS,
        "endpoints": {
            "POST /predict": "Single text prediction (inputs: string}",
            "POST /predict/batch": "Batch prediction {inputs: [string, ...]}",
        },
    }

# -------- SINGLE prediction endpoint
@app.post("/predict")
def predict_single(req: PredictRequest):
    text = preprocess(req.inputs)
    if not text:
        return [[{"label": LABELS[0], "score": 0.6}, {"label": LABELS[1], "score": 0.3}, {"label": LABELS[2], "score": 0.1}]]
    return _infer([text])

# -------- BATCH prediction endpoint (OPTIMIZED FOR SPEED!)
@app.post("/predict/batch")
def predict_batch(req: PredictBatchRequest):
    preprocessed = [preprocess(t) for t in req.inputs]
    # Filter blanks
    results_placeholders = []
    to_infer: List[str] = []
    to_infer_idx: List[int] = []
    for idx, t in enumerate(preprocessed):
        if not t:
            results_placeholders.append([{"label": LABELS[0], "score": 0.6}, {"label": LABELS[1], "score": 0.3}, {"label": LABELS[2], "score": 0.1}])
            continue
        results_placeholders.append(None)  # type: ignore[arg-type]
        to_infer.append(t)
        to_infer_idx.append(idx)

    # ------------------------------
    # 4. MINI-BATCHING for GPU throughput
    # ------------------------------
    infer_chunks: List[List[Dict[str, float]]] = []
    for i in range(0, len(to_infer), BATCH_SIZE):
        chunk = to_infer[i:i+BATCH_SIZE]
        infer_chunks.extend(_infer(chunk))

    # Place back in original positions
    for pos, original_idx in enumerate(to_infer_idx):
        results_placeholders[original_idx] = infer_chunks[pos]

    return results_placeholders

# ------------------------------
# 5. Custom Gzip fallback middleware for custom
# ------------------------------
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response: Response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.1f}"
    return response


# ==============================================================================
# Phase 6 — Explainable AI: POST /explain
# ==============================================================================
#
# DESIGN DECISION: OFF BY DEFAULT IN PRODUCTION
# ──────────────────────────────────────────────
# This endpoint uses Integrated Gradients (captum) which adds ~50–500ms
# latency and requires an extra pip install (captum>=0.7.0).
# It is DISABLED unless the server is started with USE_EXPLAIN=1:
#
#   USE_EXPLAIN=1 uvicorn app:app --host 0.0.0.0 --port 8000
#
# This ensures the production /predict endpoint is NEVER affected.
# The /explain endpoint is only called when a user explicitly requests
# an explanation in the UI — never automatically on journal save.
#
# If USE_EXPLAIN=0 (default), the endpoint returns a clear 503 response
# explaining why it is disabled, so the Next.js API route can degrade
# gracefully and show the user that IG is not available.
#
# NEVER call /explain from the fire-and-forget behavioral chain.
# ==============================================================================

USE_EXPLAIN = os.environ.get("USE_EXPLAIN", "0") == "1"

class ExplainRequest(BaseModel):
    inputs: str
    num_steps: int = 50
    target_class: Optional[int] = None  # None = predict and explain predicted class


@app.post("/explain")
def explain(req: ExplainRequest):
    """
    On-demand Integrated Gradients explanation for a single text.

    Returns:
      - predicted_label: str
      - predicted_prob: float
      - all_probs: {positive, negative, distress}
      - word_attributions: [{word, score, subword_tokens}]
      - disclaimer: str
      - error: str | None

    NOTE: This endpoint is disabled unless USE_EXPLAIN=1.
    NOTE: Requires `pip install captum>=0.7.0` in the server virtualenv.
    """
    if not USE_EXPLAIN:
        return {
            "ok": False,
            "available": False,
            "error": (
                "Integrated Gradients explanation is disabled on this server instance. "
                "Start the server with USE_EXPLAIN=1 to enable it. "
                "This feature is intentionally OFF in production to protect inference latency."
            ),
            "word_attributions": [],
        }

    if DEMO_MODE:
        return {
            "ok": False,
            "available": False,
            "error": "Server is running in DEMO MODE — no real model loaded. Load a fine-tuned model to use /explain.",
            "word_attributions": [],
        }

    # Lazily import explain_text from explain.py (same directory)
    try:
        import sys as _sys
        import os as _os
        _this_dir = _os.path.dirname(_os.path.abspath(__file__))
        if _this_dir not in _sys.path:
            _sys.path.insert(0, _this_dir)
        from explain import explain_text
    except ImportError as e:
        return {
            "ok": False,
            "available": False,
            "error": f"Could not import explain.py: {e}",
            "word_attributions": [],
        }

    try:
        result = explain_text(
            text=req.inputs,
            model_path=MODEL_PATH,
            num_steps=req.num_steps,
            target_class=req.target_class,
        )
        result["ok"] = True
        result["available"] = True
        return result
    except Exception as exc:
        return {
            "ok": False,
            "available": False,
            "error": f"Explanation failed: {exc}",
            "word_attributions": [],
        }
