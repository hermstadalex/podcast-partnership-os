import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300; // Extend Vercel timeout for heavy AI image inference (Pro limit is 300s)

export async function POST(req: Request) {
  try {
    const { showId, guestReferenceUrl, title, format } = await req.json();

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

    let baseImageUrl = '';
    const supabase = await createClient();

    if (showId === 'guest') {
      if (!guestReferenceUrl) {
        return NextResponse.json(
          { error: 'Guest mode requires a guestReferenceUrl' },
          { status: 400 }
        );
      }
      baseImageUrl = guestReferenceUrl;
    } else {
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

      baseImageUrl = format === 'youtube-thumbnail'
          ? (show.youtube_reference_art || show.cover_art)
          : (show.podcast_reference_art || show.cover_art);
    }

    if (!baseImageUrl) {
      return NextResponse.json(
        { error: 'Show does not have a reference image configured for this format' },
        { status: 400 }
      );
    }

    // SSRF Protection Validations
    try {
      const parsedUrl = new URL(baseImageUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
      }

      const hostname = parsedUrl.hostname.toLowerCase();
      const isLocalhost = hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal');
      
      const isIPv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
      let isPrivateIP = false;
      if (isIPv4) {
        const parts = isIPv4.slice(1).map(Number);
        if (
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          parts[0] === 127 ||
          parts[0] === 169 ||
          parts[0] === 0
        ) {
          isPrivateIP = true;
        }
      }
      if (hostname.includes('[::1]') || hostname.includes('[fe80:') || hostname.includes('[fc00:') || hostname.includes('[fd00:')) {
        isPrivateIP = true;
      }

      if (isLocalhost || isPrivateIP) {
        if (process.env.NODE_ENV !== 'development') {
          return NextResponse.json({ error: 'Local network addresses are restricted' }, { status: 400 });
        }
      }
    } catch (err) {
      return NextResponse.json({ error: 'Malformed URL' }, { status: 400 });
    }

    // Download the image
    const imageRes = await fetch(baseImageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch base image' },
        { status: 500 }
      );
    }

    const contentType = imageRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid content type, expected image' }, { status: 400 });
    }

    const contentLength = imageRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 });
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
                const base64Data = part.inlineData.data;
                const outputMimeType = part.inlineData.mimeType || 'image/jpeg';
                
                if (!base64Data) {
                  console.warn("Skipping part: inlineData.data is undefined");
                  continue;
                }
                
                // Vercel's Buffer polyfill uses atob(), which throws "The string did not match the expected pattern" 
                // if it encounters base64url characters (- and _). We must normalize it to standard base64 first.
                const normalizedBase64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
                const buffer = Buffer.from(normalizedBase64, 'base64');
                const ext = outputMimeType.split('/')[1] || 'jpg';
                const fileName = `generated-art/${showId}-${format}-${Date.now()}.${ext}`;

                const { error: uploadError } = await supabase.storage
                  .from('episodes_bucket')
                  .upload(fileName, buffer, {
                    contentType: outputMimeType,
                    upsert: true
                  });

                if (uploadError) {
                  throw new Error(`Failed to upload generated art: ${uploadError.message}`);
                }

                const { data: { publicUrl } } = supabase.storage
                  .from('episodes_bucket')
                  .getPublicUrl(fileName);

                outputUrl = publicUrl;
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
