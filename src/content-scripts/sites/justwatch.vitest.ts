import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initJustWatchSPA, tryInjectJustWatchCard, injectJustWatchBadge } from './justwatch.js';
import type { CheckMediaResponse } from '../../types/messages.js';

// Mock the common-ui module
vi.mock('../common-ui.js', async () => {
  const actual = await vi.importActual('../common-ui.js');
  return {
    ...actual,
    sendMessage: vi.fn(),
    injectSkeletonKeyframes: vi.fn(),
    requestFromSidebar: vi.fn(),
  };
});

// Mock the index module
vi.mock('../index.js', () => ({
  tryDetectMedia: vi.fn(),
}));

// Mock content-script-helpers
vi.mock('../content-script-helpers.js', async () => {
  const actual = await vi.importActual('../content-script-helpers.js');
  return {
    ...actual,
    getJustWatchPageType: vi.fn(),
  };
});

// Mock MutationObserver
let mutationCallback: () => void;
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();
(global as unknown as { MutationObserver: unknown }).MutationObserver = vi.fn(function (
  callback: () => void,
) {
  mutationCallback = callback;
  (this as unknown as { observe: typeof mockObserve }).observe = mockObserve;
  (this as unknown as { disconnect: typeof mockDisconnect }).disconnect = mockDisconnect;
});

import { sendMessage, requestFromSidebar } from '../common-ui.js';
import { tryDetectMedia } from '../index.js';
import { getJustWatchPageType } from '../content-script-helpers.js';

