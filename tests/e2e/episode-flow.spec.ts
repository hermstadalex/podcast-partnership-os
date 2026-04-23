import { test, expect } from '@playwright/test';

test.describe('Podcast Partnership OS - Episode MVP Flow', () => {
  test('Completes the Auto-Run review flow', async ({ page }) => {
    await page.context().addCookies([{
      name: 'podcastpartnership_e2e_role',
      value: 'admin',
      url: 'http://localhost:3001',
    }]);

    await page.goto('/');

    const newEpisodeBtn = page.getByRole('button', { name: 'New AI Episode' });
    await expect(newEpisodeBtn).toBeVisible();
    await newEpisodeBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('AI Episode Creator')).toBeVisible();

    const autoRunBtn = dialog.getByRole('button', { name: 'Auto-Run Test Mode (Skip Upload)' });
    await expect(autoRunBtn).toBeVisible();
    await autoRunBtn.click();

    await expect(dialog.getByText('AI Engine processing...')).toBeVisible();

    const titleInputLabel = dialog.getByText('AI Suggested Title');
    await expect(titleInputLabel).toBeVisible({ timeout: 45000 });

    const titleInput = dialog.locator('input').first();
    await titleInput.fill('Manual End-to-End Test Title');
    await expect(titleInput).toHaveValue('Manual End-to-End Test Title');

    await dialog.getByRole('button', { name: 'Delete & Cancel' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(newEpisodeBtn).toBeVisible();
  });
});
