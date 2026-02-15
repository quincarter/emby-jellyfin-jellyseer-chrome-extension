import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initSearchEngineSidebar, tryInjectSearchEngineCard } from './search-engine.js';
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

// Mock the index module
vi.mock('../index.js', () => ({
  tryDetectMedia: vi.fn(),
  identifySite: vi.fn(),
}));

import { sendMessage } from '../common-ui.js';
import { tryDetectMedia, identifySite } from '../index.js';

describe('Search Engine Injection', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="rhs"></div>
      <div id="b_context"></div>
      <div id="rso"></div>
      <div id="b_results"></div>
    `;
    vi.mocked(identifySite).mockReturnValue('google');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initSearchEngineSidebar', () => {
    it('returns early if no media is detected', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue(undefined);
      await initSearchEngineSidebar();
      expect(document.getElementById('media-connector-skeleton')).toBeNull();
    });

    it('detects media and injects sidebar for Google', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
      });
      vi.mocked(identifySite).mockReturnValue('google');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 603, title: 'The Matrix', status: 'available', mediaType: 'movie' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });

      await initSearchEngineSidebar();

      const card = document.getElementById('media-connector-sidebar');
      expect(card).to.exist;
      expect(document.getElementById('rso')?.previousElementSibling).to.equal(card);
    });

    it('injects into center_col if rso is missing in Google', async () => {
      document.getElementById('rso')?.remove();
      const centerCol = document.createElement('div');
      centerCol.id = 'center_col';
      document.body.appendChild(centerCol);

      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(identifySite).mockReturnValue('google');
      vi.mocked(sendMessage).mockResolvedValue({
        payload: {
          results: [{ title: 'Test', status: 'available', mediaType: 'movie' }],
          jellyseerrEnabled: true,
        },
      });

      await initSearchEngineSidebar();
      expect(centerCol.firstChild?.id).toBe('media-connector-sidebar');
    });

    it('injects into search if center_col is missing in Google', async () => {
      document.getElementById('rso')?.remove();
      const search = document.createElement('div');
      search.id = 'search';
      document.body.appendChild(search);

      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(identifySite).mockReturnValue('google');
      vi.mocked(sendMessage).mockResolvedValue({
        payload: {
          results: [{ title: 'Test', status: 'available', mediaType: 'movie' }],
          jellyseerrEnabled: true,
        },
      });

      await initSearchEngineSidebar();
      expect(search.firstChild?.id).toBe('media-connector-sidebar');
    });

    it('detects media and injects sidebar for Bing', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
      });
      vi.mocked(identifySite).mockReturnValue('bing');
      vi.mocked(sendMessage).mockImplementation(async (msg: unknown) => {
        const m = msg as { type: string };
        if (m.type === 'GET_CONFIG') return { payload: { serverType: 'emby' } };
        if (m.type === 'SEARCH_JELLYSEERR') {
          return {
            payload: {
              results: [{ id: 603, title: 'The Matrix', status: 'available', mediaType: 'movie' }],
              jellyseerrEnabled: true,
              serverType: 'emby',
            },
          };
        }
        return undefined;
      });

      await initSearchEngineSidebar();

      const card = document.getElementById('media-connector-sidebar');
      expect(card).to.exist;
      expect(document.getElementById('b_results')?.previousElementSibling).to.equal(card);
    });

    it('injects into b_content if b_results is missing in Bing', async () => {
      document.getElementById('b_results')?.remove();
      const bContent = document.createElement('div');
      bContent.id = 'b_content';
      document.body.appendChild(bContent);

      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(identifySite).mockReturnValue('bing');
      vi.mocked(sendMessage).mockResolvedValue({
        payload: {
          results: [{ title: 'Test', status: 'available', mediaType: 'movie' }],
          jellyseerrEnabled: true,
        },
      });

      await initSearchEngineSidebar();
      expect(bContent.firstChild?.id).toBe('media-connector-sidebar');
    });

    it('uses different selectors for Google center_col and search branches', async () => {
      // Test center_col branch
      document.body.innerHTML = '<div id="center_col"></div>';
      vi.mocked(identifySite).mockReturnValue('google');
      await initSearchEngineSidebar();
      expect(document.getElementById('center_col')?.firstChild).to.exist;

      // Test search branch
      document.body.innerHTML = '<div id="search"></div>';
      vi.mocked(identifySite).mockReturnValue('google');
      await initSearchEngineSidebar();
      expect(document.getElementById('search')?.firstChild).to.exist;
    });

    it('falls back to fixed positioning if no site matches', async () => {
      vi.mocked(identifySite).mockReturnValue('unknown');
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockResolvedValue({
        payload: {
          results: [{ title: 'Test', status: 'available', mediaType: 'movie' }],
          jellyseerrEnabled: true,
        },
      });

      await initSearchEngineSidebar();
      const card = document.getElementById('media-connector-sidebar');
      expect(card?.style.position).toBe('fixed');
    });
  });

  describe('tryInjectSearchEngineCard', () => {
    it('injects card into Google sidebar (rhs)', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };

      tryInjectSearchEngineCard(response);

      const card = document.getElementById('media-connector-search-card');
      expect(card).to.exist;
      expect(document.getElementById('rhs')?.contains(card!)).to.be.true;
    });

    it('injects card into Bing sidebar (b_context)', () => {
      document.getElementById('rhs')?.remove();
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'jellyfin', itemUrl: 'url' },
      };

      tryInjectSearchEngineCard(response);

      const card = document.getElementById('media-connector-search-card');
      expect(card).to.exist;
      expect(document.getElementById('b_context')?.contains(card!)).to.be.true;
    });

    it('falls back to fixed positioning if no sidebars found', () => {
      document.getElementById('rhs')?.remove();
      document.getElementById('b_context')?.remove();
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      };

      tryInjectSearchEngineCard(response);
      const card = document.getElementById('media-connector-search-card');
      expect(card?.style.position).toBe('fixed');
    });
  });
});
