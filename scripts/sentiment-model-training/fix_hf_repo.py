import os
"""
Fix the HuggingFace repo so HF Inference API can serve it.
- Remove library_name: peft (causes HF to look for adapter only)
- Set library_name: transformers (standard model serving)
- Keep pipeline_tag: text-classification
- Keep the full model.safetensors (already there)
"""
import io
from huggingface_hub import HfApi

api  = HfApi(token=os.environ.get("HF_TOKEN", ""))
REPO = "cjcastro/xlm-roberta-Rise-On-AI"

readme = (
    "---\n"
    "language:\n- en\n- tl\n"
    "license: apache-2.0\n"
    "library_name: transformers\n"
    "tags:\n- text-classification\n- xlm-roberta\n- sentiment-analysis\n- filipino\n- taglish\n"
    "pipeline_tag: text-classification\n"
    "---\n\n"
    "# XLM-RoBERTa Rise On AI — Sentiment Analysis\n\n"
    "Fine-tuned XLM-RoBERTa for Filipino/English/Taglish 3-class sentiment.\n\n"
    "**Labels:** `positive` · `negative` · `distress`\n\n"
    "**Accuracy:** 82.6% · **F1 macro:** 0.815\n\n"
    "## Usage\n\n"
    "```python\n"
    "from transformers import pipeline\n"
    "clf = pipeline('text-classification', model='cjcastro/xlm-roberta-Rise-On-AI', top_k=None)\n"
    "print(clf('I feel happy today!'))\n"
    "```\n"
)

print("Updating README.md (removing peft library_name)...")
api.upload_file(
    path_or_fileobj=io.BytesIO(readme.encode()),
    path_in_repo="README.md",
    repo_id=REPO,
    commit_message="fix: set library_name to transformers for HF Inference API compatibility",
)
print("Done!")

# Also verify the siblings
info = api.model_info(REPO)
print("\nRepo files:")
for f in info.siblings:
    print(" ", f.rfilename)
print("\nlibrary_name:", getattr(info, 'library_name', 'unknown'))
print("pipeline_tag:", getattr(info, 'pipeline_tag', 'unknown'))
