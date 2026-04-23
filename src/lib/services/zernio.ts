// src/lib/services/zernio.ts

export type ZernioPostPayload = {
  content: string;
  mediaItems: Array<{
    type: string;
    url: string;
  }>;
  publishNow?: boolean;
  platforms: Array<{
    platform: string;
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
};

export class ZernioService {
  private baseUrl = 'https://zernio.com/api/v1';

  constructor() {
    // API key evaluation deferred to fetchApi to bypass Next.js module load timings
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const apiKey = process.env.ZERNIO_API_KEY || '';
    if (!apiKey) {
      console.warn("[ZernioService] ZERNIO_API_KEY is dynamically undefined at request time.");
    }
    
    console.log(`[ZERNIO] Making request to ${this.baseUrl}${endpoint}`);
    console.log(`[ZERNIO] API Key Length: ${apiKey.length}, First 5 chars: ${apiKey.substring(0, 5)}`);

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PodcastPartnershipOS/1.0',
        ...options.headers,
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch (e) {
        bodyText = 'unreadable body';
      }
      console.error(`[ZERNIO ERROR] Status: ${res.status} ${res.statusText}`);
      console.error(`[ZERNIO ERROR] Body: ${bodyText}`);
      throw new Error(`Zernio API error: ${res.statusText}`);
    }

    return res.json();
  }

  async createPost(payload: ZernioPostPayload) {
    return this.fetchApi('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSubmissionStatus(postId: string) {
    return this.fetchApi(`/posts/${postId}`);
  }
}

export const zernioApi = new ZernioService();
