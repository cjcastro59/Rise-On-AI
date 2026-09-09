$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "Rise On AI - XLM-RoBERTa Training Pipeline" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Step 1 - Virtual environment
Write-Host ""
Write-Host "[1/5] Setting up virtual environment..." -ForegroundColor Yellow
if (Test-Path ".venv-training") {
    Write-Host "      Reusing existing .venv-training" -ForegroundColor DarkGray
} else {
    python -m venv .venv-training
    Write-Host "      Created .venv-training" -ForegroundColor DarkGray
}

$activateScript = Join-Path $scriptDir ".venv-training\Scripts\Activate.ps1"
. $activateScript

# Step 2 - Install dependencies
Write-Host ""
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
pip install --upgrade pip --quiet
pip install torch==2.3.1+cu118 --extra-index-url https://download.pytorch.org/whl/cu118 --quiet
pip install -r requirements.txt --quiet
Write-Host "      Done" -ForegroundColor DarkGray

# Step 3 - Prepare dataset
Write-Host ""
Write-Host "[3/5] Preparing dataset..." -ForegroundColor Yellow
python 01_prepare_dataset.py --synthetic-per-class 400 --balance weights

if (-not (Test-Path "data\train.csv")) {
    Write-Host "ERROR: data\train.csv not found. Dataset preparation failed." -ForegroundColor Red
    exit 1
}

$trainRows = (Import-Csv "data\train.csv").Count
$valRows   = (Import-Csv "data\val.csv").Count
$testRows  = (Import-Csv "data\test.csv").Count
Write-Host ("      train={0}  val={1}  test={2}" -f $trainRows, $valRows, $testRows) -ForegroundColor DarkGray

# Step 4 - Fine-tune
Write-Host ""
Write-Host "[4/5] Fine-tuning XLM-RoBERTa with LoRA..." -ForegroundColor Yellow
Write-Host "      Batch=8, GradAcc=2, Epochs=6, FP16=auto (MX330 GPU)" -ForegroundColor DarkGray
python 02_finetune_xlmroberta.py

# Step 5 - Evaluate
Write-Host ""
Write-Host "[5/5] Evaluating model..." -ForegroundColor Yellow
python 04_evaluate_model.py

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "Training complete!" -ForegroundColor Green
Write-Host "Model saved to: outputs\best_model" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: restart the sentiment server" -ForegroundColor Cyan
Write-Host "  cd ..\sentiment-server" -ForegroundColor White
Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2" -ForegroundColor White
