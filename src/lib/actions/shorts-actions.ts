'use server'

import { createClient } from '@/lib/supabase/server';
import { klapApi } from '@/lib/integrations/klap';
import { generateShortsAssetsWithGemini } from '@/lib/integrations/gemini';

export async function startShortsGeneration(episodeId: string) {
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

  // We could save the task ID to the database if we want long-term polling,
  // but Klap returns output_id when done. 
  // Let's just return the task ID to the client so it can poll.
  return task.id;
}

export async function pollShortsTask(taskId: string, episodeId: string) {
  const taskStatus = await klapApi.getTaskStatus(taskId);
  console.log(`[KLAP POLL] Task ${taskId} status: ${taskStatus.status}`, JSON.stringify(taskStatus));
  
  if (taskStatus.status === 'ready' || taskStatus.status === 'completed' || taskStatus.status === 'done') {
    const folderId = taskStatus.output_id || taskStatus.project_group_id || taskStatus.folder_id;
    
    if (folderId) {
      const supabase = await createClient();
      await supabase.from('episodes').update({ klap_folder_id: folderId }).eq('id', episodeId);
      return { status: 'completed', folderId };
    }
  }

  if (taskStatus.status === 'error') {
    console.error(`[KLAP POLL] Task ${taskId} failed:`, JSON.stringify(taskStatus));
  }

  return { status: taskStatus.status };
}

export async function getGeneratedShorts(folderId: string) {
  // Call Klap to get the list of projects
  const projects = await klapApi.getProjects(folderId);
  return projects;
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
  const supabase = await createClient();
  const { data: episode, error: epError } = await supabase.from('episodes').select('youtube_video_url').eq('id', episodeId).single();
  if (epError) console.error('[SHORTS] Episode fetch error:', epError);

  // Generate Gemini metadata
  let metadata: any;
  try {
    metadata = await generateShortsAssetsWithGemini(klapName, episode?.youtube_video_url || undefined);
    console.log('[SHORTS] Gemini metadata generated:', metadata);
  } catch (gemErr) {
    console.error('[SHORTS] Gemini metadata generation failed:', gemErr);
    metadata = { title: klapName, description: '' };
  }

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
