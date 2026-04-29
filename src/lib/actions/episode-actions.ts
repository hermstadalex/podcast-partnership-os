'use server'

import { createClient } from '@/lib/supabase/server';
import { generateEpisodeAssetsWithGemini, generateVisualAssetsWithGemini } from '@/lib/integrations/gemini';
import { resolveAuthorizedShow } from '@/lib/supabase/queries';

export type EpisodeRunRecord = {
  provider: string;
  status: string;
};

export type EpisodeFeedRecord = {
  id: string;
  title: string;
  description?: string | null;
  media_url?: string | null;
  youtube_video_url?: string | null;
  episode_art?: string | null;
  created_at: string;
  show_id: string;
  show?: {
    captivate_show_id?: string | null;
    title?: string | null;
    client_id?: string | null;
    client?: { name?: string | null } | null;
  } | null;
  runs?: { provider: string; status: string; }[] | null;
  shorts?: { id: string; title?: string | null; video_url?: string | null; approval_status?: string | null; }[] | null;
};

export async function generateEpisodeAssets(mediaUrl: string) {
  return generateEpisodeAssetsWithGemini(mediaUrl);
}

export async function generateVisualAssets(title: string, description: string) {
  return generateVisualAssetsWithGemini(title, description);
}

export async function saveEpisodeDraft(mediaUrl: string, title: string, description: string, showId?: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error('Unauthorized');
  }

  const targetShow = await resolveAuthorizedShow(supabase, user, showId);

  const { data: episodeInsert, error: episodeInsertError } = await supabase
    .from('episodes')
    .insert({
      show_id: targetShow.id,
      title,
      description,
      media_url: mediaUrl,
    })
    .select('id')
    .single();

  if (episodeInsertError) {
    throw new Error(`Failed to create episode record: ${episodeInsertError.message}`);
  }

  return episodeInsert.id as string;
}

export async function getEpisodes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('episodes')
    .select(`
      id, title, description, media_url, youtube_video_url, episode_art, created_at, show_id,
      show:shows(captivate_show_id, title, client_id, client:clients(name)),
      runs:episode_publish_runs(provider, status),
      shorts:episode_shorts(id, title, video_url, approval_status)
    `)
    .order('created_at', { ascending: false }); 

  if (error) {
    console.error('Failed to fetch canonical episodes:', error);
    return { episodes: [] };
  }

  const episodes = ((data || []) as EpisodeFeedRecord[]).map((episode) => {
    const runs = Array.isArray(episode.runs) ? episode.runs : [];
    const shorts = Array.isArray(episode.shorts) ? episode.shorts : [];
    const preferredRun =
      runs.find((run) => run.provider === 'zernio') ||
      runs.find((run) => run.provider === 'youtube') ||
      runs[0];

    // Determine if source is video
    const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(episode.media_url || '');

    return {
      id: episode.id,
      title: episode.title,
      description: episode.description,
      media_url: episode.media_url,
      youtube_video_url: episode.youtube_video_url || null,
      episode_art: episode.episode_art || null,
      created_at: episode.created_at,
      show_id: episode.show_id,
      show_title: episode.show?.title || null,
      client_name: episode.show?.client?.name || null,
      captivate_show_id: episode.show?.captivate_show_id || null,
      status: preferredRun?.status || 'Processing',
      destinations: runs.map(r => ({ provider: r.provider, status: r.status })),
      shorts_count: shorts.length,
      has_shorts: shorts.length > 0,
      is_video: isVideo,
    };
  });

  return { episodes };
}

export async function getEpisodeDraft(episodeId: string) {
  const supabase = await createClient();
  const { data: episode } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();
  return episode;
}

export async function updateEpisodeDraft(
  episodeId: string,
  updates: {
    title?: string;
    description?: string;
    episode_art?: string;
    episode_season?: number;
    episode_number?: number;
  }
) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('episodes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);

  if (error) {
    throw new Error(`Failed to update episode draft: ${error.message}`);
  }

  return true;
}
