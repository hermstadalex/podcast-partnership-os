import { ZernioService } from '@/lib/integrations/zernio';

describe('ZernioService', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.ZERNIO_API_KEY;

  beforeEach(() => {
    process.env.ZERNIO_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ status: 'ok' }),
    }) as jest.Mock;
  });

  afterEach(() => {
    process.env.ZERNIO_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('queries the posts endpoint when fetching publish status', async () => {
    const service = new ZernioService();

    await service.getSubmissionStatus('post-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts/post-123',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('creates posts through the posts endpoint', async () => {
    const service = new ZernioService();

    await service.createPost({
      content: 'Episode description',
      mediaItems: [{ type: 'video', url: 'https://example.com/video.mp4' }],
      publishNow: true,
      platforms: [{
        platform: 'youtube',
        accountId: 'account-123',
        platformSpecificData: {
          title: 'Episode title',
          visibility: 'private',
        },
      }],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://zernio.com/api/v1/posts',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
