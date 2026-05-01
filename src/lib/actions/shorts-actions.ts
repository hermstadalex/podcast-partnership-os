'use server'

import { createClient } from '@/lib/supabase/server';
import { klapApi } from '@/lib/integrations/klap';
import { generateShortsAssetsWithGemini } from '@/lib/integrations/gemini';

export async function startShortsGeneration(episodeId: string) {
  if (episodeId === 'guest') {
    throw new Error("startShortsGeneration requires an episode ID. Use startStandaloneShortsGeneration for guest mode.");
  }
  const supabase = await createClient();
  const { data: episode } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();

  if (!episode) throw new Error("Episode not found");
  if (!episode.media_url) throw new Error("No media URL found for episode");

  // Call Klap API
  const task = await klapApi.generateShorts(episode.media_url);
  return task.id;
}

export async function startStandaloneShortsGeneration(videoUrl: string) {
  if (!videoUrl) throw new Error("No media URL provided");
  const task = await klapApi.generateShorts(videoUrl);
  return task.id;
}

export async function pollShortsTask(taskId: string, episodeId: string) {
  const taskStatus = await klapApi.getTaskStatus(taskId);
  console.log(`[KLAP POLL] Task ${taskId} status: ${taskStatus.status}`, JSON.stringify(taskStatus));
  
  if (taskStatus.status === 'ready' || taskStatus.status === 'completed' || taskStatus.status === 'done') {
    const folderId = taskStatus.output_id || taskStatus.project_group_id || taskStatus.folder_id;
    
    if (folderId) {
      if (episodeId !== 'guest') {
        const supabase = await createClient();
        await supabase.from('episodes').update({ klap_folder_id: folderId }).eq('id', episodeId);
      }
      return { status: 'completed', folderId };
    }
  }

  if (taskStatus.status === 'error') {
    console.error(`[KLAP POLL] Task ${taskId} failed:`, JSON.stringify(taskStatus));
  }

  return { status: taskStatus.status };
}

export async function getGeneratedShorts(folderId: string, episodeId: string) {
  // Call Klap to get the list of projects
  const projects = await klapApi.getProjects(folderId);
  
  if (episodeId === 'guest') {
    return projects.map((p: any) => ({
      ...p,
      is_exported: false,
    }));
  }

  // Check Supabase for existing exported/approved shorts
  const supabase = await createClient();
  const { data: existingShorts } = await supabase
    .from('episode_shorts')
    .select('klap_project_id')
    .eq('episode_id', episodeId);

  const exportedIds = new Set(existingShorts?.map((s) => s.klap_project_id) || []);

  return projects.map((p: any) => ({
    ...p,
    is_exported: exportedIds.has(p.id),
  }));
}

export async function exportShort(folderId: string, projectId: string) {
  const exportTask = await klapApi.exportShort(folderId, projectId);
  console.log('[KLAP EXPORT] Started:', JSON.stringify(exportTask));
  return exportTask;
}

export async function pollExportStatus(folderId: string, projectId: string, exportId: string) {
  const status = await klapApi.getExportStatus(folderId, projectId, exportId);
  return status;
}

export async function saveApprovedShort(episodeId: string, projectId: string, videoUrl: string, klapName: string) {
  console.log('[SHORTS] saveApprovedShort called:', { episodeId, projectId, videoUrl, klapName });
  
  let episodeYoutubeUrl = undefined;
  
  if (episodeId !== 'guest') {
    const supabase = await createClient();
    const { data: episode, error: epError } = await supabase.from('episodes').select('youtube_video_url').eq('id', episodeId).single();
    if (epError) console.error('[SHORTS] Episode fetch error:', epError);
    episodeYoutubeUrl = episode?.youtube_video_url;
  }

  // Generate Gemini metadata
  let metadata: any;
  try {
    metadata = await generateShortsAssetsWithGemini(klapName, episodeYoutubeUrl);
    console.log('[SHORTS] Gemini metadata generated:', metadata);
  } catch (gemErr) {
    console.error('[SHORTS] Gemini metadata generation failed:', gemErr);
    metadata = { title: klapName, description: '' };
  }

  if (episodeId === 'guest') {
     return { 
       short: { id: `guest-${projectId}`, title: metadata.title, video_url: videoUrl }, 
       description: metadata.description 
     };
  }

  const supabase = await createClient();
  const { data: short, error: insertError } = await supabase.from('episode_shorts').insert({
    episode_id: episodeId,
    klap_project_id: projectId,
    title: metadata.title,
    video_url: videoUrl,
    approval_status: 'approved',
    export_status: 'completed',
  }).select('*').single();

  if (insertError) {
    console.error('[SHORTS] Insert error:', insertError);
    throw new Error(`Failed to save short: ${insertError.message}`);
  }

  return { short, description: metadata.description };
}

import { zernioApi } from '@/lib/integrations/zernio';
import { resolveAuthorizedShow, getDefaultDestinationAccount } from '@/lib/supabase/queries';

export async function publishShortToZernio(episodeId: string, shortId: string, title: string, description: string, videoUrl: string, platforms: string[]) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) throw new Error('Unauthorized');

  const { data: episode } = await supabase
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();

  if (!episode) throw new Error('Episode not found');

  const targetShow = await resolveAuthorizedShow(supabase, user, episode.show_id);
  const defaultAccount = await getDefaultDestinationAccount(supabase, targetShow.id);

  // Currently we just publish to YouTube as an example, but we can iterate over `platforms` if Zernio supports it natively.
  if (platforms.includes('youtube')) {
    const payload = zernioApi.constructYouTubeShortPayload(
      { title, description, video_url: videoUrl },
      defaultAccount
    );
    
    const result = await zernioApi.publishEpisode(payload);
    
    // Create publish run record for auditing
    await supabase.from('episode_publish_runs').insert({
      episode_id: episodeId,
      provider: 'zernio',
      status: result.status,
      external_entity_id: result.externalId,
      payload: payload
    });

    return result;
  }
  
  throw new Error("No valid platforms selected");
}
