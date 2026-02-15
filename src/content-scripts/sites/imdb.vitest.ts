import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initImdb, tryInjectImdbCard, injectImdbBadge } from './imdb.js';
import type { CheckMediaResponse } from '../../types/messages.js';

// Mock the common-ui module
vi.mock('../common-ui.js', async () => {
  const actual = await vi.importActual('../common-ui.js');
  return {
    ...actual,
    sendMessage: vi.fn(),
    injectSkeletonKeyframes: vi.fn(),
  };
});

// Mock the index module for tryDetectMedia
vi.mock('../index.js', () => ({
  tryDetectMedia: vi.fn(),
}));

import { sendMessage } from '../common-ui.js';
import { tryDetectMedia } from '../index.js';

describe('IMDb Injection', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="ipc-page-background--baseAlt">
        <div data-testid="hero-parent">
           <div class="sc-69e30616-0">Hero Section</div>
        </div>
      </section>
      <div class="ipc-poster">
        <div class="ipc-media">Poster</div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initImdb', () => {
    it('returns early if no media is detected', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue(undefined);
      await initImdb();
      expect(document.getElementById('media-connector-imdb-skeleton')).toBeNull();
    });

    it('detects media, shows skeleton, fetches config/results, and injects card', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
        imdbId: 'tt0133093',
      });

      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') {
          return { payload: { serverType: 'emby' } };
        }
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [
                {
                  id: 603,
                  title: 'The Matrix',
                  year: 1999,
                  mediaType: 'movie',
                  status: 'available',
                },
              ],
              jellyseerrEnabled: true,
              serverType: 'emby',
              jellyseerrUrl: 'https://jellyseerr.test',
            },
          };
        }
        return undefined;
      });

      await initImdb();

      const card = document.getElementById('media-connector-imdb-card');
      expect(card).to.exist;
      expect(card?.textContent).to.contain('The Matrix');
      expect(document.getElementById('media-connector-imdb-skeleton')).toBeNull();
    });

    it('handles Jellyseerr disabled state', async () => {
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
              results: [],
              jellyseerrEnabled: false,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });

      await initImdb();

      const card = document.getElementById('media-connector-imdb-card');
      expect(card?.textContent).to.contain('Jellyseerr not configured');
    });

    it('handles Jellyseerr error state', async () => {
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
              results: [],
              jellyseerrEnabled: true,
              serverType: 'emby',
              error: 'API error',
            },
          };
        }
        return undefined;
      });

      await initImdb();

      const card = document.getElementById('media-connector-imdb-card');
      expect(card?.textContent).to.contain('Connection error');
    });

    it('handles no results from Jellyseerr', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'Unknown Movie',
        year: 2025,
      });

      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });

      await initImdb();

      const card = document.getElementById('media-connector-imdb-card');
      expect(card?.textContent).to.contain('No results');
    });

    it('injects into heroContainer if hero-parent is missing', async () => {
      document.querySelector('[data-testid="hero-parent"]')?.parentElement?.remove();
      const heroTitle = document.createElement('div');
      heroTitle.setAttribute('data-testid', 'hero__pageTitle');
      const container = document.createElement('section');
      container.className = 'ipc-page-background--baseAlt';
      container.appendChild(heroTitle);
      document.body.appendChild(container);

      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockResolvedValue({
        payload: { results: [{ title: 'Test', status: 'available' }], jellyseerrEnabled: true },
      });

      await initImdb();
      expect(container.nextElementSibling?.id).toBe('media-connector-imdb-card');
    });

    it('prepends to main if hero section is completely missing', async () => {
      document.body.innerHTML = '<main role="main"><div id="content"></div></main>';
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockResolvedValue({
        payload: { results: [{ title: 'Test', status: 'available' }], jellyseerrEnabled: true },
      });

      await initImdb();
      const main = document.querySelector('main');
      expect(main?.firstChild?.id).toBe('media-connector-imdb-card');
    });
  });

  describe('tryInjectImdbCard', () => {
    it('injects card into hero section', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };

      tryInjectImdbCard(response);

      const card = document.getElementById('media-connector-imdb-card');
      expect(card).to.exist;
      expect(card?.textContent).to.contain('Available on Emby');
    });

    it('injects unavailable card', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'unavailable', serverType: 'jellyfin' },
      };

      tryInjectImdbCard(response);

      const card = document.getElementById('media-connector-imdb-card');
      expect(card?.textContent).to.contain('Not on Jellyfin yet');
    });
  });

  describe('injectImdbBadge', () => {
    it('injects badge into poster media', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available' },
      };
      const poster = document.querySelector('.ipc-poster') as HTMLElement;

      injectImdbBadge(poster, response);

      const badge = poster.querySelector('.media-connector-badge');
      expect(badge).to.exist;
    });
  });
});
