import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

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

    const prompt = `Edit the first image (base template) only. Keep the background, colors, layout, and typography the same as the first image. Replace the existing text with this new title: ${title}. Center the new text horizontally and vertically in the same text area. Be sure to keep the font uniform in size. Be sure to maintain the same case as the provided title. If the title is all capitalized, carry that over. If it's not all capitalized, carry that over. Match the font weight as well. ENSURE the text is centered, vertically and horizontally. Return only a high-quality JPEG image.`;

    const ai = new GoogleGenAI({ apiKey });

    // Using the Nano Banana 2 API (gemini-3.1-flash-image-preview) as researched.
    // The google/genai SDK provides an interface for standard image models. If it's an image edit via generateImages:
    let outputUrl = '';
    
    try {
      // Trying generateContent for multimodal text/image to image
      // Note: If this model returns image payload base64 or URI, we parse it.
      const genResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: imageBase64, mimeType } },
              { text: prompt },
            ]
          }
        ]
      });
      
      // If the API returns base64 response for an image, or image url depending on schema
      // Since it's a multimodal generation model, it may return inline data.
      const parts = genResponse.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        const part = parts[0];
        if (part.inlineData) {
            outputUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
           // Maybe it returns a URL in text
           outputUrl = part.text.trim();
        }
      }
      
    } catch (apiError: any) {
      console.warn("generateContent failed, falling back to generateImages. Error:", apiError.message);
      // Fallback if generateImages is the correct sdk method for this preview model
      const imageResponse = await ai.models.generateImages({
        model: 'gemini-3.1-flash-image-preview',
        prompt: prompt,
        // Optional SDK parameters usually might have an image field for editing
      });
      
      if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
         const generatedImg = imageResponse.generatedImages[0];
         if (generatedImg.image.imageBytes) {
           outputUrl = `data:${generatedImg.image.mimeType || 'image/jpeg'};base64,${generatedImg.image.imageBytes}`;
         } else if (generatedImg.imageUri) {
           outputUrl = generatedImg.imageUri;
         }
      }
    }

    if (!outputUrl) {
        return NextResponse.json({ error: 'Failed to extract generated image from API response.' }, { status: 500 });
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
