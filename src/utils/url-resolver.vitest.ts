import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeServerUrl,
  resolveServerUrl,
  resolveJellyseerrUrl,
  clearResolvedUrlCache,
  isUsingLocalUrl,
} from './url-resolver.js';
import type { ExtensionConfig } from '../types/index.js';

const baseConfig: ExtensionConfig = {
  server: {
    serverType: 'emby',
    serverUrl: 'https://emby.example.com',
    localServerUrl: 'http://192.168.1.100:8096',
    apiKey: 'key',
  },
  jellyseerr: {
    enabled: true,
    serverUrl: 'https://jellyseerr.example.com',
    localServerUrl: 'http://192.168.1.100:5055',
    apiKey: 'jkey',
  },
};

describe('probeServerUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when server responds with 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await probeServerUrl('https://emby.example.com');
    expect(result).toBe(true);

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe('https://emby.example.com/System/Info/Public');
  });

  it('returns false when server responds with non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await probeServerUrl('https://emby.example.com');
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    const result = await probeServerUrl('https://emby.example.com');
    expect(result).toBe(false);
  });

  it('uses custom probe path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await probeServerUrl('https://test.com', '/api/v1/status');
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toBe('https://test.com/api/v1/status');
  });

  it('strips trailing slash from URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await probeServerUrl('https://test.com/');
    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toBe('https://test.com/System/Info/Public');
  });
});

describe('resolveServerUrl', () => {
  beforeEach(() => {
    clearResolvedUrlCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearResolvedUrlCache();
  });

  it('returns public URL when no local URL is configured', async () => {
    const config: ExtensionConfig = {
      ...baseConfig,
      server: { ...baseConfig.server, localServerUrl: '' },
    };

    const url = await resolveServerUrl(config);
    expect(url).toBe('https://emby.example.com');
  });

  it('returns local URL when reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const url = await resolveServerUrl(baseConfig);
    expect(url).toBe('http://192.168.1.100:8096');
  });

  it('returns public URL when local is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unreachable')));

    const url = await resolveServerUrl(baseConfig);
    expect(url).toBe('https://emby.example.com');
  });

  it('caches resolved URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await resolveServerUrl(baseConfig);
    await resolveServerUrl(baseConfig);

    // Only one fetch call because second call uses cache
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});

describe('resolveJellyseerrUrl', () => {
  beforeEach(() => {
    clearResolvedUrlCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearResolvedUrlCache();
  });

  it('returns public URL when no local URL is configured', async () => {
    const config: ExtensionConfig = {
      ...baseConfig,
      jellyseerr: { ...baseConfig.jellyseerr, localServerUrl: '' },
    };

    const url = await resolveJellyseerrUrl(config);
    expect(url).toBe('https://jellyseerr.example.com');
  });

  it('probes local URL with /api/v1/status path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await resolveJellyseerrUrl(baseConfig);

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toContain('/api/v1/status');
  });
});

describe('clearResolvedUrlCache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearResolvedUrlCache();
  });

  it('forces re-probe after clearing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await resolveServerUrl(baseConfig);
    clearResolvedUrlCache();
    await resolveServerUrl(baseConfig);

    // Two probes because cache was cleared
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

describe('isUsingLocalUrl', () => {
  beforeEach(() => {
    clearResolvedUrlCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearResolvedUrlCache();
  });

  it('returns false when no cache exists', () => {
    const result = isUsingLocalUrl('http://192.168.1.100:8096', 'https://emby.example.com');
    expect(result).toBe(false);
  });

  it('returns false when local URL is empty', () => {
    const result = isUsingLocalUrl('', 'https://emby.example.com');
    expect(result).toBe(false);
  });

  it('returns true when local URL was resolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    await resolveServerUrl(baseConfig);

    const result = isUsingLocalUrl('http://192.168.1.100:8096', 'https://emby.example.com');
    expect(result).toBe(true);
  });
});
