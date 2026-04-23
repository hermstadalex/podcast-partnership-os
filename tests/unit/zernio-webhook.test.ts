/** @jest-environment node */

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { POST } from '@/app/api/webhooks/zernio/route';

describe('Zernio webhook route', () => {
  const originalSecret = process.env.ZERNIO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.ZERNIO_WEBHOOK_SECRET = 'super-secret';
  });

  afterEach(() => {
    process.env.ZERNIO_WEBHOOK_SECRET = originalSecret;
    jest.clearAllMocks();
  });

  it('rejects malformed signatures with a 401 instead of a 500', async () => {
    const request = new Request('https://example.com/api/webhooks/zernio', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-zernio-signature': 'sha256=not-a-valid-hex-signature',
      },
      body: JSON.stringify({
        event: 'post.published',
        post: { _id: 'post-123' },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
