const apiKey = "sk_5177f0b38ba437fe4dffb4291bbdd480bcb8fdfe6e8c5b81fd5ef379b1044d29";
const payload = {
  profileId: "69fa32a8eb71a6cc5714a682",
  content: "Test post from Antigravity",
  mediaItems: [{ type: "image", url: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" }],
  publishNow: true,
  platforms: [
    {
      platform: "tiktok",
      accountId: "69fa34e5157a6202f6d2a898",
      platformSpecificData: { description: "Test tiktok description" }
    }
  ]
};

fetch("https://zernio.com/api/v1/posts", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
}).then(r=>r.text()).then(console.log);
