import { z } from 'zod';

export const EpisodeAssetsResultSchema = z.object({
  aiTitle: z.string().default('Untitled Episode'),
  aiDescription: z.string().default('No description provided.'),
}).passthrough();

export type EpisodeAssetsResult = z.infer<typeof EpisodeAssetsResultSchema>;
