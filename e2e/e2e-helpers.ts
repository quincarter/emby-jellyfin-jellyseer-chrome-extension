/**
 * Shared test helper for E2E Playwright tests.
 *
 * Serves fixture HTML at spoofed site URLs so the content script's
 * `identifySite(window.location.href)` works correctly.
 * Injects Chrome API mocks and the built content script bundle.
 */
import { type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

/**
 * Read the built content-script bundle.
 * Must run `yarn build` before the E2E suite.
 */
const getContentScriptSource = (): string => {
  return readFileSync(resolve(ROOT, 'dist-e2e', 'content-script.js'), 'utf-8');
};

/** Map of fixture files to their fake site URLs. */
export const fixtureUrls: Record<string, string> = {
  'imdb-movie.html': 'https://www.imdb.com/title/tt0133093/',
  'imdb-series.html': 'https://www.imdb.com/title/tt0903747/',
  'imdb-episode.html': 'https://www.imdb.com/title/tt2301451/',
  'trakt-movie.html': 'https://trakt.tv/movies/the-matrix-1999',
  'trakt-series.html': 'https://trakt.tv/shows/breaking-bad',
  'google-movie.html': 'https://www.google.com/search?q=the+matrix+1999',
  'google-series.html': 'https://www.google.com/search?q=breaking+bad+tv+series',
  'bing-movie.html': 'https://www.bing.com/search?q=the+matrix',
  'bing-series.html': 'https://www.bing.com/search?q=breaking+bad+tv+series',
  'justwatch-movie.html': 'https://www.justwatch.com/us/movie/the-matrix',
  'justwatch-series.html': 'https://www.justwatch.com/us/tv-show/breaking-bad',
  'justwatch-search.html': 'https://www.justwatch.com/us/search?q=matrix',
  'netflix-movie.html': 'https://www.netflix.com/title/80100173',
  'netflix-series.html': 'https://www.netflix.com/title/80100172',
  'amazon-movie.html': 'https://www.amazon.com/gp/video/detail/B00BI1KNY6',
  'amazon-series.html': 'https://www.amazon.com/gp/video/detail/B07QJ2J5HP',
};

/** Standard mock responses used across tests. */
export const mockResponses = {
  configEmby: {
    type: 'GET_CONFIG_RESPONSE',
    payload: {
      serverType: 'emby',
      serverUrl: 'http://localhost:8096',
      localServerUrl: '',
      apiKey: 'test-api-key',
      jellyseerrEnabled: true,
      jellyseerrUrl: 'http://localhost:5055',
      jellyseerrLocalUrl: '',
      jellyseerrApiKey: 'test-jellyseerr-key',
    },
  },

  checkMediaAvailable: {
    type: 'CHECK_MEDIA_RESPONSE',
    payload: {
      status: 'available',
      serverType: 'emby',
      itemId: '12345',
      itemUrl: 'http://localhost:8096/web/index.html#!/item?id=12345',
    },
  },

  checkMediaUnavailable: {
    type: 'CHECK_MEDIA_RESPONSE',
    payload: {
      status: 'unavailable',
      serverType: 'emby',
    },
  },

  checkMediaUnconfigured: {
    type: 'CHECK_MEDIA_RESPONSE',
    payload: {
      status: 'unconfigured',
    },
  },

  searchJellyseerrMovie: (title: string, status: 'available' | 'not_requested' = 'available') => ({
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [
        {
          id: 603,
          title,
          year: 1999,
          mediaType: 'movie',
          overview: 'A computer hacker learns about the true nature of reality.',
          posterUrl: 'https://image.tmdb.org/t/p/w185/poster.jpg',
          status,
          serverUrl: 'http://localhost:8096',
          serverItemUrl:
            status === 'available'
              ? 'http://localhost:8096/web/index.html#!/item?id=12345'
              : undefined,
        },
      ],
      jellyseerrEnabled: true,
      serverType: 'emby',
      jellyseerrUrl: 'http://localhost:5055',
      serverUrl: 'http://localhost:8096',
    },
  }),

  searchJellyseerrSeries: (title: string, status: 'available' | 'not_requested' = 'available') => ({
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [
        {
          id: 1396,
          title,
          year: 2008,
          mediaType: 'tv',
          overview: 'A high school chemistry teacher turned methamphetamine manufacturer.',
          posterUrl: 'https://image.tmdb.org/t/p/w185/poster.jpg',
          status,
          serverUrl: 'http://localhost:8096',
          serverItemUrl:
            status === 'available'
              ? 'http://localhost:8096/web/index.html#!/item?id=67890'
              : undefined,
        },
      ],
      jellyseerrEnabled: true,
      serverType: 'emby',
      jellyseerrUrl: 'http://localhost:5055',
      serverUrl: 'http://localhost:8096',
    },
  }),

  searchJellyseerrEmpty: {
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [],
      jellyseerrEnabled: true,
      serverType: 'emby',
      jellyseerrUrl: 'http://localhost:5055',
    },
  },

  requestMediaSuccess: {
    type: 'REQUEST_MEDIA_RESPONSE',
    payload: { success: true, message: 'Request submitted.' },
  },
} as const;

