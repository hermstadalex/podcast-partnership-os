import os
import urllib.request
import json
import traceback

api_key = os.environ.get("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key={api_key}"

payload = {
    "instances": [
        {"prompt": "A spectacular 16:9 landscape YouTube thumbnail"}
    ],
    "parameters": {
        "sampleCount": 1,
        "aspectRatio": "16:9"
    }
}

req = urllib.request.Request(url, method="POST")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req, data=json.dumps(payload).encode()) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
except Exception as e:
    traceback.print_exc()
