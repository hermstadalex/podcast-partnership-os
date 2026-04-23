import '@testing-library/jest-dom';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {},
    files: {},
  })),
}));

jest.mock('@/lib/services/captivate', () => ({
  captivateApi: {
    createEpisode: jest.fn().mockResolvedValue({}),
    getShows: jest.fn(),
    updateShowMetadata: jest.fn(),
  },
}));

jest.mock('@/lib/services/zernio', () => ({
  zernioApi: {
    createPost: jest.fn().mockResolvedValue({ post: { _id: 'zernio-post-1' } }),
    getSubmissionStatus: jest.fn(),
  },
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

import { publishEpisode } from '@/app/actions';
import { captivateApi } from '@/lib/services/captivate';
import { zernioApi } from '@/lib/services/zernio';
import { createClient } from '@/lib/supabase/server';

type QueryState = {
  table: string;
  inserted: Record<string, unknown> | null;
  updated: Record<string, unknown> | null;
  filters: Record<string, unknown>;
};

function createQueryBuilder(table: string) {
  const state: QueryState = {
    table,
    inserted: null,
    updated: null,
    filters: {},
  };

  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn((payload: Record<string, unknown>) => {
      state.inserted = payload;
      return builder;
    }),
    update: jest.fn((payload: Record<string, unknown>) => {
      state.updated = payload;
      return builder;
    }),
    eq: jest.fn((column: string, value: unknown) => {
      state.filters[column] = value;
      return builder;
    }),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    maybeSingle: jest.fn(async () => {
      if (table === 'shows' && state.filters.id === 'show-1') {
        return {
          data: {
            id: 'show-1',
            client_id: 'client-1',
            captivate_show_id: 'captivate-show-1',
            title: 'Test Show',
          },
          error: null,
        };
      }

      if (table === 'show_publish_destinations' && state.filters.show_id === 'show-1') {
        return {
          data: {
            zernio_account_id: 'account-row-1',
            is_default: true,
          },
          error: null,
        };
      }

      if (table === 'zernio_accounts' && state.filters.id === 'account-row-1') {
        return {
          data: {
            id: 'account-row-1',
            external_account_id: 'youtube-account-1',
            platform: 'youtube',
          },
          error: null,
        };
      }

      return { data: null, error: null };
    }),
    single: jest.fn(async () => {
      if (table === 'episodes' && state.inserted) {
        return { data: { id: 'episode-1' }, error: null };
      }

      if (table === 'episode_publish_runs' && state.inserted?.provider === 'captivate') {
        return { data: { id: 'captivate-run-1' }, error: null };
      }

      if (table === 'episode_publish_runs' && state.inserted?.provider === 'zernio') {
        return { data: { id: 'zernio-run-1' }, error: null };
      }

      return { data: null, error: null };
    }),
  };

  return builder;
}

describe('Action: publishEpisode', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              email: 'podcastpartnership@gmail.com',
            },
          },
        }),
      },
      from: jest.fn((table: string) => createQueryBuilder(table)),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates canonical episode and publish run records before dispatching providers', async () => {
    const result = await publishEpisode('http://test.com/audio.mp3', 'Test Title', 'Notes', 'show-1');

    expect(result).toBe(true);
    expect(captivateApi.createEpisode).toHaveBeenCalledWith('captivate-show-1', {
      title: 'Test Title',
      description: 'Notes',
      mediaUrl: 'http://test.com/audio.mp3',
    });
    expect(zernioApi.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: [
          expect.objectContaining({
            accountId: 'youtube-account-1',
            platform: 'youtube',
          }),
        ],
      })
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[PIPELINE] Dispatched to Captivate Drafts.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[PIPELINE] Dispatched to Zernio YouTube Account:'));
  });
});
