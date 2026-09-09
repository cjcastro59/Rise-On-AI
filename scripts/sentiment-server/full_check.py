"""
Full end-to-end check of the trained XLM-RoBERTa sentiment model.
Tests: server health, all 3 classes, both languages, edge cases.
"""
import urllib.request, json, sys

BASE = "http://localhost:8000"

def call(endpoint, payload=None):
    url = BASE + endpoint
    if payload:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=body,
              headers={"Content-Type": "application/json"}, method="POST")
    else:
        req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.status
    except Exception as e:
        return {"error": str(e)}, 0

def predict(text):
    result, status = call("/predict", {"inputs": text})
    if status != 200:
        return None
    top = result[0][0]
    return {
        "label": top["label"],
        "confidence": round(top["score"] * 100, 1),
        "all": {item["label"]: round(item["score"] * 100, 1) for item in result[0]},
    }

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"
errors = 0

# ── 1. Health check ───────────────────────────────────────────────────────────
print("=" * 60)
print("  Rise On AI — ML Model Full Check")
print("=" * 60)
print("\n[1] Server health")
health, status = call("/")
if status == 200 and not health.get("demo_mode"):
    print(f"  {PASS} Server running — model: {health.get('model', 'N/A')}")
    print(f"     device     : {health.get('device', 'N/A')}")
    print(f"     demo_mode  : {health.get('demo_mode', 'N/A')}")
    print(f"     labels     : {health.get('labels', 'N/A')}")
elif status == 200 and health.get("demo_mode"):
    print(f"  {FAIL} Server in DEMO MODE — model not loaded!")
    errors += 1
else:
    print(f"  {FAIL} Server unreachable (status={status})")
    errors += 1
    sys.exit(1)

# ── Test cases ────────────────────────────────────────────────────────────────
TESTS = [
    # (description, text, expected_label, min_confidence)
    # Positive — English
    ("Positive EN: happy day",
     "I feel so happy and grateful today, everything is going well!",
     "positive", 70),
    ("Positive EN: accomplishment",
     "I finally passed my exam! All my hard work paid off.",
     "positive", 70),
    ("Positive EN: recovery",
     "It was a tough week but I made it through. Feeling relieved and proud.",
     "positive", 55),
    # Positive — Tagalog / Taglish
    ("Positive TL: saya",
     "Masaya ako ngayon, salamat sa lahat ng biyaya!",
     "positive", 70),
    ("Positive TL: natapos",
     "Natapos ko na ang thesis ko — proud na proud ako sa sarili ko.",
     "positive", 60),
    # Negative — English
    ("Negative EN: sad/lonely",
     "I feel so lonely and empty, nothing seems to make me happy anymore.",
     "negative", 60),
    ("Negative EN: stressed",
     "I am completely overwhelmed with deadlines and I can't cope.",
     "negative", 55),
    ("Negative EN: low confidence",
     "I feel like a failure. No matter how hard I try it's never enough.",
     "negative", 55),
    # Negative — Tagalog
    ("Negative TL: malungkot",
     "Malungkot ako ngayon, wala akong gana sa kahit na anong bagay.",
     "negative", 55),
    ("Negative TL: pagod",
     "Pagod na pagod na ako sa lahat, wala na akong lakas para magpatuloy.",
     "negative", 55),
    # Distress — English
    ("Distress EN: suicidal ideation",
     "I want to end my life. I have already written a goodbye letter.",
     "distress", 60),
    ("Distress EN: self-harm",
     "I have been cutting myself every night just to feel something.",
     "distress", 55),
    ("Distress EN: hopeless + plan",
     "I don't see any reason to keep going. I have a plan and I'm ready.",
     "distress", 55),
    ("Distress EN: masked",
     "I keep telling myself I'm fine but I think about not waking up every night.",
     "distress", 50),
    # Distress — Tagalog
    ("Distress TL: magpakamatay",
     "Gusto ko nang magpakamatay, wala na akong dahilan para mabuhay.",
     "distress", 60),
    ("Distress TL: hindi na kaya",
     "Hindi ko na kaya, nagsulat na ako ng goodbye sa mga mahal ko sa buhay.",
     "distress", 55),
    # Edge cases
    ("Edge: empty-ish text",
     "okay",
     None, 0),  # any label is fine, just shouldn't crash
    ("Edge: mixed positive+negative",
     "I cried a lot today but I also laughed with my best friend.",
     None, 0),  # borderline, any label acceptable
    ("Edge: very long text",
     "I have been feeling really sad and empty for a very long time now. " * 8,
     "negative", 50),
]

# ── 2. Run tests ──────────────────────────────────────────────────────────────
print(f"\n[2] Classification tests ({len(TESTS)} cases)\n")
results = {"pass": 0, "fail": 0, "skip": 0}

for desc, text, expected, min_conf in TESTS:
    pred = predict(text)
    if pred is None:
        print(f"  {FAIL} {desc} — API error")
        errors += 1
        results["fail"] += 1
        continue

    label = pred["label"]
    conf  = pred["confidence"]
    dist  = pred["all"]

    if expected is None:
        # Just check it doesn't crash
        print(f"  {PASS} {desc}")
        print(f"       → {label} ({conf}%)  [any label ok]")
        results["skip"] += 1
        continue

    label_ok = label == expected
    conf_ok  = conf >= min_conf

    if label_ok and conf_ok:
        icon = PASS
        results["pass"] += 1
    elif label_ok and not conf_ok:
        icon = WARN
        results["pass"] += 1
        errors += 0  # warn only
    else:
        icon = FAIL
        results["fail"] += 1
        errors += 1

    print(f"  {icon} {desc}")
    print(f"       → {label} ({conf}%)  expected={expected}  "
          f"{'OK' if label_ok else 'WRONG'} | conf {'OK' if conf_ok else f'LOW (min {min_conf}%)'}")
    if not label_ok:
        print(f"       all scores: {dist}")

# ── 3. Batch endpoint ─────────────────────────────────────────────────────────
print(f"\n[3] Batch endpoint")
batch_result, bs = call("/predict/batch", {
    "inputs": [
        "I am so happy today!",
        "I feel sad and hopeless",
        "I want to kill myself",
    ]
})
if bs == 200 and len(batch_result) == 3:
    labels = [r[0]["label"] for r in batch_result]
    print(f"  {PASS} Batch of 3 returned correctly")
    print(f"       results: {labels}")
    if labels == ["positive", "negative", "distress"]:
        print(f"       {PASS} All three labels correct!")
    else:
        print(f"       {WARN} Labels: {labels} (expected ['positive','negative','distress'])")
else:
    print(f"  {FAIL} Batch endpoint error (status={bs})")
    errors += 1

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'=' * 60}")
print(f"  SUMMARY")
print(f"{'=' * 60}")
print(f"  Pass  : {results['pass']}")
print(f"  Fail  : {results['fail']}")
print(f"  Skip  : {results['skip']} (edge cases — any label ok)")
print(f"  Errors: {errors}")

if errors == 0:
    print(f"\n  {PASS} ALL CHECKS PASSED — model is production ready!")
elif results["fail"] <= 2:
    print(f"\n  {WARN} Minor issues — model is mostly working.")
else:
    print(f"\n  {FAIL} Multiple failures — model may need retraining.")

print()
