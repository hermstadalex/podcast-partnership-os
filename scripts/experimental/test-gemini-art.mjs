import { GoogleGenAI } from '@google/genai';

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    console.log("Calling generateImages with gemini-3.1-flash-image-preview...");
    const imageResponse = await ai.models.generateImages({
      model: 'gemini-3.1-flash-image-preview',
      prompt: "A beautiful podcast cover art for an episode about big money in podcasting using AI hacks."
    });
    console.log("generateImages Response:", JSON.stringify(imageResponse, null, 2));
  } catch (err) {
    console.error("generateImages Error:", err);
  }
}

test();
