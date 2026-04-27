import 'server-only';
import { 
  CaptivateShowsResponseSchema, 
  CaptivateShowResponseSchema, 
  type CaptivateShow 
} from '@/lib/validation/captivate';

export type CaptivateEpisodePayload = {
  title: string;
  shownotes: string;          // HTML content, max 4000 chars
  mediaUrl?: string;
  mediaId?: string;
  status: 'Draft' | 'Scheduled' | 'Published';
  date?: string;               // 'YYYY-MM-DD HH:mm:ss' format for scheduling
  episodeSeason?: number;
  episodeNumber?: number;
  episodeArt?: string;         // URL to episode-specific artwork
  episodeType?: 'full' | 'trailer' | 'bonus';
  summary?: string;            // Apple Podcasts summary, max 4000 chars
};

export type CaptivateShowMetadataUpdate = {
  title?: string;
  description?: string;
  author?: string;
  image?: string;
  cover_art?: string;
};

export class CaptivateService {
  private baseUrl = 'https://api.captivate.fm';
  private token: string | null = null;

  private get apiKey() {
    return process.env.CAPTIVATE_API_KEY || '';
  }

  private get userId() {
    return process.env.CAPTIVATE_USER_ID || '';
  }

  private async authenticate() {
    if (this.token) return;

    const formData = new URLSearchParams();
    formData.append('username', this.userId);
    formData.append('token', this.apiKey);

    const res = await fetch(`${this.baseUrl}/authenticate/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      throw new Error(`Failed to authenticate with Captivate API: ${res.statusText}`);
    }
    const data = await res.json();
    this.token = data.user.token;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    await this.authenticate();
    const res = await fetch(`${this.baseUrl}/v2${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Captivate API error: ${res.statusText}`);
    }

    return res.json();
  }

  async getShows(): Promise<{ shows: CaptivateShow[] }> {
    await this.authenticate();
    const res = await fetch(`${this.baseUrl}/users/${this.userId}/shows`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`Captivate API error: ${res.statusText}`);
    const data = await res.json();
    return CaptivateShowsResponseSchema.parse(data);
  }

  async updateShowMetadata(id: string, data: CaptivateShowMetadataUpdate) {
    await this.authenticate();
    
    // 1. Fetch current full metadata (Captivate PUT requires full objects for some fields)
    const getRes = await fetch(`${this.baseUrl}/shows/${id}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    if (!getRes.ok) throw new Error(`Captivate API error fetching show: ${getRes.statusText}`);
    const getJsonRaw = await getRes.json();
    const getJson = CaptivateShowResponseSchema.parse(getJsonRaw);
    const show = getJson.show as any;

    // 2. Normalize and strip bad properties that Captivate's validator rejects
    const cleanShow: any = {};
    for (const key in show) {
      if (show[key] !== null) {
        cleanShow[key] = show[key];
      }
    }

    if (!cleanShow.subdomain) {
      cleanShow.subdomain = show.show_link || show.feed_link || "test";
    }

    const toDelete = [
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
      'feed_link', 'show_link', 'stripe_account_onboarded', 'subscription_late', 
      'captivate_spark_addon_enabled', 'google_categories', 'spotify_status',
      'enabled_site', 'custom_website_domain', 'custom_website_domain_launched', 
      'custom_website_domain_first_launch_attempt_at', 'amazon_submitted', 
      'country_of_origin', 'gaana_submitted', 'jiosaavn_submitted', 
      'podcast_index_submitted', 'player_fm_submitted', 'deezer_submitted'
    ];
    for (const k of toDelete) delete cleanShow[k];

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
      'subscription_late', 'feature_preview', 'suppress_suspicious_emails'
    ];
    for (const k of boolKeys) {
      if (cleanShow[k] !== undefined) {
        cleanShow[k] = cleanShow[k] === 1 || cleanShow[k] === true || cleanShow[k] === "1" || cleanShow[k] === "true";
      }
    }

    // 3. Merge user updates
    if (data.title) cleanShow.title = data.title;
    if (data.description) {
      cleanShow.description = data.description;
      cleanShow.summary = data.description;
    }
    if (data.author) cleanShow.author = data.author;
    if (data.image) cleanShow.artwork = data.image;

    // 4. Put merged object back
    const putRes = await fetch(`${this.baseUrl}/shows/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanShow)
    });
    
    if (!putRes.ok) {
       const errBody = await putRes.text();
       console.error("Captivate PUT error payload:", errBody);
       throw new Error(`Captivate API error: ${putRes.statusText}`);
    }
    return putRes.json();
  }

  async uploadMedia(showId: string, mediaUrl: string): Promise<string> {
    await this.authenticate();
    
    console.log(`[CAPTIVATE] Downloading media from Supabase: ${mediaUrl}`);
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media from Supabase: ${mediaResponse.statusText}`);
    }
    
    // Read the arrayBuffer instead of blob to ensure we can recreate a clean Blob
    const arrayBuffer = await mediaResponse.arrayBuffer();
    
    // Force an audio MIME type because Supabase often defaults to application/octet-stream,
    // which the Captivate API strictly rejects with a 400 error.
    const fileBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    
    const formData = new FormData();
    const filename = mediaUrl.split('/').pop() || 'episode.mp3';
    
    // Ensure filename ends with .mp3 for Captivate's internal parser
    const finalFilename = filename.endsWith('.mp3') || filename.endsWith('.m4a') ? filename : `${filename}.mp3`;
    
    formData.append('file', fileBlob, finalFilename);

    console.log(`[CAPTIVATE] Uploading media to Captivate for show ${showId}, filename: ${finalFilename}`);
    const uploadRes = await fetch(`${this.baseUrl}/shows/${showId}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => '');
      console.error("[CAPTIVATE] Media upload rejected:", uploadRes.status, errText);
      
      // Try to extract a clean JSON error message if possible
      let cleanError = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) cleanError = JSON.stringify(parsed.error);
        if (parsed.message) cleanError = parsed.message;
      } catch (e) { }
      
      throw new Error(`Captivate media upload failed: ${uploadRes.status} ${cleanError}`);
    }

    const uploadData = await uploadRes.json();
    console.log("[CAPTIVATE] Media upload successful!", JSON.stringify(uploadData).substring(0, 100));
    
    // Depending on Captivate's undocumented payload structure:
    const mediaId = uploadData?.media?.id || uploadData?.id || uploadData?.new_media_id || uploadData?.media_id;
    if (!mediaId) {
       console.error("[CAPTIVATE] Media upload successful but no media_id found:", JSON.stringify(uploadData).substring(0, 300));
       throw new Error(`Could not parse media_id from response: ${JSON.stringify(uploadData).substring(0, 200)}`);
    }
    return mediaId;
  }

  async createEpisode(showId: string, data: CaptivateEpisodePayload) {
    await this.authenticate();
    
    const formData = new FormData();
    formData.append('shows_id', showId);
    formData.append('title', data.title.substring(0, 255));
    formData.append('shownotes', data.shownotes.substring(0, 4000));
    formData.append('media_id', data.mediaId || ''); // Required by API even if empty
    formData.append('status', data.status || 'Draft');
    formData.append('episode_type', data.episodeType || 'full');
    
    if (data.date) {
      formData.append('date', data.date);
    }
    if (data.episodeSeason !== undefined && data.episodeSeason !== null) {
      formData.append('episode_season', String(data.episodeSeason));
    }
    if (data.episodeNumber !== undefined && data.episodeNumber !== null) {
      formData.append('episode_number', String(data.episodeNumber));
    }
    if (data.episodeArt) {
      formData.append('episode_art', data.episodeArt);
    }
    if (data.summary) {
      formData.append('summary', data.summary);
    }
    
    const res = await fetch(`${this.baseUrl}/episodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '');
      console.error(`[CAPTIVATE] createEpisode failed with ${res.status}:`, errorBody);
      let errMsg = res.statusText;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.message && parsed.errors) {
          errMsg = `${parsed.message}: ${JSON.stringify(parsed.errors)}`;
        } else if (parsed.message) {
          errMsg = parsed.message;
        } else if (parsed.errors) {
          errMsg = JSON.stringify(parsed.errors);
        } else {
          errMsg = errorBody.substring(0, 200);
        }
      } catch (e) {
        errMsg = errorBody ? errorBody.substring(0, 200) : res.statusText;
      }
      throw new Error(`Captivate API error: ${errMsg}`);
    }

    return res.json();
  }
}

export const captivateApi = new CaptivateService();
