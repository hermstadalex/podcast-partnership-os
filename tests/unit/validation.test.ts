import { ZernioPostResponseSchema } from '@/lib/validation/zernio';
import { CaptivateShowsResponseSchema } from '@/lib/validation/captivate';
import { EpisodeAssetsResultSchema } from '@/lib/validation/gemini';

describe('Data Validation Schemas', () => {
  describe('ZernioPostResponseSchema', () => {
    it('should parse valid nested Zernio response', () => {
      const validData = {
        post: {
          _id: 'post_123',
          status: 'published',
          platforms: [
            { platform: 'youtube', platformPostId: 'yt_456' }
          ]
        }
      };
      const result = ZernioPostResponseSchema.parse(validData);
      expect(result.post?._id).toBe('post_123');
    });

    it('should throw on missing required fields in post', () => {
      const invalidData = {
        post: {
          _id: 'post_123'
          // missing status
        }
      };
      expect(() => ZernioPostResponseSchema.parse(invalidData)).toThrow();
    });

    it('should passthrough unknown fields', () => {
      const dataWithExtras = {
        _id: '123',
        extra_field: 'something',
        post: {
          _id: 'post_123',
          status: 'draft',
          unknown_nested: 42
        }
      };
      const result = ZernioPostResponseSchema.parse(dataWithExtras) as any;
      expect(result.extra_field).toBe('something');
      expect(result.post.unknown_nested).toBe(42);
    });
  });

  describe('CaptivateShowsResponseSchema', () => {
    it('should parse valid shows list', () => {
      const validData = {
        shows: [
          { id: 'show_1', title: 'Show 1' }
        ]
      };
      const result = CaptivateShowsResponseSchema.parse(validData);
      expect(result.shows[0].title).toBe('Show 1');
    });

    it('should throw if shows is not an array', () => {
      const invalidData = { shows: {} };
      expect(() => CaptivateShowsResponseSchema.parse(invalidData)).toThrow();
    });
  });

  describe('EpisodeAssetsResultSchema', () => {
    it('should use defaults for empty object', () => {
      const result = EpisodeAssetsResultSchema.parse({});
      expect(result.aiTitle).toBe('Untitled Episode');
      expect(result.aiDescription).toBe('No description provided.');
    });

    it('should parse valid AI results', () => {
      const validData = {
        aiTitle: 'New Title',
        aiDescription: 'New Description'
      };
      const result = EpisodeAssetsResultSchema.parse(validData);
      expect(result.aiTitle).toBe('New Title');
    });
  });
});
