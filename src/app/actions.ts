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
    let genResponse;
    let retries = 3;
    while (retries > 0) {
      try {
        genResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [
              { text: prompt },
              { fileData: { fileUri: f.uri, mimeType: f.mimeType } }
            ]}
          ],
          config: {
            responseMimeType: 'application/json',
          }
        });
        break; // Suceeded!
      } catch (err: any) {
        if (err.status === 503 && retries > 1) {
          console.warn("Gemini 503 High Demand detected! Retrying in 2 seconds...");
          await new Promise(r => setTimeout(r, 2000));
          retries--;
        } else {
          throw err;
        }
      }
    }

    const resultText = genResponse?.text;
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
    // 💥 The Gemini 3.1 Flash Image model is officially down globally for staging. 
    // It historically times out after 20 seconds, causing severe local UI lag.
    // We instantly short-circuit it for the MVP to provide a 0-latency experience. 
    return `https://placehold.co/${prefix === 'youtube-thumbnail' ? '1920x1080' : '800x800'}?text=AI+Art+Generation+Pipeline+Unconfigured`;
  };

  const podcastArtPrompt = `Create a visually striking podcast cover art representing the following episode:
Title: ${title}
Description: ${description}
Your goal is to make the art highly clickable and dynamic. Create it perfectly square, 1:1 aspect ratio. Do not include any actual text or words in the image.`;

  const thumbPrompt = `Create a highly engaging YouTube thumbnail representing the following episode:
Title: ${title}
Description: ${description}
The image should have a cinematic look to stand out in the algorithm. Create it perfectly landscape, 16:9 aspect ratio. Do not include any actual text or words in the image.`;

  const [podcastArtUrl, youtubeThumbUrl] = await Promise.all([
    generateImage(podcastArtPrompt, "art"),
    generateImage(thumbPrompt, "thumb")
  ]);

  return { podcastArtUrl, youtubeThumbUrl };
}

export async function publishEpisode(mediaUrl: string, title: string, description: string) {
  const supabase = await createClient();

  // Create local Episode Feed record
  let episodeId: string | null = null;
  try {
    const { data: insertData, error: insertError } = await supabase
      .from('episodes_feed')
      .insert({ title, description, media_url: mediaUrl, status: 'Processing' })
      .select('id')
      .single();
    if (insertError) {
       console.warn("Failed to create episode feed tracking record:", insertError);
    } else if (insertData) {
       episodeId = insertData.id;
    }
  } catch (e: any) {}

  let hasError = false;

  try {
    const showId = "44b65556-406f-4a16-8bce-4dd25f0a1de8";
    try {
      await captivateApi.createEpisode(showId, { title, description, mediaUrl });
      console.log(`[PIPELINE] Dispatched to Captivate Drafts. ShowId: ${showId}`);
    } catch (e: any) {
      console.warn("Captivate fetch error (ensure endpoint is enabled):", e.message);
      hasError = true;
    }

    const zernioKey = process.env.ZERNIO_API_KEY;
    const youtubeAccountId = process.env.ZERNIO_YOUTUBE_ACCOUNT_ID;
    
    if (zernioKey && youtubeAccountId) {
      const zernioRes = await fetch('https://zernio.com/api/v1/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${zernioKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: description,
          mediaItems: [{ type: 'video', url: mediaUrl }],
          publishNow: true,
          platforms: [{
            platform: 'youtube',
            accountId: youtubeAccountId,
            platformSpecificData: {
              title: title,
              visibility: 'private'
            }
          }]
        })
      });
      if (!zernioRes.ok) {
         console.warn("Zernio Error:", await zernioRes.text());
         hasError = true;
      } else {
         const zernioData = await zernioRes.json();
         // The Zernio API returns the post ID nested inside 'post' with an underscore prefix '_id'
         const zernioPostId = zernioData.post?._id || zernioData._id; 
         console.log(`[PIPELINE] Dispatched to Zernio YouTube Account: ${youtubeAccountId}. Post ID: ${zernioPostId}`);
         if (episodeId && zernioPostId) {
            await supabase.from('episodes_feed').update({ zernio_post_id: zernioPostId }).eq('id', episodeId);
         }
      }
    } else {
      console.warn("Missing ZERNIO_API_KEY or ZERNIO_YOUTUBE_ACCOUNT_ID for Video Host submission.");
      hasError = true;
    }
    
    // Simulate network delay to demonstrate the UI loading state
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (episodeId && hasError) {
       await supabase.from('episodes_feed').update({ status: 'Failed' }).eq('id', episodeId);
    }
    // Note: We do NOT natively update the status to 'Published' here anymore. 
    // The pipeline will remain in 'Processing' until the Zernio Webhook endpoint confirms completion.

    return true;
  } catch (error) {
    if (episodeId) {
       await supabase.from('episodes_feed').update({ status: 'Failed' }).eq('id', episodeId);
    }
    console.error("Pipeline failure:", error);
    throw error;
  }
}

export async function getEpisodes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('episodes_feed')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
     console.error("Failed to fetch episodes feed:", error);
     return { episodes: [] };
  }
  return { episodes: data };
}

