'use server';

import { createClient } from '@/lib/supabase/server';
import { zernioApi, type ZernioPostPayload } from '@/lib/integrations/zernio';

export type ZernioPublishRequest = {
  clientId?: string;
  showId?: string;
  episodeId?: string;
  profileId: string;
  
  title: string;
  caption: string;
  mediaUrl: string;
  
  platforms: {
    platform: string;
    accountId: string;
    platformSpecificData?: any;
  }[];
  
  scheduleMode: 'now' | 'schedule' | 'queue';
  scheduledAt?: string;
};

export async function createZernioPostAction(req: ZernioPublishRequest) {
  const supabase = await createClient();

  try {
    // 1. Build Zernio Payload
    const zernioPayload: ZernioPostPayload & { queuedFromProfile?: string; scheduledFor?: string } = {
      content: req.caption,
      mediaItems: [{ type: 'video', url: req.mediaUrl }],
      platforms: req.platforms,
    };

    if (req.scheduleMode === 'now') {
      zernioPayload.publishNow = true;
    } else if (req.scheduleMode === 'schedule' && req.scheduledAt) {
      zernioPayload.scheduledFor = req.scheduledAt;
    } else if (req.scheduleMode === 'queue') {
      zernioPayload.queuedFromProfile = req.profileId;
    }

    // 2. Call Zernio API
    const response = await zernioApi.createPost(zernioPayload);
    
    // Zernio response handling (checking for external ID)
    const externalPostId = response.post?._id || response._id || null;
    if (!externalPostId) {
      console.warn('[ZERNIO PUBLISH WIZARD] Successfully called Zernio but no post ID returned:', response);
    }

    // 3. Save to Local Database
    const { data: dbPost, error: dbError } = await supabase
      .from('social_posts')
      .insert({
        client_id: req.clientId || null,
        show_id: req.showId || null,
        episode_id: req.episodeId || null,
        zernio_profile_id: req.profileId,
        zernio_post_id: externalPostId,
        title: req.title,
        caption: req.caption,
        media_url: req.mediaUrl,
        platforms: req.platforms.map((p) => p.platform),
        status: req.scheduleMode === 'now' ? 'PUBLISHED' : req.scheduleMode === 'schedule' ? 'SCHEDULED' : 'QUEUED',
        scheduled_at: req.scheduledAt || null,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('[ZERNIO PUBLISH WIZARD] Failed to log post to DB:', dbError);
      // We don't throw here because the post was actually sent to Zernio successfully.
    }

    return { success: true, externalPostId, dbId: dbPost?.id };
  } catch (error: any) {
    console.error('[ZERNIO PUBLISH WIZARD] Error creating post:', error);
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
}
