# ============================================================
# train.ps1  —  One-shot training runner for Rise On AI
#
# Prerequisites: Python 3.12 installed, NVIDIA driver up to date
# Usage (from project root):
#   cd scripts\sentiment-model-training
#   .\train.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Rise On AI — XLM-RoBERTa Training Pipeline   " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# ── Step 1: Virtual environment ────────────────────────────
Write-Host "`n[1/5] Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path ".venv-training") {
    Write-Host "      (already exists, reusing)" -ForegroundColor DarkGray
} else {
    python -m venv .venv-training
}
& ".\.venv-training\Scripts\Activate.ps1"

# ── Step 2: Install dependencies ──────────────────────────
Write-Host "`n[2/5] Installing dependencies..." -ForegroundColor Yellow
pip install --upgrade pip --quiet

# Install CUDA 11.8 torch for MX330 (falls back to CPU if CUDA not found at runtime)
pip install torch==2.3.1+cu118 --extra-index-url https://download.pytorch.org/whl/cu118 --quiet
pip install -r requirements.txt --quiet

# ── Step 3: Prepare dataset ────────────────────────────────
Write-Host "`n[3/5] Preparing dataset..." -ForegroundColor Yellow
Write-Host "      Pool: 1,047 unique examples | 400/class synthetic rows | weighted balancing"
python 01_prepare_dataset.py --synthetic-per-class 400 --balance weights

# Check split was created
if (-not (Test-Path "data/train.csv")) {
    Write-Host "ERROR: data/train.csv not found — dataset preparation failed." -ForegroundColor Red
    exit 1
}

$trainRows = (Import-Csv "data/train.csv").Count
$valRows   = (Import-Csv "data/val.csv").Count
$testRows  = (Import-Csv "data/test.csv").Count
Write-Host "      train=$trainRows  val=$valRows  test=$testRows" -ForegroundColor DarkGray

# ── Step 4: Fine-tune ──────────────────────────────────────
Write-Host "`n[4/5] Fine-tuning XLM-RoBERTa with LoRA..." -ForegroundColor Yellow
Write-Host "      Batch=8, GradAcc=2 (effective=16), Epochs=6, FP16=auto"
Write-Host "      GPU: NVIDIA MX330 — expect ~15-30 min"
python 02_finetune_xlmroberta.py

# ── Step 5: Evaluate ──────────────────────────────────────
Write-Host "`n[5/5] Evaluating model..." -ForegroundColor Yellow
python 04_evaluate_model.py

# ── Done ──────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Training complete!" -ForegroundColor Green
Write-Host "  Model saved to: outputs/best_model" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart the sentiment server:" -ForegroundColor White
Write-Host "     cd ..\sentiment-server" -ForegroundColor DarkGray
Write-Host "     .\.venv\Scripts\Activate.ps1" -ForegroundColor DarkGray
Write-Host "     uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Test a prediction:" -ForegroundColor White
Write-Host "     Invoke-RestMethod -Uri http://localhost:8000/predict \" -ForegroundColor DarkGray
Write-Host "       -Method Post -ContentType 'application/json' \" -ForegroundColor DarkGray
Write-Host "       -Body '{`"inputs`": `"I feel really happy today`"}'" -ForegroundColor DarkGray
