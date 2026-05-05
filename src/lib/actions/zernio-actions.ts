'use server';

import { createClient } from '@/lib/supabase/server';
import { zernioApi } from '@/lib/integrations/zernio';
import { revalidatePath } from 'next/cache';

/**
 * Syncs Zernio Accounts for a given Client by checking the Zernio API for their connected platforms.
 */
export async function syncZernioAccountsForClient(clientId: string, externalProfileId: string) {
  const supabase = await createClient();

  // 1. Ensure the Zernio Profile exists locally
  let { data: profile, error: profileError } = await supabase
    .from('zernio_profiles')
    .select('id')
    .eq('client_id', clientId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new Error('Failed to query Zernio Profile: ' + profileError.message);
  }

  // Upsert Profile
  if (!profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('zernio_profiles')
      .insert({ client_id: clientId, external_profile_id: externalProfileId })
      .select('id')
      .single();

    if (insertError) throw new Error('Failed to create Zernio Profile: ' + insertError.message);
    profile = newProfile;
  } else {
    // Update external_profile_id if needed
    const { error: updateError } = await supabase
      .from('zernio_profiles')
      .update({ external_profile_id: externalProfileId, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updateError) throw new Error('Failed to update Zernio Profile: ' + updateError.message);
  }

  // 2. Fetch Accounts from Zernio
  const accounts = await zernioApi.getAccountsForProfile(externalProfileId);

  // 3. Upsert Accounts into Local Database
  if (accounts && accounts.length > 0) {
    for (const account of accounts) {
      // Assuming Zernio API returns something like:
      // { _id: 'ext-123', platform: 'youtube', displayName: 'Channel Name', ... }
      const externalAccountId = account._id || account.id || account.external_account_id || account.accountId;
      if (!externalAccountId) continue;

      const { error: accountError } = await supabase
        .from('zernio_accounts')
        .upsert(
          {
            zernio_profile_id: profile.id,
            external_account_id: externalAccountId,
            platform: account.platform || 'unknown',
            account_name: account.displayName || account.accountName || account.name || account.username || null,
            channel_title: account.displayName || account.channelTitle || account.title || account.username || null,
            raw_payload: account,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'external_account_id' }
        );

      if (accountError) {
        console.error('[SYNC ERROR] Failed to upsert Zernio account:', accountError.message);
      }
    }
  }

  revalidatePath('/shows');
  revalidatePath('/clients');
  
  return { success: true, count: accounts.length };
}
