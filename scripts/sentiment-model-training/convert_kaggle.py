"""
convert_kaggle.py
Maps the Kaggle depression_dataset_reddit_cleaned.csv schema
→ the Rise On AI training schema (text, label, source, language).

Kaggle columns:
  clean_text    → text
  is_depression → label  (1 = distress, 0 = negative)

We treat:
  is_depression = 1  →  "distress"  (depressed / crisis content)
  is_depression = 0  →  "negative"  (non-depressed struggle content)

Note: this dataset has NO positive examples, so it supplements our
existing synthetic positive pool — it does NOT replace it.
We sample a balanced slice so distress and negative get equal rows.
"""
from pathlib import Path
import pandas as pd

RAW   = Path(__file__).parent / "data" / "depression_dataset_reddit_cleaned.csv"
OUT   = Path(__file__).parent / "data" / "kaggle_converted.csv"

# How many rows to take per class from Kaggle (keep manageable for CPU training)
SAMPLE_PER_CLASS = 400

def main():
    print(f"[KAGGLE] Loading {RAW.name} …")
    df = pd.read_csv(RAW)
    print(f"[KAGGLE] Raw rows: {len(df)}  |  columns: {list(df.columns)}")

    # Rename columns
    df = df.rename(columns={"clean_text": "text", "is_depression": "label_raw"})
    df["text"] = df["text"].astype(str).str.strip()
    df = df[df["text"].str.len() >= 10].copy()   # drop nearly-empty rows

    # Map numeric label to string label
    df["label"] = df["label_raw"].map({1: "distress", 0: "negative"})
    df = df.dropna(subset=["label"])

    # Sample balanced slice
    parts = []
    for lbl in ["distress", "negative"]:
        subset = df[df["label"] == lbl]
        n      = min(len(subset), SAMPLE_PER_CLASS)
        parts.append(subset.sample(n, random_state=42))
        print(f"[KAGGLE]   {lbl}: {n} rows sampled (pool: {len(subset)})")

    out = pd.concat(parts).sample(frac=1.0, random_state=42).reset_index(drop=True)
    out["source"]   = "kaggle_depression_reddit"
    out["language"] = "en"

    out[["text", "label", "source", "language"]].to_csv(OUT, index=False)
    print(f"[KAGGLE] Saved {len(out)} rows → {OUT}")
    print(f"[KAGGLE] Label breakdown:\n{out['label'].value_counts().to_string()}")

if __name__ == "__main__":
    main()
