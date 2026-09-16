import json
from pathlib import Path
from transformers import AutoTokenizer
import torch, numpy as np
import onnxruntime as ort

ONNX_DIR = Path("outputs/onnx")
MODEL    = str(ONNX_DIR / "model_quantized.onnx")

# Load real tokenizer
tokenizer = AutoTokenizer.from_pretrained(str(ONNX_DIR))
session   = ort.InferenceSession(MODEL)

print("Tokenizer type:", tokenizer.__class__.__name__)

tests = [
    "I am so happy today!",
    "I'm so happy for today",
    "I actually ok because i did my hobbies today",
    "I feel really terrible and depressed",
    "Masaya ako ngayon",
    "Nalulungkot ako",
]

for text in tests:
    enc = tokenizer(text, return_tensors="np", max_length=256, padding="max_length", truncation=True)
    logits = session.run(["logits"], {
        "input_ids":      enc["input_ids"].astype(np.int64),
        "attention_mask": enc["attention_mask"].astype(np.int64),
    })[0][0]
    exp   = np.exp(logits - logits.max())
    probs = exp / exp.sum()
    labels = ["positive","negative","distress"]
    result = sorted(zip(labels, probs), key=lambda x: -x[1])
    print(f"\nText: {text!r}")
    for label, score in result:
        print(f"  {label}: {score*100:.1f}%")
