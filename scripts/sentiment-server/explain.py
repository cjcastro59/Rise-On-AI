"""
explain.py — Phase 6 Explainable AI
Standalone Integrated Gradients explainability for XLM-RoBERTa

PURPOSE
───────
Provides word-level attribution scores using Integrated Gradients (IG).
This script/module is ISOLATED from the production /predict endpoint.
It is only executed when a user explicitly requests an explanation —
never automatically on journal save.

TECHNICAL APPROACH
──────────────────
Integrated Gradients (Sundararajan et al., 2017) computes the contribution
of each input feature by accumulating gradients along a straight-line path
from a baseline input (all [PAD] tokens) to the actual input.

WHY NOT LIME/SHAP?
  • LIME requires 50–500 perturbed forward passes → 7–75s on CPU → not viable
  • KernelSHAP: same problem
  • IG: ~5–15× single forward pass (30–50 interpolation steps) → 50–200ms on CPU

SUBWORD AGGREGATION LIMITATION
  XLM-RoBERTa uses WordPiece tokenization:
    "magpakamatay" → ["▁mag", "pa", "ka", "mata", "y"]
  IG scores are per-token. We aggregate (sum) subword scores back to words.
  This is an approximation — the true attribution is at the token level.
  All output MUST include the disclaimer about this approximation.

CAPTUM DEPENDENCY
  captum is NOT in the production server requirements.
  Install separately:  pip install captum>=0.7.0
  This module handles ImportError gracefully.

USAGE
─────
  # Standalone script
  python explain.py --text "Gusto ko na mamatay" --model outputs/best_model

  # Called from FastAPI /explain endpoint (if USE_EXPLAIN=1)
  # See the add_explain_endpoint() function imported in app.py
"""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from pathlib import Path
from typing import List, Dict, Optional

# ── Preprocessing (must match training + production) ──────────────────────────
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


# ── Integrated Gradients ──────────────────────────────────────────────────────

LABELS = ["positive", "negative", "distress"]
DEFAULT_MODEL_PATH = str(
    Path(__file__).parent / ".." / "sentiment-model-training" / "outputs" / "best_model"
)
IG_DISCLAIMER = (
    "Word attributions computed with Integrated Gradients (Sundararajan et al., 2017). "
    "XLM-RoBERTa uses WordPiece subword tokenization — scores for subword tokens of the "
    "same word are summed. This aggregation is an approximation. "
    "A positive score means the word pushed the model toward the predicted class; "
    "negative means it pushed against. Scores are relative to this prediction only."
)


def explain_text(
    text: str,
    model_path: str = DEFAULT_MODEL_PATH,
    num_steps: int = 50,
    target_class: Optional[int] = None,
) -> Dict:
    """
    Compute Integrated Gradients attribution for each word in `text`.

    Returns a dict with:
      - predicted_label: str
      - predicted_prob: float
      - all_probs: {positive, negative, distress}
      - word_attributions: list of {word, score, subword_tokens}
      - num_steps: int
      - method: "integrated_gradients"
      - disclaimer: str
      - error: str | None
    """
    processed = preprocess(text)
    if not processed:
        return {"error": "Empty text after preprocessing", "word_attributions": []}

    # ── Import guards ─────────────────────────────────────────────────────────
    try:
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
    except ImportError as e:
        return {
            "error": f"torch/transformers not installed: {e}",
            "word_attributions": [],
        }

    try:
        from captum.attr import LayerIntegratedGradients
    except ImportError:
        return {
            "error": (
                "captum is not installed. Install with: pip install captum>=0.7.0\n"
                "captum is intentionally excluded from the production server requirements "
                "to keep the inference server lightweight."
            ),
            "word_attributions": [],
        }

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=True)
        model = AutoModelForSequenceClassification.from_pretrained(model_path)
        model.eval()
    except Exception as e:
        return {"error": f"Failed to load model: {e}", "word_attributions": []}

    # ── Tokenize ──────────────────────────────────────────────────────────────
    encoding = tokenizer(
        processed,
        return_tensors="pt",
        truncation=True,
        max_length=256,
        padding=False,
        return_offsets_mapping=False,
    )

    input_ids      = encoding["input_ids"]            # (1, seq_len)
    attention_mask = encoding["attention_mask"]       # (1, seq_len)
    token_type_ids = encoding.get("token_type_ids")   # RoBERTa usually None

    # ── Get prediction ────────────────────────────────────────────────────────
    with torch.no_grad():
        out   = model(input_ids=input_ids, attention_mask=attention_mask)
        probs = torch.softmax(out.logits, dim=-1)[0].tolist()

    pred_idx   = int(torch.argmax(torch.tensor(probs)))
    pred_label = LABELS[pred_idx]
    pred_prob  = probs[pred_idx]

    # Caller can override target class (e.g. always explain distress class)
    if target_class is None:
        target_class = pred_idx

    # ── Integrated Gradients via embedding layer ──────────────────────────────
    embed_layer = model.roberta.embeddings if hasattr(model, "roberta") \
                  else model.base_model.embeddings

    def forward_func(input_embeds: "torch.Tensor") -> "torch.Tensor":
        """Forward pass using pre-computed embeddings (for IG interpolation)."""
        # attention_mask shape must match the batch dimension
        mask = attention_mask.expand(input_embeds.shape[0], -1)
        out  = model(inputs_embeds=input_embeds, attention_mask=mask)
        return torch.softmax(out.logits, dim=-1)[:, target_class]

    lig = LayerIntegratedGradients(forward_func, embed_layer.word_embeddings)

    # Baseline: all [PAD] token ids
    pad_id      = tokenizer.pad_token_id or 0
    baseline_ids = torch.full_like(input_ids, pad_id)

    try:
        attributions, delta = lig.attribute(
            inputs=input_ids,
            baselines=baseline_ids,
            target=None,          # target already baked into forward_func
            n_steps=num_steps,
            return_convergence_delta=True,
            internal_batch_size=8,
        )
        # attributions shape: (1, seq_len, embed_dim) → sum over embed_dim → (seq_len,)
        token_scores = attributions.sum(dim=-1).squeeze(0).tolist()
    except Exception as e:
        return {
            "error": f"IG computation failed: {e}",
            "word_attributions": [],
            "predicted_label":   pred_label,
            "predicted_prob":    round(pred_prob, 4),
        }

    # ── Subword → word aggregation ────────────────────────────────────────────
    tokens     = tokenizer.convert_ids_to_tokens(input_ids[0].tolist())
    word_attrs = _aggregate_subwords(tokens, token_scores, tokenizer)

    return {
        "predicted_label":   pred_label,
        "predicted_prob":    round(pred_prob, 4),
        "all_probs": {
            "positive": round(probs[0], 4),
            "negative": round(probs[1], 4),
            "distress": round(probs[2], 4),
        },
        "target_class_explained":  LABELS[target_class],
        "word_attributions": word_attrs,
        "num_steps":         num_steps,
        "method":            "integrated_gradients",
        "baseline":          "pad_token",
        "disclaimer":        IG_DISCLAIMER,
        "error":             None,
    }


