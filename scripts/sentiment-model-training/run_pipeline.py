"""
================================================================
run_pipeline.py — Capstone 2 Phase 3 MASTER RUNNER
Runs the FULL fine-tuning pipeline end-to-end:
    01 → 02 → 03 → 04
================================================================

Usage examples:
--------------
# 1) Synthetic demo dataset + 1 trial (quick test)
python run_pipeline.py --synthetic-per-class 300 --trials 1 --epochs 4

# 2) Synthetic dataset + HP search (8 trials, production)
python run_pipeline.py --synthetic-per-class 500 --trials 8 --epochs 8

# 3) YOUR REAL dataset (CSV/JSONL):
python run_pipeline.py --input path/to/your_dataset.csv --trials 8 --epochs 8

# 4) XLMR-LARGE model (requires more GPU memory)
python run_pipeline.py --synthetic-per-class 500 --trials 5 --model FacebookAI/xlm-roberta-large --batch-size 8
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def run(script_name: str, args: list[str]) -> int:
    script_path = BASE_DIR / script_name
    cmd = [sys.executable, str(script_path)] + args
    print("\n" + "=" * 70)
    print(f"▶ STEP: {script_name}  {' '.join(args)}")
    print("=" * 70, flush=True)
    t0 = time.time()
    proc = subprocess.run(cmd, cwd=str(BASE_DIR))
    elapsed = time.time() - t0
    print(f"\n[DONE] {script_name} finished in {elapsed/60:.1f} minutes "
          f"(exit={proc.returncode})", flush=True)
    if proc.returncode != 0:
        raise RuntimeError(f"❌ {script_name} FAILED (exit {proc.returncode}). Aborting pipeline.")
    return proc.returncode


def main():
    ap = argparse.ArgumentParser(
        description="Master runner: dataset → fine-tune → export → evaluate",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--input", help="Path to CSV/JSONL (if not set, uses synthetic)")
    ap.add_argument("--synthetic-per-class", type=int, default=500)
    ap.add_argument("--balance", choices=["weights", "upsample", "none"], default="weights")
    ap.add_argument("--model", default="FacebookAI/xlm-roberta-base")
    ap.add_argument("--trials", type=int, default=3,
                    help="# of hyperparameter random-search trials")
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--no-lora", action="store_true",
                    help="Full fine-tuning (no LoRA/PEFT)")
    ap.add_argument("--no-export", action="store_true",
                    help="Skip ONNX/PyTorch export step")
    ap.add_argument("--no-quant", action="store_true",
                    help="Skip INT8 quantization")
    ap.add_argument("--skip-before", action="store_true",
                    help="Skip 'before fine-tuning' baseline eval")
    ap.add_argument("--max-len", type=int, default=256)

    args = ap.parse_args()

    t_start = time.time()
    summary = {
        "started": time.strftime("%Y-%m-%d %H:%M:%S"),
        "args": vars(args),
        "steps_completed": [],
    }

    # ---------------------------------------------------------------
    # STEP 1 — DATASET PREPARATION
    # ---------------------------------------------------------------
    ds_args = [
        "--balance", args.balance,
        "--synthetic-per-class", str(args.synthetic_per_class),
    ]
    if args.input:
        ds_args += ["--input", args.input]
    run("01_prepare_dataset.py", ds_args)
    summary["steps_completed"].append("01_prepare_dataset")

    # ---------------------------------------------------------------
    # STEP 2 — FINE-TUNING + HP TUNING
    # ---------------------------------------------------------------
    ft_args = [
        "--trials", str(args.trials),
        "--model", args.model,
        "--epochs", str(args.epochs),
        "--batch-size", str(args.batch_size),
    ]
    if args.no_lora:
        ft_args.append("--no-lora")
    run("02_finetune_xlmroberta.py", ft_args)
    summary["steps_completed"].append("02_finetune_xlmroberta")

    # ---------------------------------------------------------------
    # STEP 3 — EXPORT
    # ---------------------------------------------------------------
    if not args.no_export:
        exp_args = ["--max-len", str(args.max_len)]
        if args.no_quant:
            exp_args.append("--no-quant")
        try:
            run("03_export_model.py", exp_args)
            summary["steps_completed"].append("03_export_model")
        except Exception as e:
            print(f"[WARN] Export failed (non-fatal): {e}")
    else:
        print("[SKIP] Skipping export step (--no-export set).")

    # ---------------------------------------------------------------
    # STEP 4 — EVALUATION
    # ---------------------------------------------------------------
    ev_args = ["--max-len", str(args.max_len)]
    if args.skip_before:
        ev_args.append("--skip-before")
    try:
        run("04_evaluate_model.py", ev_args)
        summary["steps_completed"].append("04_evaluate_model")
    except Exception as e:
        print(f"[WARN] Evaluation failed (non-fatal): {e}")

    # ---------------------------------------------------------------
    # FINAL SUMMARY
    # ---------------------------------------------------------------
    summary["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    summary["wall_time_min"] = round((time.time() - t_start) / 60, 2)

    summary_path = BASE_DIR / "outputs" / "00_pipeline_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print("\n" + "=" * 70)
    print("🏁 PIPELINE FINISHED SUCCESSFULLY!")
    print("=" * 70)
    print(f"  Total wall time     : {summary['wall_time_min']:.1f} minutes")
    print(f"  Steps completed     : {', '.join(summary['steps_completed'])}")
    print(f"\n  Outputs directory   : {BASE_DIR / 'outputs'}")
    print(f"  Best model          : {BASE_DIR / 'outputs' / 'best_model'}")
    print(f"  Eval report (JSON)  : {BASE_DIR / 'outputs' / '04_evaluation_report.json'}")
    print(f"  Comparison plot     : {BASE_DIR / 'outputs' / '04_before_vs_after.png'}")
    print("=" * 70)


if __name__ == "__main__":
    main()
