import { z } from 'zod';

/**
 * Validates only the fields we actually use from Zernio platform status objects.
 */
export const ZernioPlatformStatusSchema = z.object({
  platform: z.string(),
  platformPostId: z.string().optional(),
  platformPostUrl: z.string().optional(),
  publishedAt: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

/**
 * Validates the Zernio Post response, supporting both nested and flat structures
 * used by different versions of the Zernio API response.
 */
export const ZernioPostResponseSchema = z.object({
  _id: z.string().optional(),
  post: z.object({
    _id: z.string(),
    status: z.string(),
    platforms: z.array(ZernioPlatformStatusSchema).optional(),
    publishedAt: z.string().optional(),
  }).passthrough().optional(),
  status: z.string().optional(),
  platforms: z.array(ZernioPlatformStatusSchema).optional(),
}).passthrough();

export type ZernioPostResponse = z.infer<typeof ZernioPostResponseSchema>;
export type ZernioPlatformStatus = z.infer<typeof ZernioPlatformStatusSchema>;
