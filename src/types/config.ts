/**
 * Server type discriminator for Emby vs Jellyfin.
 */
export type ServerType = 'emby' | 'jellyfin';

/**
 * Connection configuration for a media server.
 */
export interface ServerConfig {
  /** The type of media server */
  readonly serverType: ServerType;
  /** Full URL including protocol and port (e.g., https://emby.example.com:8096) */
  readonly serverUrl: string;
  /** Optional local/LAN URL for the server (e.g., http://192.168.1.100:8096) */
  readonly localServerUrl: string;
  /** API key for authentication */
  readonly apiKey: string;
}

/**
 * Jellyseerr configuration for requesting media.
 */
export interface JellyseerrConfig {
  /** Whether Jellyseerr integration is enabled */
  readonly enabled: boolean;
  /** Full URL of the Jellyseerr server */
  readonly serverUrl: string;
  /** Optional local/LAN URL for the Jellyseerr server */
  readonly localServerUrl: string;
  /** API key for Jellyseerr authentication */
  readonly apiKey: string;
}

/**
 * Full extension configuration stored in chrome.storage.
 */
export interface ExtensionConfig {
  /** Media server connection settings */
  readonly server: ServerConfig;
  /** Jellyseerr request settings */
  readonly jellyseerr: JellyseerrConfig;
}

/**
 * Default configuration used when no settings are stored.
 */
export const DEFAULT_CONFIG: ExtensionConfig = {
  server: {
    serverType: 'emby',
    serverUrl: '',
    localServerUrl: '',
    apiKey: '',
  },
  jellyseerr: {
    enabled: false,
    serverUrl: '',
    localServerUrl: '',
    apiKey: '',
  },
};
