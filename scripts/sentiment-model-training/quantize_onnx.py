import os
"""
quantize_onnx.py
Quantizes the already-exported FP32 ONNX to INT8, copies tokenizer files,
verifies output, then uploads to HuggingFace.
"""
import sys, shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ONNX_DIR   = SCRIPT_DIR / "outputs" / "onnx"
MODEL_DIR  = SCRIPT_DIR / "outputs" / "best_model"
fp32_path  = ONNX_DIR / "model.onnx"
int8_path  = ONNX_DIR / "model_quantized.onnx"

import onnxruntime
from onnxruntime.quantization import quantize_dynamic, QuantType

# ── 1. Quantize ───────────────────────────────────────────────────────────────
fp32_mb = fp32_path.stat().st_size / 1024 / 1024
print(f"[1/4] Quantizing FP32 ({fp32_mb:.0f} MB) → INT8 ...")
quantize_dynamic(
    model_input=str(fp32_path),
    model_output=str(int8_path),
    weight_type=QuantType.QInt8,
)
int8_mb = int8_path.stat().st_size / 1024 / 1024
print(f"      Done: {int8_mb:.1f} MB  (was {fp32_mb:.0f} MB, {100-int8_mb/fp32_mb*100:.0f}% smaller)")

# ── 2. Copy tokenizer files ───────────────────────────────────────────────────
print("[2/4] Copying tokenizer files ...")
for fname in ["tokenizer.json","tokenizer_config.json","sentencepiece.bpe.model",
              "special_tokens_map.json","config.json"]:
    src = MODEL_DIR / fname
    if src.exists():
        shutil.copy2(src, ONNX_DIR / fname)
        print(f"      ✓ {fname}")

# ── 3. Verify with OnnxRuntime ────────────────────────────────────────────────
print("[3/4] Verifying INT8 model ...")
from transformers import AutoTokenizer
import numpy as np

tokenizer = AutoTokenizer.from_pretrained(str(ONNX_DIR))
session   = onnxruntime.InferenceSession(str(int8_path))

enc = tokenizer("I feel really happy today!", return_tensors="np",
                max_length=128, padding="max_length", truncation=True)
logits = session.run(["logits"], {
    "input_ids":      enc["input_ids"].astype(np.int64),
    "attention_mask": enc["attention_mask"].astype(np.int64),
})[0][0]

import json
cfg    = json.loads((ONNX_DIR / "config.json").read_text())
labels = cfg.get("id2label", {"0":"positive","1":"negative","2":"distress"})
exp    = np.exp(logits - logits.max())
probs  = exp / exp.sum()
results = sorted([(labels[str(i)], round(float(p)*100, 1)) for i,p in enumerate(probs)],
                  key=lambda x: -x[1])
print(f"      Test result: {results}")
assert results[0][0] == "positive", f"Expected positive, got {results[0][0]}"
print("      ✓ Verify passed")

# ── 4. Upload to HuggingFace ──────────────────────────────────────────────────
print("[4/4] Uploading to HuggingFace ...")
from huggingface_hub import HfApi
api    = HfApi(token=os.environ.get('HF_TOKEN', ''))
REPO   = "cjcastro/xlm-roberta-Rise-On-AI"

files  = [
    ("model_quantized.onnx",   "onnx/model_quantized.onnx"),
    ("tokenizer.json",         "tokenizer.json"),
    ("tokenizer_config.json",  "tokenizer_config.json"),
    ("sentencepiece.bpe.model","sentencepiece.bpe.model"),
    ("special_tokens_map.json","special_tokens_map.json"),
    ("config.json",            "config.json"),
]

for local_name, remote_path in files:
    local = ONNX_DIR / local_name
    if not local.exists():
        print(f"      SKIP (missing): {local_name}")
        continue
    mb = local.stat().st_size / 1024 / 1024
    print(f"      → {remote_path}  ({mb:.1f} MB)")
    try:
        api.upload_file(
            path_or_fileobj=str(local),
            path_in_repo=remote_path,
            repo_id=REPO,
            commit_message=f"Add {remote_path}",
        )
    except Exception as e:
        if "no change" in str(e).lower() or "no files" in str(e).lower():
            print(f"        (no change)")
        else:
            raise

print(f"""
✓ All done!

Model live at: https://huggingface.co/{REPO}
ONNX file:     https://huggingface.co/{REPO}/blob/main/onnx/model_quantized.onnx
""")
