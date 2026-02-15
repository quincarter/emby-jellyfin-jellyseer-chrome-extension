import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { injectStatusIndicator } from './fallback.js';
import type { CheckMediaResponse } from '../types/messages.js';

describe('fallback injection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('injects available indicator', () => {
    const response: CheckMediaResponse = {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: {
        status: 'available',
        itemUrl: 'https://emby.test/123',
      },
    };

    injectStatusIndicator(response, 'movie');

    const indicator = document.getElementById('media-connector-indicator');
    expect(indicator).to.exist;
    expect(indicator?.textContent).to.contain('Available on Server');
  });

  it('injects unavailable indicator', () => {
    const response: CheckMediaResponse = {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: {
        status: 'unavailable',
      },
    };

    injectStatusIndicator(response, 'movie');

    const indicator = document.getElementById('media-connector-indicator');
    expect(indicator?.textContent).to.contain('Request with Jellyseerr');
  });

  it('injects unconfigured indicator', () => {
    const response: CheckMediaResponse = {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: {
        status: 'unconfigured',
      },
    };

    injectStatusIndicator(response, 'movie');

    const indicator = document.getElementById('media-connector-indicator');
    expect(indicator?.textContent).to.contain('Configure Extension');
  });

  it('injects partial indicator', () => {
    const response: CheckMediaResponse = {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: {
        status: 'partial',
        itemUrl: 'https://emby.test/123',
        details: 'Only Season 1',
      },
    };

    injectStatusIndicator(response, 'movie');

    const indicator = document.getElementById('media-connector-indicator');
    expect(indicator?.textContent).to.contain('Only Season 1');

    vi.spyOn(window, 'open').mockImplementation(() => null);
    indicator?.click();
    expect(window.open).toHaveBeenCalledWith('https://emby.test/123', '_blank');
  });

  it('removes itself when close is clicked', async () => {
    const response: CheckMediaResponse = {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: { status: 'available', itemUrl: 'url' },
    };

    injectStatusIndicator(response, 'movie');
    const indicator = document.getElementById('media-connector-indicator');
    const closeBtn = Array.from(indicator!.querySelectorAll('span')).find(
      (s) => s.textContent === '×',
    );

    expect(closeBtn).to.exist;
    closeBtn!.click();

    // It has a 200ms timeout before removal
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(document.getElementById('media-connector-indicator')).to.not.exist;
  });
});
