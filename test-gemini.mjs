import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyDtkWgEhuTMUSpoawVmSAA-8b-ivjbqdQA" });
    const imageResponse = await ai.models.generateImages({
        model: 'gemini-3.1-flash-image-preview',
        prompt: "A beautiful podcast cover art for an episode about big money in podcasting using AI hacks."
    });
    console.log("Response:", JSON.stringify(imageResponse, null, 2));
    
    // Check what the bytes look like
    if (imageResponse?.generatedImages?.[0]?.image?.imageBytes) {
      console.log("Starts with:", imageResponse.generatedImages[0].image.imageBytes.substring(0, 50));
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
