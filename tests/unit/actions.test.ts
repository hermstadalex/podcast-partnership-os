import '@testing-library/jest-dom';
import { publishEpisode } from '@/app/actions';

jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(),
  }),
}));

// Mock dependencies that break Jest parsing or require env chains
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {},
    files: {},
  })),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn().mockImplementation(() => ({})),
}));// Mock console.log so we don't clutter the test output
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Action: publishEpisode', () => {
  it('handles the MVP sandbox integration and returns true unconditionally', async () => {
    // We are now wired to real endpoints, we must mock fetch to simulate success
    global.fetch = jest.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => {
         if (typeof url === 'string' && url.includes('authenticate')) return Promise.resolve({ user: { token: 'test' } });
         return Promise.resolve({});
      }
    })) as jest.Mock;

    process.env.ZERNIO_API_KEY = "test";
    process.env.ZERNIO_YOUTUBE_ACCOUNT_ID = "test";

    const result = await publishEpisode("http://test.com/audio.mp3", "Test Title", "Notes");
    expect(result).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[PIPELINE] Dispatched to Captivate Drafts.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[PIPELINE] Dispatched to Zernio YouTube Account:'));
  });
});
