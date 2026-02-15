import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initTrakt,
  tryInjectTraktItem,
  tryInjectTraktLegacyButton,
  tryInjectTraktRow,
  injectTraktBadge,
} from './trakt.js';
import type { CheckMediaResponse } from '../../types/messages.js';

// Mock common-ui
vi.mock('../common-ui.js', async () => {
  const actual = await vi.importActual('../common-ui.js');
  return {
    ...actual,
    sendMessage: vi.fn(),
    handleRequestClick: vi.fn(),
  };
});

// Mock index
vi.mock('../index.js', () => ({
  tryDetectMedia: vi.fn(),
  buildPayload: vi.fn(),
}));

// Mock MutationObserver
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();
(global as unknown as { MutationObserver: unknown }).MutationObserver = vi.fn(function (
  _callback: (mutations: unknown[]) => void,
) {
  (this as unknown as { observe: typeof mockObserve }).observe = mockObserve;
  (this as unknown as { disconnect: typeof mockDisconnect }).disconnect = mockDisconnect;
});

import { sendMessage, handleRequestClick } from '../common-ui.js';
import { tryDetectMedia, buildPayload } from '../index.js';

describe('Trakt Injection', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="section-list-container">
        <div class="trakt-list-title">
          <span class="title">
            Where to Watch
          </span>
        </div>
        <div class="trakt-list-item-container"></div>
      </div>
      <div class="action-buttons">
        <a class="btn-checkin">Check In</a>
      </div>
      <div class="sidebar-info">
        <div class="info-row">Example Row</div>
      </div>
      <div class="grid-item">
        <div class="titles"><h4>The Matrix</h4></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initTrakt', () => {
    let mutationCallback: (mutations: unknown[]) => void;

    beforeEach(() => {
      (global as unknown as { MutationObserver: unknown }).MutationObserver = vi.fn(function (
        callback: (mutations: unknown[]) => void,
      ) {
        mutationCallback = callback;
        (this as unknown as { observe: typeof mockObserve }).observe = vi.fn();
        (this as unknown as { disconnect: typeof mockDisconnect }).disconnect = vi.fn();
      });
    });

    it('initializes and detects media', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
      });
      vi.mocked(buildPayload).mockReturnValue({ title: 'The Matrix' } as unknown as ReturnType<
        typeof buildPayload
      >);
      vi.mocked(sendMessage).mockResolvedValue({
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      });

      initTrakt();

      await vi.waitFor(() => {
        expect(document.getElementById('media-connector-wtw-item')).to.exist;
      });
    });

    it('re-injects elements on mutation if missing', async () => {
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Test' });
      vi.mocked(sendMessage).mockResolvedValue({
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      });

      initTrakt();
      await vi.waitFor(() => expect(document.getElementById('media-connector-wtw-item')).to.exist);

      // Remove element
      document.getElementById('media-connector-wtw-item')?.remove();

      // Trigger mutation
      mutationCallback();

      expect(document.getElementById('media-connector-wtw-item')).to.exist;
    });

    it('re-detects media if URL changes', async () => {
      const originalHref = window.location.href;
      vi.stubGlobal('location', { href: 'http://trakt.tv/movies/matrix' });

      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Matrix' });
      vi.mocked(sendMessage).mockResolvedValue({
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'url' },
      });

      initTrakt();
      await vi.waitFor(() => expect(document.getElementById('media-connector-wtw-item')).to.exist);

      // Change URL
      vi.stubGlobal('location', { href: 'http://trakt.tv/movies/inception' });
      vi.mocked(tryDetectMedia).mockReturnValue({ type: 'movie', title: 'Inception' });

      mutationCallback();

      expect(tryDetectMedia).toHaveBeenCalledTimes(2);
      vi.stubGlobal('location', { href: originalHref });
    });
  });

  describe('tryInjectTraktRow', () => {
    it('injects row into sidebar', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available', serverType: 'emby', itemUrl: 'https://emby.test/item/1' },
      };

      tryInjectTraktRow(response);

      const row = document.getElementById('media-connector-trakt-row');
      expect(row).to.exist;
      expect(row?.textContent).to.contain('Emby');
    });

    it('injects request row when unavailable', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'unavailable', serverType: 'jellyfin' },
      };

      tryInjectTraktRow(response);

      const row = document.getElementById('media-connector-trakt-row');
      expect(row?.textContent).to.contain('Request with Jellyseerr');

      const link = row?.querySelector('.media-connector-request');
      (link as HTMLElement)?.click();
      expect(handleRequestClick).toHaveBeenCalled();
    });
  });

  describe('injectTraktBadge', () => {
    it('injects badge into grid item', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: { status: 'available' },
      };
      const gridItem = document.querySelector('.grid-item') as HTMLElement;

      injectTraktBadge(gridItem, response);

      const badge = gridItem.querySelector('.media-connector-badge');
      expect(badge).to.exist;
    });
  });

  describe('tryInjectTraktItem', () => {
    it('injects Emby item when available', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'available',
          serverType: 'emby',
          itemUrl: 'https://emby.test/item/123',
        },
      };

      tryInjectTraktItem(response);

      const item = document.getElementById('media-connector-wtw-item');
      expect(item).to.exist;
      expect(item?.innerHTML).to.contain('Emby');
      expect(item?.querySelector('a')?.href).to.equal('https://emby.test/item/123');
    });

    it('injects Jellyfin item with Partial label when partial', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'partial',
          serverType: 'jellyfin',
          itemUrl: 'https://jf.test/item/456',
        },
      };

      tryInjectTraktItem(response);

      const item = document.getElementById('media-connector-wtw-item');
      expect(item?.innerHTML).to.contain('Jellyfin (Partial)');
    });

    it('injects Request item when unavailable', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'unavailable',
          serverType: 'emby',
        },
      };

      tryInjectTraktItem(response);

      const item = document.getElementById('media-connector-wtw-item');
      expect(item?.innerHTML).to.contain('Request');

      item?.click();
      expect(handleRequestClick).toHaveBeenCalled();
    });

    it('injects Unconfigured item when unconfigured', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'unconfigured',
          serverType: 'emby',
        },
      };

      tryInjectTraktItem(response);

      const item = document.getElementById('media-connector-wtw-item');
      expect(item?.textContent).to.contain('Set up Emby');
    });
  });

  describe('tryInjectTraktLegacyButton', () => {
    it('inserts Play button before Check In button', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'available',
          serverType: 'emby',
          itemUrl: 'https://emby.test/item/123',
        },
      };

      tryInjectTraktLegacyButton(response);

      const btn = document.getElementById('media-connector-trakt-action-btn');
      expect(btn).to.exist;
      expect(btn?.textContent).to.contain('Play on Emby');

      const checkinBtn = document.querySelector('.btn-checkin');
      expect(btn?.nextElementSibling).to.equal(checkinBtn);
    });

    it('inserts Request button when unavailable', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'unavailable',
          serverType: 'jellyfin',
        },
      };

      tryInjectTraktLegacyButton(response);

      const btn = document.getElementById('media-connector-trakt-action-btn');
      expect(btn?.textContent).to.contain('Request on Jellyfin');

      vi.mocked(handleRequestClick).mockResolvedValue(undefined);
      btn?.click();
      expect(handleRequestClick).toHaveBeenCalled();
      expect(btn?.textContent).to.contain('Requesting…');
    });

    it('inserts Unconfigured button when unconfigured', () => {
      const response: CheckMediaResponse = {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'unconfigured',
          serverType: 'emby',
        },
      };

      tryInjectTraktLegacyButton(response);

      const btn = document.getElementById('media-connector-trakt-action-btn');
      expect(btn?.textContent).to.contain('Set up Emby');
    });
  });
});
