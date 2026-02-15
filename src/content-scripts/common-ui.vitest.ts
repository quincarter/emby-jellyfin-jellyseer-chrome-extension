import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Option } from 'effect';
import * as detectMediaModule from './detect-media.js';
import {
  buildStatusBadge,
  createActionButton,
  createInfoRow,
  injectSkeletonKeyframes,
  buildResultRow,
  tryDetectMedia,
  buildPayload,
  sendMessage,
  handleRequestClick,
  requestFromSidebar,
} from './common-ui.js';
import type { JellyseerrResultItem } from '../types/messages.js';

describe('common-ui', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    // Mock chrome.runtime.sendMessage
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'mock-id',
        sendMessage: vi.fn((_msg: unknown, cb: (response: unknown) => void) =>
          cb({ payload: { success: true } }),
        ),
        lastError: null,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('tryDetectMedia', () => {
    it('returns media when detected', () => {
      const mockMedia = { type: 'movie' as const, title: 'Test' };
      vi.spyOn(detectMediaModule, 'detectMediaOption').mockReturnValue(Option.some(mockMedia));

      const result = tryDetectMedia();
      expect(result).to.deep.equal(mockMedia);
    });

    it('returns undefined when not detected', () => {
      vi.spyOn(detectMediaModule, 'detectMediaOption').mockReturnValue(Option.none());

      const result = tryDetectMedia();
      expect(result).to.be.undefined;
    });
  });

  describe('buildPayload', () => {
    it('builds a payload from media', () => {
      const mockMedia = { type: 'movie' as const, title: 'Test', year: 2020 };
      const payload = buildPayload(mockMedia);
      expect(payload.title).to.equal('Test');
      expect(payload.year).to.equal(2020);
      expect(payload.mediaType).to.equal('movie');
    });
  });

  describe('sendMessage', () => {
    it('sends message and returns response', async () => {
      const response = await sendMessage({ type: 'TEST' });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'TEST' },
        expect.any(Function),
      );
      expect(response).to.deep.equal({ payload: { success: true } });
    });

    it('returns undefined when chrome is undefined', async () => {
      vi.stubGlobal('chrome', undefined);
      const response = await sendMessage({ type: 'TEST' });
      expect(response).to.be.undefined;
    });

    it('returns undefined on lastError', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: unknown, cb: (response: unknown) => void) => {
          (chrome.runtime as unknown as { lastError: { message: string } }).lastError = {
            message: 'error',
          };
          cb(undefined);
        },
      );
      const response = await sendMessage({ type: 'TEST' });
      expect(response).to.be.undefined;
    });
  });

  describe('handleRequestClick', () => {
    it('detects media and sends request message', async () => {
      const mockMedia = { type: 'movie' as const, title: 'The Matrix', year: 1999 };
      vi.spyOn(detectMediaModule, 'detectMediaOption').mockReturnValue(Option.some(mockMedia));
      window.alert = vi.fn();

      await handleRequestClick();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUEST_MEDIA' }),
        expect.any(Function),
      );
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Successfully requested'));
    });

    it('alerts on failure', async () => {
      const mockMedia = { type: 'movie' as const, title: 'The Matrix', year: 1999 };
      vi.spyOn(detectMediaModule, 'detectMediaOption').mockReturnValue(Option.some(mockMedia));
      window.alert = vi.fn();
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: unknown, cb: (response: unknown) => void) =>
          cb({ payload: { success: false, message: 'fail' } }),
      );

      await handleRequestClick();

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to request'));
    });
  });

  describe('requestFromSidebar', () => {
    it('sends request and returns success status', async () => {
      const result = await requestFromSidebar({
        id: 123,
        title: 'Test',
        mediaType: 'movie',
      } as unknown as JellyseerrResultItem);
      expect(result).to.be.true;
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUEST_MEDIA' }),
        expect.any(Function),
      );
    });
  });

  describe('buildStatusBadge', () => {
    it('returns a green badge for available status', () => {
      const html = buildStatusBadge('available');
      expect(html).to.contain('✓ Available');
      expect(html).to.contain('rgba(76,175,80,0.15)');
    });

    it('returns an orange badge for partial status', () => {
      const html = buildStatusBadge('partial');
      expect(html).to.contain('◐ Partial');
      expect(html).to.contain('rgba(255,152,0,0.15)');
    });

    it('returns a purple badge for not_requested status', () => {
      const html = buildStatusBadge('not_requested');
      expect(html).to.contain('Not in library');
      expect(html).to.contain('rgba(123,47,190,0.15)');
    });

    it('returns a grey badge for pending status', () => {
      const html = buildStatusBadge('pending');
      expect(html).to.contain('⏳ Pending');
    });
  });

  describe('createActionButton', () => {
    it('creates a button with correct text and background', () => {
      const btn = createActionButton('Test Button', '#ff0000', '#cc0000');
      expect(btn.tagName).to.equal('BUTTON');
      expect(btn.textContent).to.equal('Test Button');
      // Use case-insensitive hex or rgb check depending on browser implementation
      expect(btn.style.background.toLowerCase()).to.be.oneOf(['rgb(255, 0, 0)', '#ff0000']);
    });

    it('updates background on hover', () => {
      const btn = createActionButton('Hover', '#ff0000', '#cc0000');
      btn.dispatchEvent(new MouseEvent('mouseenter'));
      expect(btn.style.background.toLowerCase()).to.be.oneOf(['rgb(204, 0, 0)', '#cc0000']);
      btn.dispatchEvent(new MouseEvent('mouseleave'));
      expect(btn.style.background.toLowerCase()).to.be.oneOf(['rgb(255, 0, 0)', '#ff0000']);
    });
  });

  describe('createInfoRow', () => {
    it('creates a row with emoji, title and description', () => {
      const row = createInfoRow('🚀', 'Title', 'Description');
      expect(row.textContent).to.contain('🚀 Title');
      expect(row.textContent).to.contain('Description');
    });
  });

  describe('buildResultRow', () => {
    const mockItem = {
      id: 123,
      title: 'The Matrix',
      year: 1999,
      mediaType: 'movie' as const,
      overview: 'Cool movie',
      status: 'available' as const,
      serverItemUrl: 'https://emby.test/item/123',
    };

    it('renders an available item with a Play button', () => {
      const row = buildResultRow(mockItem, 'Emby', 'https://jsr.test');
      expect(row.textContent).to.contain('The Matrix (1999)');
      expect(row.textContent).to.contain('▶ Play on Emby');

      const playBtn = Array.from(row.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Play'),
      );
      vi.spyOn(window, 'open').mockImplementation(() => null);
      playBtn?.click();
      expect(window.open).toHaveBeenCalledWith(mockItem.serverItemUrl, '_blank');
    });

    it('renders a Manage in Jellyseerr button', () => {
      const row = buildResultRow(mockItem, 'Emby', 'https://jsr.test');
      const manageBtn = Array.from(row.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Manage'),
      );
      expect(manageBtn).to.exist;

      manageBtn?.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OPEN_TAB',
          payload: { url: 'https://jsr.test/movie/123' },
        }),
        expect.any(Function),
      );
    });

    it('renders a pending item and handles click', () => {
      const row = buildResultRow({ ...mockItem, status: 'pending' }, 'Emby', 'https://jsr.test');
      expect(row.textContent).to.contain('⏳ Request Pending');

      const pendingBtn = row.querySelector('button');
      pendingBtn?.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OPEN_TAB',
          payload: { url: 'https://jsr.test/movie/123' },
        }),
        expect.any(Function),
      );
    });

    it('handles request button failure and reset', async () => {
      vi.useFakeTimers();
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: unknown, cb: (response: unknown) => void) => cb({ payload: { success: false } }),
      );

      const row = buildResultRow(
        { ...mockItem, status: 'not_requested' },
        'Emby',
        'https://jsr.test',
      );
      const reqBtn = row.querySelector('button');
      reqBtn?.click();

      await vi.runAllTimersAsync();
      expect(reqBtn?.textContent).to.contain('＋ Request');
      vi.useRealTimers();
    });

    it('renders a poster image if posterUrl is provided', () => {
      const row = buildResultRow(
        { ...mockItem, posterUrl: 'https://image.test/p.jpg' },
        'Emby',
        'https://jsr.test',
      );
      const img = row.querySelector('img');
      expect(img).to.exist;
      expect(img?.src).to.equal('https://image.test/p.jpg');
    });
  });

  describe('injectSkeletonKeyframes', () => {
    it('injects style tag into head', () => {
      injectSkeletonKeyframes();
      const style = document.getElementById('media-connector-skeleton-style');
      expect(style).to.exist;
      expect(style?.textContent).to.contain('@keyframes mcShimmer');
    });

    it('does not inject duplicate styles', () => {
      injectSkeletonKeyframes();
      injectSkeletonKeyframes();
      const styles = document.querySelectorAll('#media-connector-skeleton-style');
      expect(styles.length).to.equal(1);
    });
  });
});
