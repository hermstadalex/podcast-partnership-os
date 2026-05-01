import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60; // Extend Vercel timeout for AI inference

export async function POST(req: Request) {
  try {
    const { showId, mediaUrl, context } = await req.json();

    if (!mediaUrl && !context) {
      return NextResponse.json(
        { error: 'Missing required fields: mediaUrl or context' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // In a full implementation, we would download the mediaUrl or pass it to Gemini 1.5 Pro natively
    // For now, we will use the context to generate the shownotes using text-only prompt
    
    const prompt = `
      You are an expert podcast producer and SEO specialist.
      Generate a viral title, detailed HTML shownotes, and viral hashtags based on the following context.
      
      Media URL: ${mediaUrl || 'None provided'}
      Context/Notes: ${context || 'None provided'}
      
      Return a JSON object strictly matching this schema:
      {
        "title": "The viral episode title",
        "shownotes": "<p>The HTML formatted shownotes...</p>",
        "hashtags": "#podcast #topic #viral"
      }
    `;

    const genResponse = await ai.models.generateContent({
      model: 'gemini-3-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = genResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('Failed to generate content from Gemini');
    }

    const parsedContent = JSON.parse(text);

    return NextResponse.json({ 
      success: true, 
      title: parsedContent.title,
      shownotes: parsedContent.shownotes,
      hashtags: parsedContent.hashtags
    });

  } catch (error: any) {
    console.error('ShownotesCreator Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
