import { test, expect } from '@playwright/test';
import { setupContentScript, mockResponses } from './e2e-helpers';

test.describe('Netflix — content script injection', () => {
  test('injects status indicator for a TV series', async ({ page }) => {
    await setupContentScript(page, 'netflix-series.html', {
      CHECK_MEDIA: mockResponses.checkMediaAvailable,
    });

    const indicator = page.locator('#media-connector-indicator');
    await expect(indicator).toBeAttached();
    await expect(indicator).toContainText('Available on Server');
  });

  test('injects status indicator for a movie', async ({ page }) => {
    await setupContentScript(page, 'netflix-movie.html', {
      CHECK_MEDIA: mockResponses.checkMediaAvailable,
    });

    const indicator = page.locator('#media-connector-indicator');
    await expect(indicator).toBeAttached();
    await expect(indicator).toContainText('Available on Server');
  });

  test('shows Request indicator for unavailable media', async ({ page }) => {
    await setupContentScript(page, 'netflix-series.html', {
      CHECK_MEDIA: mockResponses.checkMediaUnavailable,
    });

    const indicator = page.locator('#media-connector-indicator');
    await expect(indicator).toBeAttached();
    await expect(indicator).toContainText('Request with Jellyseerr');
  });

  test('shows Configure indicator when unconfigured', async ({ page }) => {
    await setupContentScript(page, 'netflix-series.html', {
      CHECK_MEDIA: mockResponses.checkMediaUnconfigured,
    });

    const indicator = page.locator('#media-connector-indicator');
    await expect(indicator).toBeAttached();
    await expect(indicator).toContainText('Configure Extension');
  });

  test('indicator has close button', async ({ page }) => {
    await setupContentScript(page, 'netflix-movie.html', {
      CHECK_MEDIA: mockResponses.checkMediaAvailable,
    });

    const indicator = page.locator('#media-connector-indicator');
    await expect(indicator).toBeAttached();

    // Close button is the last child span with ×
    const closeBtn = indicator.locator('span:has-text("×")');
    await expect(closeBtn).toBeAttached();
  });
});
