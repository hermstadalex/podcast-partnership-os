'use server';

import { generateViralPostAssetsWithGemini, type ViralPostAssetsResult } from '@/lib/integrations/gemini';

export async function generateViralAssetsAction(
  mediaUrl: string,
  topicSummary: string
): Promise<{ success: boolean; data?: ViralPostAssetsResult; error?: string }> {
  try {
    if (!mediaUrl) throw new Error('No media URL provided');
    if (!topicSummary) throw new Error('No topic summary provided');

    const data = await generateViralPostAssetsWithGemini(mediaUrl, topicSummary);

    return { success: true, data };
  } catch (error: any) {
    console.error('[VIRAL_ACTIONS] generateViralAssetsAction error:', error);
    return { success: false, error: error.message || 'Failed to generate viral assets' };
  }
}