def _aggregate_subwords(
    tokens: List[str],
    scores: List[float],
    tokenizer,
) -> List[Dict]:
    """
    Aggregate per-subword-token IG scores into per-word scores.

    Strategy: sum all subword scores for each word.
    A word boundary is identified by the ▁ (Ġ) prefix in SentencePiece /
    the absence of ## prefix in WordPiece.
    """
    SKIP_TOKENS = {"<s>", "</s>", "<pad>", "[CLS]", "[SEP]", "[PAD]"}
    results     = []
    current_word_parts  = []
    current_word_scores = []

    def flush_word():
        if not current_word_parts:
            return
        word = "".join(current_word_parts).replace("▁", "").replace("Ġ", "").strip()
        if word and word not in SKIP_TOKENS:
            results.append({
                "word":           word,
                "score":          round(sum(current_word_scores), 4),
                "subword_tokens": list(current_word_parts),
            })
        current_word_parts.clear()
        current_word_scores.clear()

    for tok, score in zip(tokens, scores):
        if tok in SKIP_TOKENS:
            flush_word()
            continue

        # SentencePiece (XLM-RoBERTa): ▁ or Ġ means start of new word
        if tok.startswith("▁") or tok.startswith("Ġ"):
            flush_word()
            current_word_parts.append(tok)
            current_word_scores.append(score)
        # WordPiece: ## means continuation
        elif tok.startswith("##"):
            current_word_parts.append(tok[2:])
            current_word_scores.append(score)
        else:
            # No prefix — treat as start of new word (fallback)
            if current_word_parts:
                flush_word()
            current_word_parts.append(tok)
            current_word_scores.append(score)

    flush_word()
    return results


# ── CLI interface ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Integrated Gradients explainability for XLM-RoBERTa"
    )
    parser.add_argument("--text",   required=True,             help="Input text to explain")
    parser.add_argument("--model",  default=DEFAULT_MODEL_PATH, help="Path to fine-tuned model")
    parser.add_argument("--steps",  type=int, default=50,       help="IG interpolation steps")
    parser.add_argument("--target", type=int, default=None,     help="Target class index (0=pos,1=neg,2=dst)")
    parser.add_argument("--json",   action="store_true",        help="Output raw JSON")
    args = parser.parse_args()

    result = explain_text(
        text=args.text,
        model_path=args.model,
        num_steps=args.steps,
        target_class=args.target,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("error"):
            print(f"[ERROR] {result['error']}")
        else:
            print(f"\nText: {args.text}")
            print(f"Predicted: {result['predicted_label']} ({result['predicted_prob']:.1%})")
            print(f"All probs: {result['all_probs']}")
            print(f"\nTop influential words (target: {result.get('target_class_explained', '?')}):")
            attrs = sorted(result["word_attributions"], key=lambda x: abs(x["score"]), reverse=True)
            for a in attrs[:12]:
                bar = "█" * int(abs(a["score"]) / (max(abs(x["score"]) for x in attrs) + 1e-8) * 20)
                direction = "→ FOR" if a["score"] > 0 else "← AGAINST"
                print(f"  {a['word']:<20} {a['score']:+.4f}  {bar} {direction}")
            print(f"\n[NOTE] {result['disclaimer'][:100]}...")
