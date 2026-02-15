import { test, expect } from '@playwright/test';
import { setupContentScript, mockResponses } from './e2e-helpers';

test.describe('Bing Search — sidebar injection', () => {
  test('injects sidebar card for a movie search', async ({ page }) => {
    await setupContentScript(page, 'bing-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Media Server Connector');
    await expect(sidebar).toContainText('The Matrix');
  });

  test('injects sidebar card for a TV series search', async ({ page }) => {
    await setupContentScript(page, 'bing-series.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrSeries('Breaking Bad'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('Breaking Bad');
  });

  test('sidebar is placed before #b_results', async ({ page }) => {
    await setupContentScript(page, 'bing-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const sidebar = page.locator('#media-connector-sidebar');
    const bResults = page.locator('#b_results');

    const sidebarBox = await sidebar.boundingBox();
    const bResultsBox = await bResults.boundingBox();
    expect(sidebarBox!.y).toBeLessThan(bResultsBox!.y);
  });

  test('shows "No results" for empty Jellyseerr response', async ({ page }) => {
    await setupContentScript(page, 'bing-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrEmpty,
    });

    const sidebar = page.locator('#media-connector-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('No results');
  });
});
