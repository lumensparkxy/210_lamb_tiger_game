import { test as setup, expect } from '@playwright/test';
import fs from 'fs';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ browser }) => {
  // Check if auth file exists and is recent (e.g., < 15 mins)
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const now = new Date().getTime();
    const mtime = new Date(stats.mtime).getTime();
    const diffMinutes = (now - mtime) / (1000 * 60);

    if (diffMinutes < 15) {
      console.log(`Auth file is recent (${diffMinutes.toFixed(1)} mins). Verifying validity...`);
      const context = await browser.newContext({ storageState: authFile });
      const page = await context.newPage();
      
      try {
        await page.goto('http://localhost:5173');
        await expect(page.getByRole('button', { name: '🚪 Sign Out' })).toBeVisible({ timeout: 5000 });
        console.log('Session is still valid. Skipping login.');
        await context.close();
        return;
      } catch (e) {
        console.log('Session expired or invalid. Re-authenticating...');
        await context.close();
      }
    } else {
        console.log(`Auth file is too old (${diffMinutes.toFixed(1)} mins). Re-authenticating...`);
    }
  }

  // Perform Login
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  
  // Wait for the login overlay
  await expect(page.locator('.login-overlay')).toBeVisible();

  // Click "Continue with Google" and handle the popup
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Continue with Google' }).click(),
  ]);

  // Interact with the Google login popup
  await popup.waitForLoadState();
  
  // Email
  await popup.getByLabel('Email or phone').fill('neophilex');
  await popup.getByRole('button', { name: 'Next' }).click();

  // Wait for password field to appear
  // Google's password field usually has type="password"
  await popup.getByText('Enter your password').waitFor({ state: 'visible', timeout: 10000 });

  // Password
  await popup.getByLabel('Enter your password').fill('Pa$$port.99');
  await popup.getByRole('button', { name: 'Next' }).click();

  // Wait for the popup to close (login successful)
  await popup.waitForEvent('close');

  // Verify we are logged in (e.g., "Sign Out" button is visible)
  await expect(page.getByRole('button', { name: '🚪 Sign Out' })).toBeVisible();

  // Save storage state
  await page.context().storageState({ path: authFile });
  await context.close();
});
