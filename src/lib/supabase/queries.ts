import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type UserRecord = {
  email?: string | null;
};

export type ClientRecord = {
  id: string;
  email: string;
  name: string;
};

export type ShowRecord = {
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

export type PublishDestinationAccount = {
  id: string;
  external_account_id: string;
  platform?: string | null;
};

export async function getShowByIdentifier(supabase: SupabaseClient, identifier: string) {
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

export async function getClientByEmail(supabase: SupabaseClient, email: string) {
  const { data } = await supabase
    .from('clients')
    .select('id, email, name')
    .eq('email', email)
    .single();

  return (data || null) as ClientRecord | null;
}

export async function resolveAuthorizedShow(
  supabase: SupabaseClient,
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

export async function getDefaultDestinationAccount(
  supabase: SupabaseClient,
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

export async function createPublishRun(
  supabase: SupabaseClient,
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
