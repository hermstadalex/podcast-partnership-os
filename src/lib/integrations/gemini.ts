import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

import { EpisodeAssetsResultSchema, type EpisodeAssetsResult } from '@/lib/validation/gemini';

export type VisualAssetsResult = {
  podcastArtUrl: string;
  youtubeThumbUrl: string;
};

/**
 * Generates textual episode assets (Title and Description) from a media URL using Gemini 2.5 Flash.
 * Includes file download, Gemini File API upload, and retry logic for high-demand periods.
 */
export async function generateEpisodeAssetsWithGemini(mediaUrl: string): Promise<EpisodeAssetsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });
  const tempPath = path.join(os.tmpdir(), `upload-${Date.now()}.mp3`);

  try {
    // 1. Download media to local temp storage
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from ${mediaUrl}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);
  } catch (err) {
    console.error('Error downloading file:', err);
    throw new Error('Could not download the file to process.');
  }

  let fileResult;
  try {
    // 2. Upload to Gemini File API
    fileResult = await ai.files.upload({ file: tempPath });

    // 3. Poll for processing completion
    let fileHandle = await ai.files.get({ name: fileResult.name! });
    while (fileHandle.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileHandle = await ai.files.get({ name: fileResult.name! });
    }

    if (fileHandle.state === 'FAILED') {
      throw new Error('Gemini file processing failed.');
    }

    const prompt = `You are an elite podcast producer. Listen to the provided audio/video track.
Your goal is to extract the core themes and produce a highly engaging Title and Description.
- The Title must be under 60 characters, "hooky", and maximize CTR.
- The Description (shownotes) must be formatted as clean HTML suitable for podcast RSS feeds.
- CRITICAL INSTRUCTION: The entire HTML output for the description MUST BE UNDER 3000 CHARACTERS. Be extremely concise. If you exceed 3000 characters, the system will fail.
  - Use <h2> for section headings (e.g. "Episode Summary", "Key Takeaways", "Timestamps").
  - Use <p> for paragraphs.
  - Use <ul> and <li> for lists.
  - Use a basic HTML <table> for timestamps (e.g. <tr><td>[00:00]</td><td>Topic</td></tr>).
  - Do NOT include <html>, <head>, <body>, or <style> tags. Only include inner content markup.
  - Do NOT use markdown. Output only valid HTML elements.
Output as a JSON object strictly matching this schema:
{
  "aiTitle": "string",
  "aiDescription": "string (HTML)"
}`;

    // 4. Generate content with 503 retry logic
    let genResponse;
    let retries = 5;
    while (retries > 0) {
      try {
        genResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { fileData: { fileUri: fileHandle.uri, mimeType: fileHandle.mimeType } },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });
        break;
      } catch (err: unknown) {
        const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: number }).status : undefined;
        if (status === 503 && retries > 1) {
          console.warn('Gemini 503 High Demand detected! Retrying in 5 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 5000));
          retries -= 1;
        } else {
          throw err;
        }
      }
    }

    const resultText = genResponse?.text;
    // Sanitize control characters that Gemini occasionally injects into JSON strings
    const sanitized = resultText ? resultText.replace(/[\x00-\x1F\x7F]/g, (ch) => {
      // Preserve standard whitespace characters
      if (ch === '\n' || ch === '\r' || ch === '\t') return ch;
      return '';
    }) : null;
    const resultRaw = sanitized ? JSON.parse(sanitized) : {};
    return EpisodeAssetsResultSchema.parse(resultRaw);
  } finally {
    // 5. Cleanup
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    if (fileResult?.name) {
      try {
        await ai.files.delete({ name: fileResult.name! });
      } catch (e) {
        console.warn('Failed to delete Gemini temporary file:', e);
      }
    }
  }
}

/**
 * Generates placeholder visual assets for an episode.
 * Currently uses placeholder URLs as a fallback for the unconfigured image generation pipeline.
 */
export async function generateVisualAssetsWithGemini(title: string, description: string): Promise<VisualAssetsResult> {
  // Logic preserved exactly from actions.ts
  const generateImage = async (_prompt: string, prefix: string) => {
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
    generateImage(podcastArtPrompt, 'art'),
    generateImage(thumbPrompt, 'thumb'),
  ]);

  return { podcastArtUrl, youtubeThumbUrl };
}

/**
 * Generates an optimized YouTube Shorts title and description.
 */
export async function generateShortsAssetsWithGemini(klapTopic: string, originalYoutubeUrl?: string): Promise<{ title: string; description: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a viral YouTube Shorts strategist. 
I have a short video clip extracted from a longer podcast. The topic of the clip is: "${klapTopic}"

Your task is to write a highly optimized Title and Description for YouTube Shorts.

- The Title must be under 60 characters, "hooky", and maximize CTR. Include #shorts.
- The Description must be engaging, 2-3 sentences max, and include relevant hashtags.
${originalYoutubeUrl ? `- You MUST include this link at the end of the description to drive traffic to the full video: "Watch the full episode: ${originalYoutubeUrl}"` : ''}

Output strictly as a JSON object matching this schema:
{
  "title": "string",
  "description": "string"
}`;

  const genResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json' },
  });

  const resultText = genResponse?.text;
  return resultText ? JSON.parse(resultText) : { title: klapTopic, description: '' };
}
