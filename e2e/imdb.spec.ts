import { test, expect } from '@playwright/test';
import { setupContentScript, mockResponses } from './e2e-helpers';

test.describe('IMDb — content script injection', () => {
  test('injects card below hero section for a movie', async ({ page }) => {
    await setupContentScript(page, 'imdb-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Media Server Connector');
    await expect(card).toContainText('The Matrix');
    await expect(card).toContainText('✓ Available');
  });

  test('injects card for a TV series', async ({ page }) => {
    await setupContentScript(page, 'imdb-series.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrSeries('Breaking Bad'),
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Breaking Bad');
  });

  test('injects card for an episode', async ({ page }) => {
    await setupContentScript(page, 'imdb-episode.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrSeries('Breaking Bad'),
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toBeVisible();
  });

  test('card is placed after the hero section', async ({ page }) => {
    await setupContentScript(page, 'imdb-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    // The card should be a sibling after the hero wrapper
    const heroSection = page.locator('section.ipc-page-background--baseAlt');
    const card = page.locator('#media-connector-imdb-card');

    await expect(heroSection).toBeVisible();
    await expect(card).toBeVisible();

    // Verify card comes after hero in DOM order
    const heroTop = await heroSection.boundingBox();
    const cardTop = await card.boundingBox();
    expect(cardTop!.y).toBeGreaterThan(heroTop!.y);
  });

  test('shows "Not in library" badge for unavailable movie', async ({ page }) => {
    await setupContentScript(page, 'imdb-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix', 'not_requested'),
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Not in library');
    await expect(card).toContainText('Request');
  });

  test('shows "No results" when Jellyseerr returns empty', async ({ page }) => {
    await setupContentScript(page, 'imdb-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrEmpty,
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('No results');
  });

  test('shows Play on Emby button for available movie', async ({ page }) => {
    await setupContentScript(page, 'imdb-movie.html', {
      GET_CONFIG: mockResponses.configEmby,
      SEARCH_JELLYSEERR: mockResponses.searchJellyseerrMovie('The Matrix'),
    });

    const card = page.locator('#media-connector-imdb-card');
    await expect(card).toContainText('Play on Emby');
  });
});
