/**
 * Shared test helper for E2E Playwright tests.
 *
 * Provides utilities to:
 *  - Set up Chrome extension API mocks (`chrome.runtime`, `chrome.storage`)
 *  - Load fixture HTML into a Playwright page with a spoofed origin
 *  - Inject the content script source into the page
 *
 * The content script is loaded as raw source (not the built bundle) so that
 * we can run tests without a build step. We inline the full module code
 * via `page.addScriptTag({ content })`.
 */
import { type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

/**
 * Read the built content-script bundle.
 * Must run `yarn build` before the E2E suite.
 */
const getContentScriptSource = (): string => {
  return readFileSync(resolve(ROOT, 'dist', 'content-script.js'), 'utf-8');
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

  configJellyfin: {
    type: 'GET_CONFIG_RESPONSE',
    payload: {
      serverType: 'jellyfin',
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

/**
 * Message handler map: maps `message.type` to a response value or function.
 */
export type MessageHandlerMap = Record<string, unknown | ((...args: unknown[]) => unknown)>;

/**
 * Inject Chrome API mocks + the content script into the given Playwright page.
 *
 * @param page        Playwright page
 * @param fixtureFile Relative path to the HTML fixture (from e2e/fixtures/)
 * @param handlers    Map of message type → mock response (or function returning one)
 */
export const setupContentScript = async (
  page: Page,
  fixtureFile: string,
  handlers: MessageHandlerMap,
): Promise<void> => {
  const fixturePath = resolve(__dirname, 'fixtures', fixtureFile);
  const fixtureHtml = readFileSync(fixturePath, 'utf-8');

  // Navigate to about:blank first, then set content
  await page.goto('about:blank');

  // Install Chrome API mocks before the content script runs
  await page.addScriptTag({
    content: buildChromeMock(handlers),
  });

  // Set the page content (fixture HTML)
  await page.setContent(fixtureHtml, { waitUntil: 'domcontentloaded' });

  // Re-install mocks after setContent (it replaces the page)
  await page.addScriptTag({
    content: buildChromeMock(handlers),
  });

  // Inject the built content script
  const contentScriptSource = getContentScriptSource();
  await page.addScriptTag({ content: contentScriptSource });

  // Give the content script time to detect + inject
  await page.waitForTimeout(500);
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
              // Simulate async
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