/** Message handler map: maps `message.type` to a response value. */
export type MessageHandlerMap = Record<string, unknown>;

/**
 * Load a fixture at its spoofed URL, inject Chrome API mocks + content script.
 *
 * @param page        Playwright page
 * @param fixtureFile Fixture filename (from e2e/fixtures/)
 * @param handlers    Map of message type → mock response
 */
export const setupContentScript = async (
  page: Page,
  fixtureFile: string,
  handlers: MessageHandlerMap,
): Promise<void> => {
  const fixturePath = resolve(__dirname, 'fixtures', fixtureFile);
  const fixtureHtml = readFileSync(fixturePath, 'utf-8');
  const targetUrl = fixtureUrls[fixtureFile];

  if (!targetUrl) {
    throw new Error(`No URL mapping for fixture "${fixtureFile}". Add it to fixtureUrls.`);
  }

  // Intercept the target URL and serve our fixture HTML
  await page.route(targetUrl, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: fixtureHtml,
    });
  });

  // Block sub-resources to prevent real network requests
  await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,css,woff,woff2}', (route) => {
    route.fulfill({ status: 200, body: '' });
  });

  // Navigate to the target URL (served by our route handler)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  // Inject Chrome API mocks
  await page.addScriptTag({
    content: buildChromeMock(handlers),
  });

  // Inject the built content script as an ES module
  const contentScriptSource = getContentScriptSource();
  await page.evaluate((src) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = src;
    document.head.appendChild(script);
  }, contentScriptSource);

  // Give the content script time to detect + inject elements
  await page.waitForTimeout(600);
};

/**
 * Build a script string that installs the `chrome.*` mock on `window`.
 */
const buildChromeMock = (handlers: MessageHandlerMap): string => {
  const serializedHandlers = JSON.stringify(handlers);

  return `
    (function() {
      const handlers = ${serializedHandlers};

      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          id: 'mock-extension-id',
          lastError: null,
          sendMessage: function(message, callback) {
            const type = message && message.type;
            const response = handlers[type];
            if (callback && response !== undefined) {
              setTimeout(function() { callback(response); }, 10);
            } else if (callback) {
              setTimeout(function() { callback(undefined); }, 10);
            }
          },
          onMessage: {
            addListener: function() {},
            removeListener: function() {},
          },
        };
      }
      if (!window.chrome.storage) {
        window.chrome.storage = {
          local: {
            get: function(keys, callback) { callback({}); },
            set: function(items, callback) { if (callback) callback(); },
          },
          sync: {
            get: function(keys, callback) { callback({}); },
            set: function(items, callback) { if (callback) callback(); },
          },
        };
      }
    })();
  `;
};
