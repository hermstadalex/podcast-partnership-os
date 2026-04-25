import os
import urllib.request
import json
import traceback

api_key = os.environ.get("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateImages?key={api_key}"

payload = {
    "instances": [
        {"prompt": "A spectacular 16:9 landscape YouTube thumbnail with text: test title"}
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
        res = json.loads(response.read().decode())
        if 'generatedImages' in res:
           print("SUCCESS")
        else:
           print("NO IMAGES:", res)
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
except Exception as e:
    traceback.print_exc()
