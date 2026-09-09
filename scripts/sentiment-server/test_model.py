import urllib.request, json

def predict(text):
    body = json.dumps({"inputs": text}).encode()
    req = urllib.request.Request(
        "http://localhost:8000/predict",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())[0]
    top = result[0]
    print(f"  → {top['label']} ({top['score']*100:.1f}%)")
    for item in result:
        print(f"     {item['label']:<10} {item['score']*100:.1f}%")

print("=== Positive (Tagalog) ===")
predict("Masaya ako ngayon, salamat sa lahat!")

print("\n=== Negative ===")
predict("I feel so hopeless and empty, nothing matters anymore")

print("\n=== Distress (Tagalog) ===")
predict("Gusto ko nang magpakamatay, wala na akong dahilan para mabuhay")

print("\n=== Distress (English) ===")
predict("I want to end my life, I have already written the note")
