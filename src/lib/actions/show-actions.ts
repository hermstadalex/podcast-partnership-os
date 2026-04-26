'use server'

import { createClient } from '@/lib/supabase/server';
import { captivateApi } from '@/lib/integrations/captivate';
import { 
  getShowByIdentifier, 
  resolveAuthorizedShow 
} from '@/lib/supabase/queries';

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
