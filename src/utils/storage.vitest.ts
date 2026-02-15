import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, clearConfig } from './storage.js';
import { DEFAULT_CONFIG } from '../types/index.js';
import type { ExtensionConfig } from '../types/index.js';

describe('storage (localStorage fallback)', () => {
  // In vitest with happy-dom, chrome.storage is not available,
  // so these tests exercise the localStorage fallback path.

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadConfig', () => {
    it('returns DEFAULT_CONFIG when nothing is stored', async () => {
      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('returns stored config when available', async () => {
      const custom: ExtensionConfig = {
        server: {
          serverType: 'jellyfin',
          serverUrl: 'https://jf.example.com',
          localServerUrl: 'http://192.168.1.50:8096',
          apiKey: 'my-api-key',
        },
        jellyseerr: {
          enabled: true,
          serverUrl: 'https://js.example.com',
          localServerUrl: '',
          apiKey: 'js-key',
        },
      };

      localStorage.setItem('mediaConnectorConfig', JSON.stringify(custom));

      const config = await loadConfig();
      expect(config).toEqual(custom);
      expect(config.server.serverType).toBe('jellyfin');
    });

    it('returns DEFAULT_CONFIG when stored data is invalid JSON', async () => {
      localStorage.setItem('mediaConnectorConfig', 'not json {{{');

      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('saveConfig', () => {
    it('persists config to localStorage', async () => {
      const config: ExtensionConfig = {
        server: {
          serverType: 'emby',
          serverUrl: 'https://emby.test.com',
          localServerUrl: '',
          apiKey: 'key-123',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      await saveConfig(config);

      const stored = JSON.parse(localStorage.getItem('mediaConnectorConfig')!);
      expect(stored.server.serverType).toBe('emby');
      expect(stored.server.apiKey).toBe('key-123');
    });

    it('overwrites existing config', async () => {
      const config1: ExtensionConfig = {
        server: {
          serverType: 'emby',
          serverUrl: 'https://first.com',
          localServerUrl: '',
          apiKey: 'key1',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      const config2: ExtensionConfig = {
        server: {
          serverType: 'jellyfin',
          serverUrl: 'https://second.com',
          localServerUrl: '',
          apiKey: 'key2',
        },
        jellyseerr: {
          enabled: true,
          serverUrl: 'https://js.com',
          localServerUrl: '',
          apiKey: 'jkey',
        },
      };

      await saveConfig(config1);
      await saveConfig(config2);

      const loaded = await loadConfig();
      expect(loaded.server.serverType).toBe('jellyfin');
      expect(loaded.server.serverUrl).toBe('https://second.com');
    });
  });

  describe('clearConfig', () => {
    it('removes stored config', async () => {
      await saveConfig({
        server: {
          serverType: 'emby',
          serverUrl: 'https://test.com',
          localServerUrl: '',
          apiKey: 'key',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      });

      expect(localStorage.getItem('mediaConnectorConfig')).not.toBeNull();

      await clearConfig();

      expect(localStorage.getItem('mediaConnectorConfig')).toBeNull();
    });

    it('is a no-op when nothing is stored', async () => {
      await clearConfig();
      const config = await loadConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('round-trip', () => {
    it('save then load returns same config', async () => {
      const config: ExtensionConfig = {
        server: {
          serverType: 'jellyfin',
          serverUrl: 'https://jf.test.com:8920',
          localServerUrl: 'http://10.0.0.5:8096',
          apiKey: 'round-trip-key',
        },
        jellyseerr: {
          enabled: true,
          serverUrl: 'https://js.test.com',
          localServerUrl: 'http://10.0.0.5:5055',
          apiKey: 'js-round-trip',
        },
      };

      await saveConfig(config);
      const loaded = await loadConfig();
      expect(loaded).toEqual(config);
    });
  });
});

describe('storage (chrome.storage.local)', () => {
  const savedConfig: ExtensionConfig = {
    server: {
      serverType: 'jellyfin',
      serverUrl: 'https://jf.test.com',
      localServerUrl: '',
      apiKey: 'chrome-key',
    },
    jellyseerr: {
      enabled: false,
      serverUrl: '',
      localServerUrl: '',
      apiKey: '',
    },
  };

  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};

    // Mock chrome.storage.local
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => {
            return { [key]: store[key] };
          }),
          set: vi.fn(async (data: Record<string, unknown>) => {
            Object.assign(store, data);
          }),
          remove: vi.fn(async (key: string) => {
            delete store[key];
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadConfig returns DEFAULT_CONFIG when chrome.storage is empty', async () => {
    const config = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('saveConfig persists to chrome.storage.local', async () => {
    await saveConfig(savedConfig);
    expect(store['mediaConnectorConfig']).toEqual(savedConfig);
  });

  it('loadConfig returns stored config from chrome.storage.local', async () => {
    store['mediaConnectorConfig'] = savedConfig;

    const config = await loadConfig();
    expect(config).toEqual(savedConfig);
    expect(config.server.serverType).toBe('jellyfin');
  });

  it('clearConfig removes from chrome.storage.local', async () => {
    store['mediaConnectorConfig'] = savedConfig;

    await clearConfig();
    expect(store['mediaConnectorConfig']).toBeUndefined();
  });

  it('round-trip via chrome.storage.local', async () => {
    await saveConfig(savedConfig);
    const loaded = await loadConfig();
    expect(loaded).toEqual(savedConfig);
  });
});
