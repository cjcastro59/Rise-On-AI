import urllib.request, json

# Health check
with urllib.request.urlopen("http://localhost:8000/") as r:
    h = json.loads(r.read())
print("demo_mode:", h.get("demo_mode"))

# Test explain endpoint
body = json.dumps({"inputs": "I feel so happy today", "num_steps": 5}).encode()
req = urllib.request.Request(
    "http://localhost:8000/explain",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        result = json.loads(r.read())
    print("available:", result.get("available"))
    print("error:", result.get("error"))
    if result.get("word_attributions"):
        print("word_attributions (first 3):", result["word_attributions"][:3])
except Exception as e:
    print("ERROR:", e)
