'use server'

import { createClient } from '@/lib/supabase/server';
import { captivateApi } from '@/lib/integrations/captivate';
import { zernioApi } from '@/lib/integrations/zernio';
import { 
  resolveAuthorizedShow, 
  getDefaultDestinationAccount, 
  createPublishRun 
} from '@/lib/supabase/queries';
import { getErrorMessage } from '@/lib/utils';
import type { CaptivateEpisodePayload } from '@/lib/integrations/captivate';

export async function getSubmissionStatus(postId: string) {
  return await zernioApi.getSubmissionStatus(postId);
}

/**
 * Publish an episode directly to Captivate with full scheduling support.
 * This is the new final-step action used by the Review screen.
 */
export async function publishEpisodeToCaptivate(
  episodeId: string,
  options: {
    status: 'Draft' | 'Scheduled' | 'Published';
    date?: string;           // 'YYYY-MM-DD HH:mm:ss'
    episodeSeason?: number;
    episodeNumber?: number;
  }
) {
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

  // Build the Captivate payload from the episode record + user scheduling options
  const captivatePayload: CaptivateEpisodePayload = {
    title: episode.title,
    shownotes: episode.description || '',
    mediaUrl: episode.media_url,
    status: options.status,
    date: options.date,
    episodeSeason: options.episodeSeason,
    episodeNumber: options.episodeNumber,
    episodeArt: episode.episode_art || undefined,
    episodeType: 'full',
  };

  // Update episode record with scheduling metadata
  await supabase
    .from('episodes')
    .update({
      episode_season: options.episodeSeason || null,
      episode_number: options.episodeNumber || null,
      scheduled_at: options.date ? new Date(options.date).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', episodeId);

  const captivateRunId = await createPublishRun(supabase, episodeId, 'captivate', captivatePayload);

  try {
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
    console.log(`[PIPELINE] Dispatched to Captivate. ShowId: ${testCaptivateShowId}. Status: ${options.status}`);
    return { success: true };
  } catch (err: unknown) {
    await supabase
      .from('episode_publish_runs')
      .update({
        status: 'Failed',
        error_message: getErrorMessage(err),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', captivateRunId);
    return { success: false, error: `Captivate publish failed: ${getErrorMessage(err)}` };
  }
}

export async function dispatchEpisodePublish(episodeId: string, publishMode: 'full' | 'podcast-only' = 'full') {
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

  if (publishMode === 'full' && !destinationAccount?.external_account_id && !process.env.ZERNIO_YOUTUBE_ACCOUNT_ID) {
    throw new Error('No publish destination is configured for this show and no test account fallback was found.');
  }

  const captivatePayload: CaptivateEpisodePayload = { 
    title: episode.title, 
    shownotes: episode.description || '', 
    mediaUrl: episode.media_url,
    status: 'Draft',
    episodeArt: episode.episode_art || undefined,
  };
  
  const captivateRunId = await createPublishRun(supabase, episodeId, 'captivate', captivatePayload);
  
  let zernioRunId: string | null = null;
  let zernioPayload: any = null;
  
  if (publishMode === 'full') {
    zernioPayload = zernioApi.constructYouTubePayload(episode, destinationAccount);
    zernioRunId = await createPublishRun(supabase, episodeId, 'zernio', zernioPayload);
  }

  let hasError = false;

  try {
    try {
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

    if (publishMode === 'full' && zernioRunId && zernioPayload) {
      try {
        const zernioResult = await zernioApi.publishEpisode(zernioPayload);

        await supabase
          .from('episode_publish_runs')
          .update({
            external_entity_id: zernioResult.externalId,
            status: zernioResult.status,
            completed_at: zernioResult.status === 'Published' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', zernioRunId);

        if (zernioResult.status === 'Published' && (zernioResult.youtubeVideoId || zernioResult.youtubeVideoUrl)) {
          await supabase
            .from('episodes')
            .update({
              youtube_video_id: zernioResult.youtubeVideoId || null,
              youtube_video_url: zernioResult.youtubeVideoUrl || null,
              published_at: zernioResult.publishedAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', episodeId);
        }

        console.log(
          `[PIPELINE] Dispatched to Zernio YouTube Account: ${process.env.ZERNIO_YOUTUBE_ACCOUNT_ID || destinationAccount?.external_account_id}. Post ID: ${zernioResult.externalId}. Initial Status: ${zernioResult.status}`
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
