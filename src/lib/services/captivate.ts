// src/lib/services/captivate.ts
type ShowMetadata = {
  title: string;
  image?: string;
  description?: string;
  author?: string;
};

export class CaptivateService {
  private baseUrl = 'https://api.captivate.fm/v2'; // Assuming v2 endpoints
  private token: string | null = null;

  private get apiKey() {
    return process.env.CAPTIVATE_API_KEY || '';
  }

  private get userId() {
    return process.env.CAPTIVATE_USER_ID || '';
  }

  constructor() {
    // API key evaluation deferred to dynamic getters to bypass Next.js module load timings
  }

  private async authenticate() {
    if (this.token) return;
    
    // Captivate API requires form-data for auth at the root endpoint (not v2)
    const formData = new URLSearchParams();
    formData.append('username', this.userId);
    formData.append('token', this.apiKey);

    const res = await fetch(`https://api.captivate.fm/authenticate/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    if (!res.ok) {
        throw new Error(`Failed to authenticate with Captivate API`);
    }
    const data = await res.json();
    this.token = data.user.token;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    await this.authenticate();
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
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

  async getShows() {
    await this.authenticate();
    const rootUrl = this.baseUrl.replace('/v2', '');
    const res = await fetch(`${rootUrl}/users/${this.userId}/shows`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!res.ok) throw new Error(`Captivate API error: ${res.statusText}`);
    return res.json();
  }

  async getShowMetadata(id: string) {
    await this.authenticate();
    const rootUrl = this.baseUrl.replace('/v2', '');
    const res = await fetch(`${rootUrl}/shows/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      }
    });
    if (!res.ok) throw new Error(`Captivate API error: ${res.statusText}`);
    return res.json();
  }

  async updateShowMetadata(id: string, data: Partial<ShowMetadata>) {
    await this.authenticate();
    const rootUrl = this.baseUrl.replace('/v2', '');
    
    // 1. Fetch current full metadata
    const getRes = await fetch(`${rootUrl}/shows/${id}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    if (!getRes.ok) throw new Error(`Captivate API error fetching show: ${getRes.statusText}`);
    const getJson = await getRes.json();
    const show = getJson.show;

    // 2. Normalize and strip bad properties that Captivate's validator rejects
    const cleanShow: any = {};
    for (const key in show) {
      if (show[key] !== null) {
        cleanShow[key] = show[key];
      }
    }

    // Ensure subdomain is generated from the raw, unscrubbed show object
    // before the base properties like show_link are blacklisted and deleted.
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
    const putRes = await fetch(`${rootUrl}/shows/${id}`, {
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

  async createEpisode(showId: string, data: { title: string, description: string, mediaUrl: string }) {
    await this.authenticate();
    
    const formData = new FormData();
    formData.append('shows_id', showId);
    formData.append('title', data.title);
    formData.append('shownotes', data.description);
    formData.append('media_id', ''); // Usually expected but optional for Drafts depending on config
    formData.append('status', 'Draft');
    formData.append('episode_type', 'full');
    
    // According to docs, POST /episodes takes FormData, not JSON.
    // The V2 base URL cannot be used here because the episode endpoint is in the root path.
    const rootUrl = this.baseUrl.replace('/v2', '');
    const res = await fetch(`${rootUrl}/episodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        // Note: Do NOT set Content-Type header manually when using FormData, 
        // the browser/fetch automatically sets it with the proper boundary!
      },
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Captivate API error: ${res.statusText}`);
    }

    return res.json();
  }
}

export const captivateApi = new CaptivateService();
