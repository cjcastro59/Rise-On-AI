"""
merge_datasets.py — Rise On AI
Merges the Kaggle depression Reddit CSV with the full synthetic pool,
then balances all three classes to the same count using upsampling.

Strategy:
  1. Parse ALL synthetic examples directly from 01_prepare_dataset.py source
  2. Load the Kaggle-converted CSV (400 distress + 400 negative)
  3. Combine and deduplicate
  4. Balance: upsample the minority class(es) to match the majority class
  5. Save merged_input.csv — ready for 01_prepare_dataset.py --input
"""

from pathlib import Path
import pandas as pd
import re

BASE         = Path(__file__).parent
DATA         = BASE / "data"
KAGGLE_FILE  = DATA / "kaggle_converted.csv"
MERGED_FILE  = DATA / "merged_input.csv"
LABELS       = ["positive", "negative", "distress"]


# ── Parse synthetic pool from source ─────────────────────────────────────────

def extract_synth_pool(py_path: Path) -> pd.DataFrame:
    """
    Regex-based parser: reads every quoted string inside SYNTH and
    SYNTH_AMBIGUOUS that is 10+ characters long, tagged with its label.
    Stops at the first line AFTER the SYNTH_AMBIGUOUS closing brace.
    """
    source = py_path.read_text(encoding="utf-8")

    rows: list[dict] = []
    current_label: str | None = None
    in_block = False

    # We scan line-by-line after we find SYNTH = {
    lines = source.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Enter SYNTH block
        if re.match(r'^SYNTH\s*=\s*\{', stripped):
            in_block = True
            i += 1
            continue

        # Enter SYNTH_AMBIGUOUS block (keep scanning)
        if re.match(r'^SYNTH_AMBIGUOUS\s*=\s*\{', stripped):
            in_block = True
            i += 1
            continue

        # Exit: top-level closing brace ends the last block
        if in_block and re.match(r'^\}\s*$', line):
            # Only stop if there's a blank line or non-dict statement after
            if i + 1 < len(lines):
                next_stripped = lines[i + 1].strip()
                if not next_stripped.startswith('"') and not next_stripped.startswith('#'):
                    in_block = False
            i += 1
            continue

        if not in_block:
            i += 1
            continue

        # Detect label key (e.g.  "positive": [)
        lbl_match = re.match(r'^\s*"(positive|negative|distress)"\s*:', stripped)
        if lbl_match:
            current_label = lbl_match.group(1)
            i += 1
            continue

        # Detect a quoted string example line
        # Matches lines like:   "some text",   or   "some text",
        if current_label:
            str_match = re.match(r'^\s*"(.{10,})",?\s*$', line)
            if str_match:
                text = str_match.group(1).strip()
                rows.append({"text": text, "label": current_label})

        i += 1

    return pd.DataFrame(rows)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # 1. Parse full synthetic pool
    synth_df = extract_synth_pool(BASE / "01_prepare_dataset.py")
    print(f"\n[MERGE] Synthetic pool parsed: {len(synth_df)} rows")
    print(f"        {synth_df['label'].value_counts().to_dict()}")

    # 2. Load Kaggle data
    kaggle_df = pd.read_csv(KAGGLE_FILE)[["text", "label"]]
    print(f"\n[MERGE] Kaggle dataset:        {len(kaggle_df)} rows")
    print(f"        {kaggle_df['label'].value_counts().to_dict()}")

    # 3. Combine and deduplicate
    combined = pd.concat([synth_df, kaggle_df], ignore_index=True)
    before   = len(combined)
    combined = combined.drop_duplicates(subset=["text"]).reset_index(drop=True)
    print(f"\n[MERGE] After combine + dedup: {len(combined)} rows "
          f"(removed {before - len(combined)} duplicates)")
    print(f"        {combined['label'].value_counts().to_dict()}")

    # 4. Balance — upsample minority classes to match the majority
    counts     = combined["label"].value_counts().to_dict()
    max_count  = max(counts.values())
    print(f"\n[MERGE] Balancing to {max_count} rows per class…")

    parts = []
    for lbl in LABELS:
        subset = combined[combined["label"] == lbl]
        n      = len(subset)
        if n == 0:
            print(f"  WARNING: no examples for label '{lbl}' — skipping")
            continue
        if n < max_count:
            # Upsample with replacement
            extra = subset.sample(max_count - n, replace=True, random_state=42)
            subset = pd.concat([subset, extra], ignore_index=True)
            print(f"  {lbl:<10}: {n} → {len(subset)}  (+{max_count - n} upsampled)")
        else:
            print(f"  {lbl:<10}: {n}  (no upsampling needed)")
        parts.append(subset)

    balanced = pd.concat(parts, ignore_index=True)
    balanced = balanced.sample(frac=1.0, random_state=42).reset_index(drop=True)

    print(f"\n[MERGE] Final balanced dataset: {len(balanced)} rows")
    print(f"        {balanced['label'].value_counts().to_dict()}")

    balanced.to_csv(MERGED_FILE, index=False)
    print(f"\n[MERGE] Saved → {MERGED_FILE}")
    print("[MERGE] Next: python 01_prepare_dataset.py --input data/merged_input.csv")


if __name__ == "__main__":
    main()
