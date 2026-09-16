"""
Rise On AI — XLM-RoBERTa Sentiment Inference Server
====================================================
FastAPI server that runs the fine-tuned XLM-RoBERTa ONNX model using
the REAL SentencePiece tokenizer (XLMRobertaTokenizerFast).

Deploy on Render.com free tier — stays alive 24/7.

POST /predict
  Body:  {"inputs": "your text here"}
  Returns: [{"label": "positive", "score": 0.94}, ...]

GET /health
  Returns: {"status": "ok", "model_loaded": true}
"""

import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

REPO_ID    = "cjcastro/xlm-roberta-Rise-On-AI"
MODEL_FILE = "onnx/model_quantized.onnx"
CACHE_DIR  = "/tmp/hf-cache"
HF_TOKEN   = os.environ.get("HF_TOKEN", "")

# ── Global model state ────────────────────────────────────────────────────────
tokenizer: AutoTokenizer | None = None
session:   ort.InferenceSession | None = None
LABELS = {0: "positive", 1: "negative", 2: "distress"}


def load_model():
    global tokenizer, session
    log.info("Loading tokenizer from HF Hub...")
    tokenizer = AutoTokenizer.from_pretrained(
        REPO_ID,
        cache_dir=CACHE_DIR,
        token=HF_TOKEN or None,
    )
    log.info("Downloading ONNX model...")
    model_path = hf_hub_download(
        repo_id=REPO_ID,
        filename=MODEL_FILE,
        cache_dir=CACHE_DIR,
        token=HF_TOKEN or None,
    )
    log.info(f"Loading ONNX session from {model_path}...")
    session = ort.InferenceSession(
        model_path,
        providers=["CPUExecutionProvider"],
    )
    log.info("Model ready ✓")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Rise On AI Sentiment API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    inputs: str


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": session is not None}


@app.post("/predict")
def predict(req: PredictRequest):
    if not req.inputs or not req.inputs.strip():
        raise HTTPException(status_code=400, detail="Empty input")
    if session is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Real SentencePiece tokenization — matches training exactly
        enc = tokenizer(
            req.inputs.strip()[:512],
            return_tensors="np",
            max_length=256,
            padding="max_length",
            truncation=True,
        )
        logits = session.run(["logits"], {
            "input_ids":      enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        })[0][0]

        # Softmax
        exp   = np.exp(logits - logits.max())
        probs = exp / exp.sum()

        result = sorted(
            [{"label": LABELS[i], "score": float(probs[i])} for i in range(len(probs))],
            key=lambda x: -x["score"],
        )
        log.info(f"Predicted: {result[0]['label']} ({result[0]['score']*100:.1f}%)")
        return result
    except Exception as e:
        log.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
