import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60; // Extend Vercel timeout to 60s for heavy AI image inference


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
    
    const baseUrl = req.headers.get("host") ? `https://${req.headers.get("host")}` : "https://podcast-partnership-os.vercel.app";
    const constructUrl = new URL("/api/og", baseUrl);
    constructUrl.searchParams.set("title", title);
    constructUrl.searchParams.set("bg", baseImageUrl);
    constructUrl.searchParams.set("format", format);
    
    return NextResponse.json({ success: true, imageUrl: constructUrl.toString() });

  } catch (error: any) {
    console.error('EpisodeArtBot Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
