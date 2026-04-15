// src/lib/services/captivate.ts
type ShowMetadata = {
  title: string;
  image?: string;
  description?: string;
  author?: string;
};

export class CaptivateService {
  private apiKey: string;
  private userId: string;
  private baseUrl = 'https://api.captivate.fm/v2'; // Assuming v2 endpoints
  private token: string | null = null;

  constructor() {
    this.apiKey = process.env.CAPTIVATE_API_KEY || '';
    this.userId = process.env.CAPTIVATE_USER_ID || '';
    if (!this.apiKey || !this.userId) {
      console.warn("CAPTIVATE_API_KEY or CAPTIVATE_USER_ID is not defined");
    }
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
    return this.fetchApi('/shows');
  }

  async getShowMetadata(id: string) {
    return this.fetchApi(`/shows/${id}`);
  }

  async updateShowMetadata(id: string, data: Partial<ShowMetadata>) {
    return this.fetchApi(`/shows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
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
