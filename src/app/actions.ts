'use server'

import { captivateApi } from '@/lib/services/captivate';
import { zernioApi } from '@/lib/services/zernio';

export async function getShows() {
  return await captivateApi.getShows();
}

export async function getShowMetadata(id: string) {
  return await captivateApi.getShowMetadata(id);
}

export async function updateShowMetadata(id: string, data: any) {
  return await captivateApi.updateShowMetadata(id, data);
}

export async function getSubmissionStatus(jobId: string) {
  return await zernioApi.getSubmissionStatus(jobId);
}

// ============== EPISODE CREATOR WORKFLOW ==============



import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createClient } from '@/lib/supabase/server';

export async function generateEpisodeAssets(mediaUrl: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env.local');
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // 1. Download file from mediaUrl to pass to Files API
  const tempPath = path.join(os.tmpdir(), `upload-\${Date.now()}.mp3`);
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error("Failed to fetch media");
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);
  } catch (err: any) {
    console.error("Error downloading file:", err);
    throw new Error("Could not download the file to process.");
  }

  let fileResult;
  try {
    // 2. Upload to Gemini Files API
    // Using the internal format for GoogleGenAI SDK (v1.49.0 uses ai.files)
    fileResult = await ai.files.upload({ file: tempPath });
    
    // Polling logic for file processing
    let f = await ai.files.get({ name: fileResult.name! });
    while (f.state === "PROCESSING") {
      await new Promise(r => setTimeout(r, 2000));
      f = await ai.files.get({ name: fileResult.name! });
    }
    if (f.state === "FAILED") throw new Error("File processing failed.");

    // 3. Generate content
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
      model: 'gemini-2.5-pro',
      contents: [prompt, fileResult],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const resultText = genResponse.text;
    const result = resultText ? JSON.parse(resultText) : {};
    
    return {
      aiTitle: result.aiTitle || "Untitled Episode",
      aiDescription: result.aiDescription || "No description provided."
    };
  } finally {
    // Cleanup
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fileResult?.name) {
      // Optional: Cleanup the file from Gemini servers
      try { await ai.files.delete({ name: fileResult.name! }); } catch(e) {}
    }
  }
}

export async function generateVisualAssets(title: string, description: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env.local');

  const ai = new GoogleGenAI({ apiKey });
  const supabase = await createClient();

  const generateImage = async (prompt: string, prefix: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: prompt,
    });

    let base64Data = "";
    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
       for (const part of candidates[0].content.parts) {
         // @ts-ignore
         if (part.inlineData && part.inlineData.data) {
           // @ts-ignore
           base64Data = part.inlineData.data;
           break;
         }
       }
    }
    if (!base64Data) throw new Error("No image generated.");

    // Upload to Supabase Storage
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `\${prefix}-\${Date.now()}.png`;
    
    const { error } = await supabase.storage.from('episodes_bucket').upload(fileName, buffer, {
      contentType: 'image/png'
    });
    
    if (error) throw error;
    
    const { data } = supabase.storage.from('episodes_bucket').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const podcastArtPrompt = `Create a visually striking podcast cover art representing the following episode:
Title: \${title}
Description: \${description}
The image must be clean, minimal, suitable for a podcast index. Create it perfectly square, 1:1 aspect ratio. Do not include any actual text or words in the image.`;

  const thumbPrompt = `Create a highly engaging YouTube thumbnail representing the following episode:
Title: \${title}
Description: \${description}
The image should have a dramatic cinematic look. Create it perfectly landscape, 16:9 aspect ratio. Do not include any actual text or words in the image.`;

  const [podcastArtUrl, youtubeThumbUrl] = await Promise.all([
    generateImage(podcastArtPrompt, "art"),
    generateImage(thumbPrompt, "thumb")
  ]);

  return { podcastArtUrl, youtubeThumbUrl };
}

export async function publishEpisode(mediaUrl: string, title: string, description: string) {
  // Push the final state sequentially to both pipelines
  const showId = "44b65556-406f-4a16-8bce-4dd25f0a1de8"; // Provided by user
  await captivateApi.createEpisode(showId, { title, description, mediaUrl });
  
  const zernioProfileId = "68a5dbc016666d96d9274493";
  const youtubeConnectionId = "68dd556a38690b4b9b192945";
  await zernioApi.triggerSubmission(zernioProfileId, youtubeConnectionId, { title, description, mediaUrl });
  
  return true;
}
