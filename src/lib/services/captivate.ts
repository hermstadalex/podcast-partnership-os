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
    
    // According to captivate API, we authenticate using username (userId) and token (apiKey)
    const res = await fetch(`\${this.baseUrl}/authenticate/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.userId,
        token: this.apiKey
      })
    });
    
    if (!res.ok) {
        throw new Error(`Failed to authenticate with Captivate API`);
    }
    const data = await res.json();
    this.token = data.user.token;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    await this.authenticate();
    const res = await fetch(`\${this.baseUrl}\${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer \${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Captivate API error: \${res.statusText}`);
    }

    return res.json();
  }

  async getShows() {
    return this.fetchApi('/shows');
  }

  async getShowMetadata(id: string) {
    return this.fetchApi(`/shows/\${id}`);
  }

  async updateShowMetadata(id: string, data: Partial<ShowMetadata>) {
    return this.fetchApi(`/shows/\${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async createEpisode(showId: string, data: { title: string, description: string, mediaUrl: string }) {
    return this.fetchApi(`/shows/\${showId}/episodes`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        shownotes: data.description,
        media_url: data.mediaUrl,
        status: 'Draft' // Assume draft by default based on MVP description "staging area"
      })
    });
  }
}

export const captivateApi = new CaptivateService();
