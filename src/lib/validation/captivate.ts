import { z } from 'zod';

export const CaptivateShowSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  artwork: z.string().optional(),
  cover_art: z.string().optional(),
  image: z.string().optional(),
  summary: z.string().optional(),
  show_link: z.string().optional(),
  feed_link: z.string().optional(),
}).passthrough();

export const CaptivateShowsResponseSchema = z.object({
  shows: z.array(CaptivateShowSchema),
}).passthrough();

export const CaptivateShowResponseSchema = z.object({
  show: CaptivateShowSchema,
}).passthrough();

export type CaptivateShow = z.infer<typeof CaptivateShowSchema>;
