// src/lib/services/zernio.ts

export class ZernioService {
  private apiKey: string;
  private baseUrl = 'https://api.zernio.com/v1';

  constructor() {
    this.apiKey = process.env.ZERNIO_API_KEY || '';
    if (!this.apiKey) {
      console.warn("ZERNIO_API_KEY is not defined");
    }
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const res = await fetch(`\${this.baseUrl}\${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer \${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Zernio API error: \${res.statusText}`);
    }

    return res.json();
  }

  async triggerSubmission(profileId: string, connectionId: string, data: { title: string, description: string, mediaUrl: string }) {
    return this.fetchApi(`/profiles/\${profileId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({
        connectionId,
        asset: {
          url: data.mediaUrl,
          title: data.title,
          description: data.description
        },
        autoPublish: true
      })
    });
  }

  async getSubmissionStatus(jobId: string) {
    return this.fetchApi(`/submissions/\${jobId}`);
  }
}

export const zernioApi = new ZernioService();
