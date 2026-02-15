import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Playwright script to capture high-quality screenshots at exactly 1280x800
 * for use in the Chrome Web Store and Edge Add-ons listings.
 */

const SCREENSHOT_DIR = 'assets/screenshots';

// Ensure the directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test('capture listing screenshots', async ({ page }) => {
  // 1. Start the dev server
  await page.goto('http://localhost:5173/sandbox.html');
  await page.waitForLoadState('networkidle');

  // Set the EXACT viewport size required by the store
  await page.setViewportSize({ width: 1280, height: 800 });

  // Wait for the sandbox app to render
  await page.waitForSelector('sandbox-app');

  // Helper to capture a clean 1280x800 screenshot focusing on an element
  const captureFullSize = async (name: string, focusSelector?: string) => {
    if (focusSelector) {
      await page.locator(focusSelector).first().scrollIntoViewIfNeeded();
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, name),
      omitBackground: false, // Store requires NO ALPHA
      fullPage: false, // Maintain 1280x800 exactly
    });
    console.log(`Captured: ${name} (1280x800)`);
  };

  // --- 1. The Popup View ---
  await captureFullSize('popup-main.png', '.popup-frame');

  // --- 2. Search Integration ---
  await captureFullSize('search-sidebar.png', 'search-sidebar');

  // --- 3. Badge: Available ---
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.scenario-card');
    cards.forEach((c, i) => {
      (c as HTMLElement).style.display = i === 0 ? 'block' : 'none';
    });
  });
  await captureFullSize('badge-movie-available.png', 'media-status-badge');

  // --- 4. Badge: Unavailable ---
  await page.reload();
  await page.waitForSelector('sandbox-app');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.scenario-card');
    cards.forEach((c, i) => {
      (c as HTMLElement).style.display = i === 1 ? 'block' : 'none';
    });
  });
  await captureFullSize('badge-movie-unavailable.png', 'media-status-badge');

  // --- 5. Features Overview ---
  await page.reload();
  await page.waitForSelector('sandbox-app');
  await captureFullSize('features-grid.png', '.section');

  console.log(
    '\n✅ All listing screenshots captured with original names at 1280x800 in assets/screenshots/',
  );
});
