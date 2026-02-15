import { test, expect } from '@playwright/test';
import { setupContentScript, mockResponses } from './e2e-helpers';

test.describe('JustWatch — content script injection', () => {
  test.describe('title detail pages', () => {
    test('injects card for a movie', async ({ page }) => {
      await setupContentScript(page, 'justwatch-movie.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
      });

      const card = page.locator('#media-connector-justwatch-card');
      await expect(card).toBeVisible();
      await expect(card).toContainText('Media Server Connector');
      await expect(card).toContainText('The Matrix');
      await expect(card).toContainText('✓ Available');
    });

    test('injects card for a TV show', async ({ page }) => {
      await setupContentScript(page, 'justwatch-series.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrSeries('Breaking Bad'),
      });

      const card = page.locator('#media-connector-justwatch-card');
      await expect(card).toBeVisible();
      await expect(card).toContainText('Breaking Bad');
    });

    test('card is placed before the buybox-container', async ({ page }) => {
      await setupContentScript(page, 'justwatch-movie.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
      });

      const card = page.locator('#media-connector-justwatch-card');
      const buybox = page.locator('.buybox-container');

      const cardBox = await card.boundingBox();
      const buyboxBox = await buybox.boundingBox();
      expect(cardBox!.y).toBeLessThan(buyboxBox!.y);
    });

    test('shows "No results" for empty response', async ({ page }) => {
      await setupContentScript(page, 'justwatch-movie.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrEmpty,
      });

      const card = page.locator('#media-connector-justwatch-card');
      await expect(card).toBeVisible();
      await expect(card).toContainText('No results');
    });
  });

  test.describe('search results page', () => {
    test('injects badges for search result rows', async ({ page }) => {
      await setupContentScript(page, 'justwatch-search.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
      });

      // Wait for search row processing (debounced + sequential)
      await page.waitForTimeout(2000);

      const badges = page.locator('.media-connector-jw-search-badge');
      const count = await badges.count();
      expect(count).toBeGreaterThan(0);
    });

    test('search badges contain server action text', async ({ page }) => {
      await setupContentScript(page, 'justwatch-search.html', {
        GET_CONFIG: mockResponses.configEmby,
        SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
      });

      await page.waitForTimeout(2000);

      // At least one badge should mention "Play on" or "Request"
      const firstBadge = page.locator('.media-connector-jw-search-badge').first();
      const text = await firstBadge.textContent();
      expect(text).toMatch(/Play on|Request/);
    });
  });
});
