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
  created_at: string;
  show_id: string;
  show?: {
    captivate_show_id?: string | null;
    title?: string | null;
  } | null;
  runs?: EpisodeRunRecord[] | null;
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
    .select('id, title, description, media_url, created_at, show_id, show:shows(captivate_show_id, title), runs:episode_publish_runs(provider, status, requested_at, created_at)')
    .order('created_at', { ascending: false }); 

  if (error) {
    console.error('Failed to fetch canonical episodes:', error);
    return { episodes: [] };
  }

  const episodes = ((data || []) as EpisodeFeedRecord[]).map((episode) => {
    const runs = Array.isArray(episode.runs) ? episode.runs : [];
    const preferredRun =
      runs.find((run) => run.provider === 'zernio') ||
      runs.find((run) => run.provider === 'youtube') ||
      runs[0];

    return {
      id: episode.id,
      title: episode.title,
      description: episode.description,
      media_url: episode.media_url,
      created_at: episode.created_at,
      show_id: episode.show_id,
      captivate_show_id: episode.show?.captivate_show_id || null,
      show_title: episode.show?.title || null,
      status: preferredRun?.status || 'Processing',
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
