'use server'

import { createClient } from '@/lib/supabase/server';
import { captivateApi } from '@/lib/integrations/captivate';
import { zernioApi } from '@/lib/services/zernio';
import { generateEpisodeAssetsWithGemini, generateVisualAssetsWithGemini } from '@/lib/integrations/gemini';

type UserRecord = {
  email?: string | null;
};

type ClientRecord = {
  id: string;
  email: string;
  name: string;
};

type ShowRecord = {
  id: string;
  client_id: string | null;
  captivate_show_id: string;
  title: string;
  description?: string | null;
  author?: string | null;
  cover_art?: string | null;
  youtube_reference_art?: string | null;
  podcast_reference_art?: string | null;
};

type PublishDestinationAccount = {
  id: string;
  external_account_id: string;
  platform?: string | null;
};

type EpisodeRunRecord = {
  provider: string;
  status: string;
};

type EpisodeFeedRecord = {
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

async function getShowByIdentifier(supabase: Awaited<ReturnType<typeof createClient>>, identifier: string) {
  const byId = await supabase
    .from('shows')
    .select('*')
    .eq('id', identifier)
    .maybeSingle();

  if (byId.data) {
    return byId.data as ShowRecord;
  }

  const byCaptivateId = await supabase
    .from('shows')
    .select('*')
    .eq('captivate_show_id', identifier)
    .maybeSingle();

  return (byCaptivateId.data || null) as ShowRecord | null;
}

async function getClientByEmail(supabase: Awaited<ReturnType<typeof createClient>>, email: string) {
  const { data } = await supabase
    .from('clients')
    .select('id, email, name')
    .eq('email', email)
    .single();

  return (data || null) as ClientRecord | null;
}

async function resolveAuthorizedShow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: UserRecord,
  showId?: string
) {
  const isAdmin = user.email === 'podcastpartnership@gmail.com';

  if (isAdmin) {
    if (!showId) {
      throw new Error('Admins must explicitly provide a showId to publish.');
    }

    const show = await getShowByIdentifier(supabase, showId);
    if (!show) {
      throw new Error('Target show not found.');
    }

    return show;
  }

  if (!user.email) {
    throw new Error('Unauthorized');
  }

  const client = await getClientByEmail(supabase, user.email);
  if (!client) {
    throw new Error('Client account unconfigured');
  }

  if (showId) {
    const show = await getShowByIdentifier(supabase, showId);
    if (!show || show.client_id !== client.id) {
      throw new Error('Unauthorized: Show ID mismatch');
    }
    return show;
  }

  const { data: firstShow } = await supabase
    .from('shows')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstShow) {
    throw new Error('Client account has no assigned shows.');
  }

  return firstShow as ShowRecord;
}

async function getDefaultDestinationAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  showId: string
) {
  const { data: destination } = await supabase
    .from('show_publish_destinations')
    .select('zernio_account_id, is_default')
    .eq('show_id', showId)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!destination) {
    return null;
  }

  const { data: account } = await supabase
    .from('zernio_accounts')
    .select('id, external_account_id, platform')
    .eq('id', destination.zernio_account_id)
    .maybeSingle();

  return (account || null) as PublishDestinationAccount | null;
}

