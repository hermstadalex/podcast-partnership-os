import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = process.env.CAPTIVATE_API_KEY!;
  const userId = process.env.CAPTIVATE_USER_ID!;
  
  const formData = new URLSearchParams();
  formData.append('username', userId);
  formData.append('token', apiKey);

  const authRes = await fetch(`https://api.captivate.fm/authenticate/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
  });
  
  const authData = await authRes.json();
  const token = authData.user?.token;

  const showId = '44b65556-406f-4a16-8bce-4dd25f0a1de8'; // Practical Podcasting
  
  const getRes = await fetch(`https://api.captivate.fm/shows/${showId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
  });
  const getJson = await getRes.json();
  const show = getJson.show;

  const toDelete = new Set([
      'id', 'status', 'file_name', 'created', 'last_feed_generation', 
      'owner_user_id', 'captivate_spark_tokens', 'episode_count', 
      'amie_conversion_status', 'dax_check_for_ad_slots', 'import', 
      'failed_import', 'imported_from', 'imported_rss_feed', 
      'import_cancel_key', 'import_errors', 'spotify_uri', 
      'apple_submission_id', 'podcast_guid', 'third_party_rights',
      'feature_preview', 'amie_bulk_edit_count', 'display_used_research_links_default', 
      'dax_enabled', 'default_pre_roll_slots', 'default_post_roll_slots', 
      'suppress_suspicious_emails', 'release_frequency', 'default_mid_roll_slots', 
      'ads_active', 'spark_enabled', 'amie_version', 'video_enabled', 
      'show_link', 'stripe_account_onboarded', 'subscription_late', 
      'captivate_spark_addon_enabled', 'google_categories', 'spotify_status',
      'enabled_site', 'custom_website_domain', 'custom_website_domain_launched', 
      'custom_website_domain_first_launch_attempt_at', 'amazon_submitted', 
      'country_of_origin', 'gaana_submitted', 'jiosaavn_submitted', 
      'podcast_index_submitted', 'player_fm_submitted', 'deezer_submitted',
      'feed_link'
  ]);

  const cleanShow: any = {};
  for (const key in show) {
      if (show[key] !== null) {
          cleanShow[key] = show[key];
      }
  }

  for (const k of Array.from(toDelete)) delete cleanShow[k];

  const arrayKeys = ['categories', 'prefixes'];
  for (const k of arrayKeys) {
      if (typeof cleanShow[k] === 'string') {
          try { cleanShow[k] = JSON.parse(cleanShow[k]); } catch (e) {}
      } else if (!cleanShow[k]) {
          cleanShow[k] = [];
      }
  }

  if (!cleanShow.summary) cleanShow.summary = cleanShow.description || "";

  const boolKeys = [
      'legacy_analytics_visible', 'ads_active', 'spark_enabled', 'video_enabled',
      'captivate_spark_addon_enabled', 'stripe_account_onboarded',
      'subscription_late', 'feature_preview', 'suppress_suspicious_emails',
      'amie_publish_to_youtube'
  ];
  for (const k of boolKeys) {
      if (cleanShow[k] !== undefined) {
          cleanShow[k] = cleanShow[k] === 1 || cleanShow[k] === true || cleanShow[k] === "1" || cleanShow[k] === "true";
      }
  }

  // Use the exact current show_link or feed_link from the unmodified GET response
  cleanShow.subdomain = show.show_link || show.feed_link;
  
  let test1Res = await fetch(`https://api.captivate.fm/shows/${showId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanShow)
  });
  const t1 = await test1Res.text();

  return NextResponse.json({
      t1, showLink: show.show_link, feedLink: show.feed_link
  });
}
