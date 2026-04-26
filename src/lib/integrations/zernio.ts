import 'server-only';
import { ZernioPostResponseSchema, type ZernioPostResponse } from '@/lib/validation/zernio';

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

export type ZernioPublishResult = {
  externalId: string;
  status: 'Published' | 'Processing';
  youtubeVideoId?: string | null;
  youtubeVideoUrl?: string | null;
  publishedAt?: string | null;
};

export class ZernioService {
  private baseUrl = 'https://zernio.com/api/v1';

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const apiKey = process.env.ZERNIO_API_KEY || '';
    
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

  async createPost(payload: ZernioPostPayload): Promise<ZernioPostResponse> {
    const data = await this.fetchApi('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return ZernioPostResponseSchema.parse(data);
  }

  async getSubmissionStatus(postId: string): Promise<ZernioPostResponse> {
    const data = await this.fetchApi(`/posts/${postId}`);
    return ZernioPostResponseSchema.parse(data);
  }

  /**
   * Constructs the payload for a Zernio YouTube post.
   */
  constructYouTubePayload(
    episode: { title: string; description: string; media_url: string },
    destinationAccount: { external_account_id: string; platform?: string | null } | null
  ): ZernioPostPayload {
    const accountId = process.env.ZERNIO_YOUTUBE_ACCOUNT_ID || destinationAccount?.external_account_id;
    if (!accountId) {
      throw new Error('Zernio account ID is required for publishing.');
    }

    return {
      content: episode.description,
      mediaItems: [{ type: 'video', url: episode.media_url }],
      publishNow: true,
      platforms: [
        {
          platform: destinationAccount?.platform || 'youtube',
          accountId: accountId,
          platformSpecificData: {
            title: episode.title,
            visibility: 'private',
          },
        },
      ],
    };
  }

  /**
   * High-level orchestration for publishing an episode to Zernio.
   * Encapsulates response parsing.
   */
  async publishEpisode(payload: ZernioPostPayload): Promise<ZernioPublishResult> {
    const data = await this.createPost(payload);
    
    const externalId = data.post?._id || data._id;
    if (!externalId) {
      throw new Error('Zernio response missing post ID.');
    }

    const isPublished = data.post?.status === 'published' || data.status === 'published';
    const status = isPublished ? 'Published' : 'Processing';

    const syncedPlatforms = data.post?.platforms || data.platforms || [];
    const ytPlatform = syncedPlatforms.find((p) => p.platform === 'youtube');

    return {
      externalId,
      status,
      youtubeVideoId: ytPlatform?.platformPostId || null,
      youtubeVideoUrl: ytPlatform?.platformPostUrl || null,
      publishedAt: ytPlatform?.publishedAt || data.post?.publishedAt || null,
    };
  }
}

export const zernioApi = new ZernioService();
