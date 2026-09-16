import os
"""
push_adapter_to_hf.py
─────────────────────────────────────────────────────────────────────────────
Pushes the LoRA adapter files to the EXISTING HuggingFace model repo.

This makes the existing repo a proper PEFT model so the HF Inference API
can load it as: base_model (xlm-roberta-base) + tiny adapter (6.8 MB).

Run:  python push_adapter_to_hf.py
"""

import io
import sys
from pathlib import Path

SCRIPT_DIR  = Path(__file__).parent
ADAPTER_DIR = SCRIPT_DIR / "outputs" / "trial_00" / "checkpoint-360"
BEST_MODEL  = SCRIPT_DIR / "outputs" / "best_model"

HF_TOKEN = os.environ.get('HF_TOKEN', '')
REPO_ID  = "cjcastro/xlm-roberta-Rise-On-AI"   # existing repo

try:
    from huggingface_hub import HfApi, upload_file
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
    from huggingface_hub import HfApi, upload_file

api = HfApi(token=HF_TOKEN)   # write token

def up(local: Path, remote: str):
    if not local.exists():
        print(f"  SKIP (missing): {local.name}")
        return
    mb = local.stat().st_size / 1024 / 1024
    print(f"  → {remote}  ({mb:.1f} MB)")
    api.upload_file(
        path_or_fileobj=str(local),
        path_in_repo=remote,
        repo_id=REPO_ID,
        commit_message=f"Add {remote}",
    )

print(f"Uploading LoRA adapter to {REPO_ID} ...\n")

# Core adapter files
up(ADAPTER_DIR / "adapter_config.json",       "adapter_config.json")
up(ADAPTER_DIR / "adapter_model.safetensors", "adapter_model.safetensors")

# Tokenizer (already there but upload anyway to ensure correctness)
up(ADAPTER_DIR / "tokenizer_config.json",     "tokenizer_config.json")
up(ADAPTER_DIR / "special_tokens_map.json",   "special_tokens_map.json")

print("\nAll done!")
print(f"\nInference API URL (use in .env.local and Vercel):")
print(f"  SENTIMENT_MODEL_API_URL=https://api-inference.huggingface.co/models/{REPO_ID}")