describe('JustWatch Injection', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="__layout">
        <div class="title-block">
          <div class="buybox-container"></div>
        </div>
        <div class="search-results">
          <div class="title-list-row__row">
            <a class="title-list-row__column-header" href="/us/movie/the-matrix">The Matrix (1999)</a>
          </div>
        </div>
      </div>
    `;
    vi.mocked(getJustWatchPageType).mockReturnValue('other');
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('initJustWatchSPA', () => {
    it('initializes and responds to URL changes (detail)', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
      });
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 603, title: 'The Matrix', status: 'available' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });

      initJustWatchSPA();

      // Give it a moment to run detectDetail
      await vi.runAllTimersAsync();
      await vi.waitFor(() => {
        expect(document.getElementById('media-connector-justwatch-card')).to.exist;
      });
    });

    it('responds to mutations by scheduling handleMutation', async () => {
      initJustWatchSPA();
      expect(mutationCallback).toBeDefined();

      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      vi.mocked(sendMessage).mockResolvedValue({
        payload: { serverType: 'emby', results: [], jellyseerrEnabled: true },
      });

      mutationCallback();
      await vi.advanceTimersByTimeAsync(300);

      expect(getJustWatchPageType).toHaveBeenCalled();
    });

    it('handles URL changes and cleanup', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'The Matrix' });
      vi.mocked(sendMessage).mockResolvedValue({
        payload: { results: [], jellyseerrEnabled: true, serverType: 'emby' },
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();
      expect(document.getElementById('media-connector-justwatch-card')).to.exist;

      // Simulate URL change
      const originalHref = window.location.href;
      vi.stubGlobal('location', { href: 'https://www.justwatch.com/us/search?q=test' });
      vi.mocked(getJustWatchPageType).mockReturnValue('search');

      mutationCallback();
      await vi.runAllTimersAsync();

      expect(document.getElementById('media-connector-justwatch-card')).toBeNull();
      vi.stubGlobal('location', { href: originalHref });
    });

    it('re-detects if card is missing from detail page', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockResolvedValue({
        payload: { results: [], jellyseerrEnabled: true, serverType: 'emby' },
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      // Manually remove card
      document.getElementById('media-connector-justwatch-card')?.remove();

      // Trigger mutation
      mutationCallback();
      await vi.runAllTimersAsync();

      // Should have re-injected
      expect(document.getElementById('media-connector-justwatch-card')).to.exist;
    });

    it('skips rows that are already processing', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      const row = document.querySelector('.title-list-row__row') as HTMLElement;
      row.dataset.mcProcessing = 'true';

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      expect(row.querySelector('.media-connector-jw-search-badge')).toBeNull();
    });

    it('processes search rows with different statuses', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'jellyfin' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [
                { id: 1, title: 'The Matrix', status: 'partial', serverItemUrl: 'url' },
                { id: 2, title: 'Other', status: 'pending' },
                { id: 3, title: 'None', status: 'not_requested' },
              ],
              jellyseerrEnabled: true,
              serverType: 'jellyfin',
              jellyseerrUrl: 'https://jsr.test',
            },
          };
        }
        return undefined;
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      const badges = document.querySelectorAll('.media-connector-jw-search-badge');
      expect(badges.length).to.be.greaterThan(0);
      expect(badges[0].textContent).to.contain('Play on Jellyfin (partial)');
    });

    it('handles request click in search row', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 3, title: 'None', status: 'not_requested' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });
      vi.mocked(requestFromSidebar).mockResolvedValue(true);

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      const btn = document.querySelector('.media-connector-jw-search-badge') as HTMLElement;
      expect(btn.textContent).to.contain('Request on Emby');

      await btn.click();
      expect(requestFromSidebar).toHaveBeenCalled();
      expect(btn.textContent).to.contain('Requested on Emby');
    });

    it('handles request failure in search row', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 3, title: 'None', status: 'not_requested' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });
      vi.mocked(requestFromSidebar).mockResolvedValue(false);

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      const btn = document.querySelector('.media-connector-jw-search-badge') as HTMLElement;
      await btn.click();
      expect(btn.textContent).to.contain('Failed');
    });

    it('handles pending status in search row', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('search');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 4, title: 'Pending', status: 'pending' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
              jellyseerrUrl: 'https://jsr.test',
            },
          };
        }
        return undefined;
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();

      const btn = document.querySelector('.media-connector-jw-search-badge') as HTMLElement;
      expect(btn.textContent).to.contain('Request Pending');
      btn.click();
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'OPEN_TAB' }));
    });

    it('handles detectDetail early exit if already detecting', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      initJustWatchSPA();
      mutationCallback();
      await vi.runAllTimersAsync();
      expect(tryDetectMedia).toHaveBeenCalled();
    });
  });

  describe('appendCardToJustWatchPage', () => {
    it('appends after hero details if buybox missing', () => {
      document.body.innerHTML = '<div class="title-detail-hero__details"></div>';
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };
      tryInjectJustWatchCard(response);
      const card = document.getElementById('media-connector-justwatch-card');
      expect(document.querySelector('.title-detail-hero__details')?.nextElementSibling).to.equal(
        card,
      );
    });

    it('prepends to main as final fallback', () => {
      document.body.innerHTML = '<main></main>';
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };
      tryInjectJustWatchCard(response);
      const card = document.getElementById('media-connector-justwatch-card');
      expect(document.querySelector('main')?.firstChild).to.equal(card);
    });
  });

  describe('injectJustWatchCard', () => {
    it('handles unconfigured Jellyseerr', async () => {
      const response = {
        payload: { results: [], jellyseerrEnabled: false, serverType: 'emby' },
      };
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') return response;
        return undefined;
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();
      expect(document.body.textContent).to.contain('Jellyseerr not configured');
    });

    it('handles error in Jellyseerr response', async () => {
      vi.mocked(getJustWatchPageType).mockReturnValue('detail');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR')
          return {
            payload: { results: [], jellyseerrEnabled: true, serverType: 'emby', error: 'Boom' },
          };
        return undefined;
      });

      initJustWatchSPA();
      await vi.runAllTimersAsync();
      expect(document.body.textContent).to.contain('Connection error');
    });
  });

  describe('tryInjectJustWatchCard', () => {
    it('injects card before buybox', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };

      tryInjectJustWatchCard(response);

      const card = document.getElementById('media-connector-justwatch-card');
      expect(card).to.exist;
      expect(card?.textContent).to.contain('Available on Emby');
    });

    it('injects unavailable card', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'unavailable', serverType: 'jellyfin' },
      };

      tryInjectJustWatchCard(response);

      const card = document.getElementById('media-connector-justwatch-card');
      expect(card?.textContent).to.contain('Not on Jellyfin yet');
    });
  });

  describe('injectJustWatchBadge', () => {
    it('injects badge into poster container', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available' },
      };
      const row = document.createElement('div');
      row.innerHTML = '<div class="poster-container"></div>';

      injectJustWatchBadge(row, response);

      const badge = row.querySelector('.media-connector-badge');
      expect(badge).to.exist;
    });

    it('injects badge directly into element if poster container missing', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'unavailable' },
      };
      const element = document.createElement('div');
      injectJustWatchBadge(element, response);
      expect(element.querySelector('.media-connector-badge')).to.exist;
    });
  });
});
