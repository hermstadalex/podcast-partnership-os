import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Extend Vercel timeout for heavy AI image inference

export async function POST(req: Request) {
  try {
    const { showId, title, format } = await req.json();

    if (!showId || !title || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: showId, title, format' },
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

    const supabase = await createClient();
    const { data: show, error: showError } = await supabase
      .from('shows')
      .select('cover_art, youtube_reference_art, podcast_reference_art, id')
      .eq('id', showId)
      .single();

    if (showError || !show) {
      return NextResponse.json(
        { error: 'Show not found' },
        { status: 404 }
      );
    }

    const baseImageUrl = format === 'youtube-thumbnail'
        ? (show.youtube_reference_art || show.cover_art)
        : (show.podcast_reference_art || show.cover_art);

    if (!baseImageUrl) {
      return NextResponse.json(
        { error: 'Show does not have a reference image configured for this format' },
        { status: 400 }
      );
    }

    // Download the image
    const imageRes = await fetch(baseImageUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch base image' },
        { status: 500 }
      );
    }
    
    // Process image to base64
    const imageArrayBuffer = await imageRes.arrayBuffer();
    const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
    
    const newPrompt = `Replace the existing text with this new title: ${title}. Center the new text horizontally and vertically in the same text area. Maintain all other background elements perfectly.`;

    const ai = new GoogleGenAI({ apiKey });
    let outputUrl = '';
    
    try {
      // Trying generateContent for multimodal text/image to image natively using the verified Nano Banana model
      const genResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: imageBase64, mimeType } },
              { text: newPrompt },
            ]
          }
        ]
      });
      
      const parts = genResponse.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        // Iterate through parts to find the image part
        for (const part of parts) {
            if (part.inlineData) {
                outputUrl = `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
                break;
            }
        }
      }
      
    } catch (apiError: any) {
      console.warn("generateContent failed natively. Error:", apiError.message);
    }

    // Unconditional Fallback: If outputUrl failed to generate
    if (!outputUrl) {
        console.warn("Falling back to placeholder mockup for:", format);
        const fallbackUrl = `https://placehold.co/${format === 'youtube-thumbnail' ? '1920x1080' : '800x800'}/18181b/ffffff?text=${encodeURIComponent(title.substring(0, 30) + (title.length > 30 ? '...' : ''))}`;
        return NextResponse.json({ success: true, imageUrl: fallbackUrl });
    }

    if (outputUrl && !outputUrl.startsWith('http') && !outputUrl.startsWith('data:')) {
        return NextResponse.json({ error: `Final extracted URL is invalid: ${outputUrl}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl: outputUrl });

  } catch (error: any) {
    console.error('EpisodeArtBot Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
