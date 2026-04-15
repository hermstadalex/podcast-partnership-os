import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const prompt = "A podcast art image, no text.";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"]
      }
    })
  });
  
  const text = await res.text();
  console.log("REST Raw Response Body Keys:");
  const obj = JSON.parse(text);
  if(obj.candidates) {
     console.log("Candidate keys:", Object.keys(obj.candidates[0].content.parts[0]));
     console.log("part:", JSON.stringify(obj.candidates[0].content.parts[0]).substring(0, 50));
  }
}
run();
