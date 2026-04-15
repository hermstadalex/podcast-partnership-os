import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function run() {
  console.log("Beginning Gemini Pipeline Test...");
  const tempPath = 'test_file.mp4';
  
  if (!fs.existsSync(tempPath)) {
    console.error("test_file.mp4 not found in root directory!");
    return;
  }
  
  console.log("1. Uploading to Gemini Files API...");
  const startTime = Date.now();
  let fileResult = await ai.files.upload({ file: tempPath });
  
  let f = await ai.files.get({ name: fileResult.name });
  while (f.state === "PROCESSING") {
    console.log("   Status: PROCESSING... waiting 2s.");
    await new Promise(r => setTimeout(r, 2000));
    f = await ai.files.get({ name: fileResult.name });
  }
  
  if (f.state === "FAILED") {
      console.error("File processing failed on Gemini servers.");
      return;
  }
  console.log(`✓ Upload & Processing Complete. (${((Date.now() - startTime)/1000).toFixed(2)}s)`);

  const prompt = `You are an elite podcast producer. Listen to the provided audio/video track.
Your goal is to extract the core themes and produce a highly engaging Title and Description.
- The Title must be under 60 characters, "hooky", and maximize CTR.
- The Description must contain a summary and a timestamped table of contents.
Output as a JSON object strictly matching this schema:
{
  "aiTitle": "string",
  "aiDescription": "string"
}`;

  const genResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { fileData: { fileUri: fileResult.uri, mimeType: fileResult.mimeType } }
        ]
      }
    ],
    config: { responseMimeType: 'application/json' }
  });
  
  const resultText = genResponse.text;
  const result = resultText ? JSON.parse(resultText) : {};
  console.log("\n--- RESULT ---");
  console.log("TITLE:", result.aiTitle);
  console.log("DESCRIPTION:", result.aiDescription);
  console.log("--------------\n");

  console.log("3. Test Visual Asset Generation with 3.1 Flash Preview...");
  const visStart = Date.now();
  const thumbPrompt = `Create a highly engaging YouTube thumbnail representing the following episode:
Title: ${result.aiTitle}
Description: ${result.aiDescription}
The image should have a dramatic cinematic look. Create it perfectly landscape, 16:9 aspect ratio. Do not include any actual text or words in the image.`;

  const visResponse = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: thumbPrompt,
  });
  
  console.log(`✓ Thumbnail Generated. (${((Date.now() - visStart)/1000).toFixed(2)}s)`);
  
  let base64Data = "";
  const candidates = visResponse.candidates || [];
  if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Data = part.inlineData.data;
          break;
        }
      }
  }
  console.log(`Image Payload Size: ${(base64Data.length / 1024).toFixed(2)} KB base64.`);
  console.log("Pipeline Validation Complete!");
  
  await ai.files.delete({ name: fileResult.name });
}

run().catch(e => console.error(e));
