import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from './config.js';
import type { ExtensionConfig, ServerConfig, JellyseerrConfig, ServerType } from './config.js';

describe('DEFAULT_CONFIG', () => {
  it('has emby as default server type', () => {
    expect(DEFAULT_CONFIG.server.serverType).toBe('emby');
  });

  it('has empty server URL', () => {
    expect(DEFAULT_CONFIG.server.serverUrl).toBe('');
  });

  it('has empty local server URL', () => {
    expect(DEFAULT_CONFIG.server.localServerUrl).toBe('');
  });

  it('has empty API key', () => {
    expect(DEFAULT_CONFIG.server.apiKey).toBe('');
  });

  it('has jellyseerr disabled by default', () => {
    expect(DEFAULT_CONFIG.jellyseerr.enabled).toBe(false);
  });

  it('has empty jellyseerr URLs', () => {
    expect(DEFAULT_CONFIG.jellyseerr.serverUrl).toBe('');
    expect(DEFAULT_CONFIG.jellyseerr.localServerUrl).toBe('');
  });

  it('has empty jellyseerr API key', () => {
    expect(DEFAULT_CONFIG.jellyseerr.apiKey).toBe('');
  });

  it('is a valid ExtensionConfig', () => {
    const config: ExtensionConfig = DEFAULT_CONFIG;
    expect(config.server).toBeDefined();
    expect(config.jellyseerr).toBeDefined();
  });
});

describe('type contracts', () => {
  it('ServerType accepts emby and jellyfin', () => {
    const emby: ServerType = 'emby';
    const jf: ServerType = 'jellyfin';
    expect(emby).toBe('emby');
    expect(jf).toBe('jellyfin');
  });

  it('ServerConfig has all required fields', () => {
    const config: ServerConfig = {
      serverType: 'emby',
      serverUrl: 'https://test.com',
      localServerUrl: 'http://192.168.1.1',
      apiKey: 'key',
    };
    expect(config.serverType).toBe('emby');
    expect(config.serverUrl).toBe('https://test.com');
    expect(config.localServerUrl).toBe('http://192.168.1.1');
    expect(config.apiKey).toBe('key');
  });

  it('JellyseerrConfig has all required fields', () => {
    const config: JellyseerrConfig = {
      enabled: true,
      serverUrl: 'https://js.test.com',
      localServerUrl: '',
      apiKey: 'js-key',
    };
    expect(config.enabled).toBe(true);
    expect(config.serverUrl).toBe('https://js.test.com');
    expect(config.apiKey).toBe('js-key');
  });
});
