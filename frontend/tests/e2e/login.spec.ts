import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('Login modal appears on load', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Verify title
  await expect(page).toHaveTitle(/Aadu Puli Aattam/);

  // Verify Login Modal is visible
  const loginOverlay = page.locator('.login-overlay');
  await expect(loginOverlay).toBeVisible();

  // Verify "Continue with Google" button is present
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
