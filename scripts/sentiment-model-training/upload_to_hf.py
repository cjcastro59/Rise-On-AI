"""
Upload trained model files to HuggingFace Hub.
Run: .venv-training\Scripts\python.exe upload_to_hf.py
"""
from huggingface_hub import HfApi
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────
REPO_ID   = "cjcastro/xlm-roberta-Rise-On-AI"
MODEL_DIR = Path(__file__).parent / "outputs" / "trial_00" / "checkpoint-86"

FILES_TO_UPLOAD = [
    "config.json",
    "model.safetensors",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
]
# ─────────────────────────────────────────────────────────────────────────

api = HfApi()  # uses the token saved by `huggingface-cli login`

print(f"\nUploading to: https://huggingface.co/{REPO_ID}")
print(f"Source dir  : {MODEL_DIR}\n")

for filename in FILES_TO_UPLOAD:
    src = MODEL_DIR / filename
    if not src.exists():
        print(f"  [SKIP] {filename} — not found")
        continue
    size_mb = src.stat().st_size / 1_048_576
    print(f"  [UPLOAD] {filename}  ({size_mb:.1f} MB) ...", flush=True)
    api.upload_file(
        path_or_fileobj=str(src),
        path_in_repo=filename,
        repo_id=REPO_ID,
        repo_type="model",
    )
    print(f"  [DONE]   {filename}")

print("\n✅ All files uploaded successfully!")
print(f"   View at: https://huggingface.co/{REPO_ID}")
