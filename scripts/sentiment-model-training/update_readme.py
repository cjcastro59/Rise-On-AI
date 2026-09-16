import os
import io
from huggingface_hub import HfApi

api = HfApi(token=os.environ.get('HF_TOKEN', ''))
REPO = "cjcastro/xlm-roberta-Rise-On-AI"

readme = (
    "---\n"
    "language:\n- en\n- tl\n"
    "license: apache-2.0\n"
    "tags:\n- text-classification\n- xlm-roberta\n- peft\n- lora\n- sentiment-analysis\n"
    "pipeline_tag: text-classification\n"
    "base_model: FacebookAI/xlm-roberta-base\n"
    "---\n\n"
    "# XLM-RoBERTa Rise On AI — Sentiment Analysis\n\n"
    "Fine-tuned XLM-RoBERTa (LoRA) for Filipino/English/Taglish 3-class sentiment.\n\n"
    "**Labels:** positive · negative · distress  \n"
    "**Accuracy:** 82.6% · **F1 macro:** 0.815\n\n"
    "## Usage\n\n"
    "```python\n"
    "from transformers import pipeline\n"
    "clf = pipeline('text-classification', model='cjcastro/xlm-roberta-Rise-On-AI', top_k=None)\n"
    "print(clf('I feel happy today!'))\n"
    "```\n"
)

api.upload_file(
    path_or_fileobj=io.BytesIO(readme.encode()),
    path_in_repo="README.md",
    repo_id=REPO,
    commit_message="Update README: declare pipeline_tag + PEFT tags for Inference API",
)
print("README updated successfully")
