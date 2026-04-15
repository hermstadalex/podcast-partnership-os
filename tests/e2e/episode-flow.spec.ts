import { test, expect } from '@playwright/test';

test.describe('Podcast Partnership OS - Episode MVP Flow', () => {
  test('Completes the Auto-Run MVP Happy Path', async ({ page }) => {
    // 1. Visit the homepage
    await page.goto('/');

    // 2. Open the AI Creator Wizard
    const newEpisodeBtn = page.locator('text="New AI Episode"');
    await expect(newEpisodeBtn).toBeVisible();
    await newEpisodeBtn.click();

    // Ensure the wizard modal title is valid
    await expect(page.locator('text="AI Episode Creator"')).toBeVisible();

    // 3. Locate the "Auto-Run Test Mode" button to skip actual file upload for the E2E
    const autoRunBtn = page.locator('text="Auto-Run Test Mode (Skip Upload)"');
    await expect(autoRunBtn).toBeVisible();
    await autoRunBtn.click();

    // 3. Verify it enters the GENERATING state and uses whitelabel terminology
    await expect(page.locator('text="AI Engine processing..."')).toBeVisible();

    // 4. Wait for generation to finish (Timeout up to 30s to simulate GenAI Network Call)
    // The UI should transition to the 'REVIEW' stage, showing "AI Suggested Title"
    const titleInputLabel = page.locator('text="AI Suggested Title"');
    await expect(titleInputLabel).toBeVisible({ timeout: 45000 });

    // Verify the visual fallback mechanism works (it falls into catch block because the dummy audio file doesn't exist natively on Localhost)
    // We will verify the user can type into the fallback boxes and finish
    const titleInput = page.locator('input').first();
    await titleInput.fill('Manual End-to-End Test Title');

    // 5. Click the Approve & Publish button
    const publishBtn = page.locator('text="Approve & Publish Pipeline"');
    await publishBtn.click();

    // 6. Verify Mock Sandbox handoff works instantly and displays the "Pipeline Active!" screen
    await expect(page.getByText('Pipeline Active!')).toBeVisible({ timeout: 5000 });
    
    // Verify Whitelabel copy check on success screen 
    await expect(page.getByText('configured distribution platforms')).toBeVisible();
  });
});
