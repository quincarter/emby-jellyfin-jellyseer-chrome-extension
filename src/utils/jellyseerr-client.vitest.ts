import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  jellyseerrSearch,
  requestMovie,
  requestTvShow,
  testJellyseerrConnection,
} from './jellyseerr-client.js';
import type { ExtensionConfig } from '../types/index.js';
import type { JellyseerrSearchResponse } from './jellyseerr-client.js';

const config: ExtensionConfig = {
  server: {
    serverType: 'emby',
    serverUrl: 'https://emby.example.com',
    localServerUrl: '',
    apiKey: 'emby-key',
  },
  jellyseerr: {
    enabled: true,
    serverUrl: 'https://jellyseerr.example.com',
    localServerUrl: '',
    apiKey: 'js-api-key-123',
  },
};

const mockSearchResponse: JellyseerrSearchResponse = {
  page: 1,
  totalPages: 1,
  totalResults: 1,
  results: [
    {
      id: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      overview: 'A hacker discovers reality is a simulation.',
      posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    },
  ],
};

describe('jellyseerrSearch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls correct URL with query parameter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      }),
    );

    await jellyseerrSearch(config, 'The Matrix');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('jellyseerr.example.com/api/v1/search?query=The%20Matrix');
  });

  it('includes X-Api-Key header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      }),
    );

    await jellyseerrSearch(config, 'The Matrix');

    const options = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('js-api-key-123');
  });

  it('throws on empty query', async () => {
    await expect(jellyseerrSearch(config, '')).rejects.toThrow('Search query is empty');
    await expect(jellyseerrSearch(config, '   ')).rejects.toThrow('Search query is empty');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );

    await expect(jellyseerrSearch(config, 'Test')).rejects.toThrow('Jellyseerr responded with 500');
  });
});

describe('requestMovie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST request with correct body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            status: 2,
            media: { id: 1, tmdbId: 603, status: 2 },
          }),
      }),
    );

    await requestMovie(config, 603);

    const call = vi.mocked(fetch).mock.calls[0];
    const url = call[0] as string;
    const options = call[1] as RequestInit;
    expect(url).toContain('/api/v1/request');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body as string);
    expect(body.mediaType).toBe('movie');
    expect(body.mediaId).toBe(603);
  });

  it('throws on failed request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      }),
    );

    await expect(requestMovie(config, 603)).rejects.toThrow('Jellyseerr request failed (403)');
  });

  it('logs CSRF warning when error body contains csrf', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('CSRF token validation failed'),
      }),
    );

    await expect(requestMovie(config, 603)).rejects.toThrow('Jellyseerr request failed (403)');

    // Should have logged the CSRF-specific warning
    const csrfLog = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes('CSRF error detected'),
    );
    expect(csrfLog).toBeDefined();
    errorSpy.mockRestore();
  });
});

describe('requestTvShow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends POST request with seasons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 2,
            status: 2,
            media: { id: 2, tmdbId: 1396, status: 2 },
          }),
      }),
    );

    await requestTvShow(config, 1396, [1, 2, 3]);

    const options = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.mediaType).toBe('tv');
    expect(body.mediaId).toBe(1396);
    expect(body.seasons).toEqual([1, 2, 3]);
  });

  it('omits seasons when not specified', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 3,
            status: 2,
            media: { id: 3, tmdbId: 1396, status: 2 },
          }),
      }),
    );

    await requestTvShow(config, 1396);

    const options = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.seasons).toBeUndefined();
  });

  it('omits seasons when empty array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 4,
            status: 2,
            media: { id: 4, tmdbId: 1396, status: 2 },
          }),
      }),
    );

    await requestTvShow(config, 1396, []);

    const options = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.seasons).toBeUndefined();
  });

  it('throws on failed request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      }),
    );

    await expect(requestTvShow(config, 1396, [1])).rejects.toThrow(
      'Jellyseerr request failed (500)',
    );
  });

  it('logs CSRF warning when TV request error body contains csrf', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('invalid csrf token'),
      }),
    );

    await expect(requestTvShow(config, 1396)).rejects.toThrow('Jellyseerr request failed (403)');

    const csrfLog = errorSpy.mock.calls.find((call) =>
      String(call[0]).includes('CSRF error detected'),
    );
    expect(csrfLog).toBeDefined();
    errorSpy.mockRestore();
  });
});

describe('testJellyseerrConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when status endpoint responds OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await testJellyseerrConnection(config);
    expect(result).toBe(true);
  });

  it('returns false when status endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await testJellyseerrConnection(config);
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const result = await testJellyseerrConnection(config);
    expect(result).toBe(false);
  });
});
