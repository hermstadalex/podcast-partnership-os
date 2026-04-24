import os
import urllib.request
import json
import traceback

api_key = os.environ.get("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key={api_key}"

payload = {
    "contents": [
        {
            "role": "user",
            "parts": [
                { "text": "Create a solid blue square image." }
            ]
        }
    ]
}

req = urllib.request.Request(url, method="POST")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req, data=json.dumps(payload).encode()) as response:
        res = json.loads(response.read().decode())
        print(json.dumps(res, indent=2))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
except Exception as e:
    traceback.print_exc()