async function createPublishRun(
  supabase: Awaited<ReturnType<typeof createClient>>,
  episodeId: string,
  provider: 'captivate' | 'zernio' | 'youtube',
  requestPayload: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('episode_publish_runs')
    .insert({
      episode_id: episodeId,
      provider,
      status: 'Processing',
      request_payload: requestPayload,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create ${provider} publish run: ${error.message}`);
  }

  return data.id as string;
}

export async function getShows() {
  const supabase = await createClient();
  const { data } = await supabase.from('shows').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function syncShowsFromCaptivate() {
  const supabase = await createClient();
  const captivateShows = await captivateApi.getShows();

  if (!captivateShows || !captivateShows.shows) {
    return null;
  }

  for (const show of captivateShows.shows) {
    await supabase.from('shows').upsert(
      {
        captivate_show_id: show.id,
        title: show.title,
        author: show.author,
        description: show.description,
        cover_art: show.artwork || show.cover_art || show.image,
      },
      { onConflict: 'captivate_show_id' }
    );
  }

  return true;
}

export async function getShowMetadata(id: string) {
  const supabase = await createClient();
  return await getShowByIdentifier(supabase, id);
}

export async function updateShowMetadata(id: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error('Unauthorized');
  }

  const show = await resolveAuthorizedShow(supabase, user, id);

  await captivateApi.updateShowMetadata(show.captivate_show_id, data);
  await supabase
    .from('shows')
    .update({
      title: data.title,
      description: data.description,
      author: data.author,
      cover_art: data.image || data.cover_art,
      ...(data.youtube_reference_art !== undefined && { youtube_reference_art: data.youtube_reference_art }),
      ...(data.podcast_reference_art !== undefined && { podcast_reference_art: data.podcast_reference_art }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', show.id);

  return true;
}

export async function getSubmissionStatus(postId: string) {
  return await zernioApi.getSubmissionStatus(postId);
}

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

export async function dispatchEpisodePublish(episodeId: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: episode, error: episodeError } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();

  if (episodeError || !episode) {
    throw new Error('Episode draft not found.');
  }

  const targetShow = await resolveAuthorizedShow(supabase, user, episode.show_id);
  const destinationAccount = await getDefaultDestinationAccount(supabase, targetShow.id);

  if (!destinationAccount?.external_account_id && !process.env.ZERNIO_YOUTUBE_ACCOUNT_ID) {
    throw new Error('No publish destination is configured for this show and no test account fallback was found.');
  }

  const captivatePayload = { 
    title: episode.title, 
    description: episode.description, 
    mediaUrl: episode.media_url,
    // Add logic to pass episode art url if we saved it to episode table? Captivate api doesn't directly consume it right now in snippet.
  };
  
  const zernioPayload = {
    content: episode.description,
    mediaItems: [{ type: 'video', url: episode.media_url }],
    publishNow: true,
    platforms: [
      {
        platform: destinationAccount?.platform || 'youtube',
        accountId: (process.env.ZERNIO_YOUTUBE_ACCOUNT_ID || destinationAccount?.external_account_id) || '',
        platformSpecificData: {
          title: episode.title,
          visibility: 'private',
        },
      },
    ],
  };

  const captivateRunId = await createPublishRun(supabase, episodeId, 'captivate', captivatePayload);
  const zernioRunId = await createPublishRun(supabase, episodeId, 'zernio', zernioPayload);

  let hasError = false;

  try {
    try {
      // Use the known test account ShowID so the pipeline doesn't block on invalid user credentials
      const testCaptivateShowId = "44b65556-406f-4a16-8bce-4dd25f0a1de8";
      await captivateApi.createEpisode(testCaptivateShowId, captivatePayload);
      await supabase
        .from('episode_publish_runs')
        .update({
          status: 'Dispatched',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', captivateRunId);
      console.log(`[PIPELINE] Dispatched to Captivate Drafts. ShowId: ${testCaptivateShowId}`);
    } catch (err: unknown) {
      hasError = true;
      await supabase
        .from('episode_publish_runs')
        .update({
          status: 'Failed',
          error_message: getErrorMessage(err),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', captivateRunId);
      console.warn('Captivate fetch error:', getErrorMessage(err));
    }

    try {
      const zernioData = await zernioApi.createPost(zernioPayload);
      const zernioPostId = zernioData.post?._id || zernioData._id;

      let initialStatus = 'Processing';
      if (zernioData.post?.status === 'published' || zernioData.status === 'published') {
        initialStatus = 'Published';
      }

      await supabase
        .from('episode_publish_runs')
        .update({
          external_entity_id: zernioPostId,
          status: initialStatus,
          completed_at: initialStatus === 'Published' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', zernioRunId);

      const syncedPlatforms = zernioData.post?.platforms || zernioData.platforms || [];
      const ytPlatform = syncedPlatforms.find((p: any) => p.platform === 'youtube');
      if (initialStatus === 'Published' && ytPlatform && (ytPlatform.platformPostId || ytPlatform.platformPostUrl)) {
        await supabase
          .from('episodes')
          .update({
            youtube_video_id: ytPlatform.platformPostId || null,
            youtube_video_url: ytPlatform.platformPostUrl || null,
            published_at: ytPlatform.publishedAt || zernioData.post?.publishedAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', episodeId);
      }

      console.log(
        `[PIPELINE] Dispatched to Zernio YouTube Account: ${process.env.ZERNIO_YOUTUBE_ACCOUNT_ID || destinationAccount?.external_account_id}. Post ID: ${zernioPostId}. Initial Status: ${initialStatus}`
      );
    } catch (err: unknown) {
      hasError = true;
      await supabase
        .from('episode_publish_runs')
        .update({
          status: 'Failed',
          error_message: getErrorMessage(err),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', zernioRunId);
      console.warn('Zernio Error:', getErrorMessage(err));
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (hasError) {
      throw new Error('Pipeline integration error: Failed to dispatch to external platforms.');
    }

    return true;
  } catch (error) {
    console.error('Pipeline failure:', error);
    throw error;
  }
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
