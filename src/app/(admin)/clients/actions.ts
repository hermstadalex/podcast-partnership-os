'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@supabase/supabase-js';

export async function createClientAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email !== 'podcastpartnership@gmail.com') {
    return { error: 'Unauthorized. Root access required.' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const show_id = formData.get('show_id') as string;
  const zernio_profile_id = formData.get('zernio_profile_id') as string;
  const zernio_account_id = formData.get('zernio_account_id') as string;

  if (!name || !email || !show_id || !zernio_profile_id || !zernio_account_id) {
    return { error: 'All fields are strictly required.' };
  }

  const { data: selectedShow, error: showError } = await supabase
    .from('shows')
    .select('id, client_id, captivate_show_id')
    .eq('id', show_id)
    .single();

  if (showError || !selectedShow) {
    return { error: 'The selected show could not be found locally. Sync shows from Captivate and try again.' };
  }

  if (selectedShow.client_id) {
    return { error: 'That show is already assigned to another client.' };
  }

  // Setup a detached client to prevent mutating the Admin's active session
  const detachedSupabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // Generate a reliable temporary password
  const tempPassword = `Pass${Math.floor(1000 + Math.random() * 9000)}-${name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')}`;

  const { error: authError } = await detachedSupabase.auth.signUp({
    email,
    password: tempPassword,
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
        // They might already have an account, which is fine, we just won't throw
    } else {
        return { error: `Failed to provision Auth entity: ${authError.message}` };
    }
  }

  // Insert into public.clients mapping
  const { data: clientRecord, error } = await supabase
    .from('clients')
    .insert({
      name,
      email,
      captivate_show_id: selectedShow.captivate_show_id,
      zernio_account_id
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
       return { error: 'A client with this email or Show ID is already provisioned.' };
    }
    return { error: `Database mapped error: ${error.message}` };
  }

  const clientId = clientRecord.id as string;

  await supabase
    .from('shows')
    .update({ client_id: clientId, updated_at: new Date().toISOString() })
    .eq('id', selectedShow.id);

  const { data: zernioProfile, error: zernioProfileError } = await supabase
    .from('zernio_profiles')
    .upsert(
      {
        client_id: clientId,
        external_profile_id: zernio_profile_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    )
    .select('id')
    .single();

  if (zernioProfileError || !zernioProfile) {
    return { error: `Failed to persist the Zernio profile: ${zernioProfileError?.message || 'Unknown error'}` };
  }

  const { data: zernioAccount, error: zernioAccountError } = await supabase
    .from('zernio_accounts')
    .upsert(
      {
        zernio_profile_id: zernioProfile.id,
        external_account_id: zernio_account_id,
        platform: 'youtube',
        account_name: name,
        channel_title: name,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'external_account_id' }
    )
    .select('id')
    .single();

  if (zernioAccountError || !zernioAccount) {
    return { error: `Failed to persist the Zernio account: ${zernioAccountError?.message || 'Unknown error'}` };
  }

  const { error: destinationError } = await supabase
    .from('show_publish_destinations')
    .upsert(
      {
        show_id: selectedShow.id,
        zernio_account_id: zernioAccount.id,
        is_default: true,
      },
      { onConflict: 'show_id,zernio_account_id' }
    );

  if (destinationError) {
    return { error: `Failed to map the show destination: ${destinationError.message}` };
  }

  return { success: true, tempPassword };
}
