"""
Rise On AI — XLM-RoBERTa Sentiment Inference Server
Optimized for Render.com free tier (512MB RAM limit).

Uses tokenizers library directly (no PyTorch/transformers) + ONNX Runtime.
Total RAM: ~380MB (tokenizer ~5MB + ONNX model 266MB + server ~110MB)

POST /predict  {"inputs": "text"} → [{"label":"positive","score":0.94},...]
GET  /health   → {"status":"ok","model_loaded":true}
"""
import os
import logging
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

REPO_ID   = "cjcastro/xlm-roberta-Rise-On-AI"
HF_TOKEN  = os.environ.get("HF_TOKEN", "")
CACHE_DIR = "/tmp/hf-cache"
LABELS    = {0: "positive", 1: "negative", 2: "distress"}

# Special token IDs for XLM-RoBERTa
CLS_ID = 0   # <s>
SEP_ID = 2   # </s>
PAD_ID = 1   # <pad>
MAX_LEN = 256

app = FastAPI(title="Rise On AI Sentiment API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
fast_tokenizer = None
session        = None


def load_model():
    global fast_tokenizer, session

    from huggingface_hub import hf_hub_download
    # Use tokenizers library directly — much lighter than full transformers
    from tokenizers import Tokenizer

    log.info("Downloading tokenizer.json (~16MB)...")
    tok_path = hf_hub_download(
        repo_id=REPO_ID,
        filename="tokenizer.json",
        cache_dir=CACHE_DIR,
        token=HF_TOKEN or None,
    )
    log.info("Loading tokenizer from tokenizer.json...")
    fast_tokenizer = Tokenizer.from_file(tok_path)
    fast_tokenizer.enable_padding(
        pad_id=PAD_ID,
        pad_token="<pad>",
        length=MAX_LEN,
    )
    fast_tokenizer.enable_truncation(max_length=MAX_LEN)
    log.info("Tokenizer loaded ✓")

    log.info("Downloading ONNX model (~266MB)...")
    model_path = hf_hub_download(
        repo_id=REPO_ID,
        filename="onnx/model_quantized.onnx",
        cache_dir=CACHE_DIR,
        token=HF_TOKEN or None,
    )
    log.info("Loading ONNX session...")
    session = ort.InferenceSession(
        model_path,
        providers=["CPUExecutionProvider"],
    )
    log.info("Model ready ✓")


@app.on_event("startup")
def startup_event():
    load_model()


class PredictRequest(BaseModel):
    inputs: str


@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": session is not None}


@app.post("/predict")
def predict(req: PredictRequest):
    if not req.inputs or not req.inputs.strip():
        raise HTTPException(status_code=400, detail="Empty input")
    if session is None or fast_tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        # Tokenize using the fast tokenizer directly
        text = req.inputs.strip()[:512]
        encoding = fast_tokenizer.encode(text)

        input_ids      = np.array([encoding.ids],           dtype=np.int64)
        attention_mask = np.array([encoding.attention_mask], dtype=np.int64)

        logits = session.run(["logits"], {
            "input_ids":      input_ids,
            "attention_mask": attention_mask,
        })[0][0]

        # Softmax
        exp   = np.exp(logits - logits.max())
        probs = exp / exp.sum()

        result = sorted(
            [{"label": LABELS[i], "score": float(probs[i])} for i in range(len(probs))],
            key=lambda x: -x["score"],
        )
        log.info(f"Predicted: {result[0]['label']} ({result[0]['score']*100:.1f}%) | {text[:60]!r}")
        return result

    except Exception as e:
        log.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
