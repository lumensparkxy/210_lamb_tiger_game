import { test, expect } from '@playwright/test';

test('Play as Tiger vs AI', async ({ page }) => {
  // 1. Navigate to home (should be logged in via storageState)
  await page.goto('http://localhost:5173');

  // Verify we are logged in
  await expect(page.getByRole('button', { name: '🚪 Sign Out' })).toBeVisible();

  // 2. Start Game: Tiger vs AI
  await page.getByRole('button', { name: 'Tiger vs AI 🤖' }).click();

  // 3. Verify Game Board loads
  await expect(page.locator('.board-container')).toBeVisible();
  
  // Verify Initial State
  // Tigers should be at 0, 1, 2
  await expect(page.getByTestId('node-0')).toContainText('🐯');
  await expect(page.getByTestId('node-1')).toContainText('🐯');
  await expect(page.getByTestId('node-2')).toContainText('🐯');

  // Verify it is Tiger's turn (AI Goat should have moved already)
  // The turn indicator should say "TIGER"
  await expect(page.locator('.turn-indicator')).toContainText('TIGER');
  
  // Verify there is at least one Goat on the board
  const goats = page.locator('text=🐐');
  await expect(goats).toHaveCount(1);

  // 4. Make a Move
  // Try to move Tiger from Node 0 to Node 4, 5, or 3 (whichever is empty)
  // Node 0 connects to 2, 3, 4, 5. Node 2 is occupied by Tiger.
  
  // Select Node 0
  await page.getByTestId('node-0').click();
  
  // Check if Node 0 is selected (visual feedback)
  // The circle inside should have stroke width 2 and specific color, but we can just proceed to click target.
  
  let targetNode = 4;
  const node4Content = await page.getByTestId('node-4').textContent();
  if (node4Content?.includes('🐐')) {
    // Node 4 is occupied, try Node 5
    targetNode = 5;
    const node5Content = await page.getByTestId('node-5').textContent();
    if (node5Content?.includes('🐐')) {
        // Node 5 is occupied, try Node 3
        targetNode = 3;
    }
  }
  
  console.log(`Attempting to move Tiger from 0 to ${targetNode}`);
  await page.getByTestId(`node-${targetNode}`).click();

  // 5. Verify Turn Changes to GOAT
  // The AI moves very fast, so it might switch back to TIGER almost instantly.
  // But we should see the turn indicator change or at least the board state change.
  // A better check is to wait for the Goat count to increase to 2.
  
  await expect(async () => {
    const goatCount = await page.locator('text=🐐').count();
    expect(goatCount).toBe(2);
  }).toPass({ timeout: 5000 });

  // Verify it is Tiger's turn again
  await expect(page.locator('.turn-indicator')).toContainText('TIGER');
});
