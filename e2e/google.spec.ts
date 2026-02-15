import { test, expect } from '@playwright/test';
import { setupContentScript, mockResponses } from './e2e-helpers';

test.describe('Google Search — sidebar injection', () => {
  test('injects sidebar card for a movie search', async ({ page }) => {
    await setupContentScript(page, 'google-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Media Server Connector');
    await expect(sidebar).toContainText('The Matrix');
    await expect(sidebar).toContainText('✓ Available');
  });

  test('injects sidebar card for a TV series search', async ({ page }) => {
    await setupContentScript(page, 'google-series.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrSeries('Breaking Bad'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Breaking Bad');
  });

  test('sidebar is placed above the search results (#rso)', async ({ page }) => {
    await setupContentScript(page, 'google-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    const rso = page.locator('#rso');

    const sidebarBox = await sidebar.boundingBox();
    const rsoBox = await rso.boundingBox();
    expect(sidebarBox!.y).toBeLessThan(rsoBox!.y);
  });

  test('shows "No results" for empty Jellyseerr response', async ({ page }) => {
    await setupContentScript(page, 'google-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrEmpty,
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('No results');
  });

  test('shows Request button for unavailable movie', async ({ page }) => {
    await setupContentScript(page, 'google-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix', 'not_requested'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toContainText('Request');
    await expect(sidebar).toContainText('Not in library');
  });
});
