/**
 * Effect Service definitions for dependency injection.
 *
 * Each service is defined as a `Context.Tag` with an interface describing
 * its capabilities.  Concrete implementations are provided via `Layer`s,
 * which can be swapped out in tests for mock layers.
 */
import { Context, Effect, Layer } from 'effect';
import type {
  ExtensionConfig,
  MediaSearchResult,
  MediaAvailability,
  DetectedMedia,
} from '../types/index.js';
import {
  StorageError,
  NetworkError,
  ServerResponseError,
  JellyseerrError,
  EmptyQueryError,
  ConfigurationError,
} from '../types/errors.js';
import type {
  JellyseerrSearchResponse,
  JellyseerrRequestResult,
} from '../utils/jellyseerr-client.js';

// ---------------------------------------------------------------------------
// HttpClient — wraps `fetch` for testability
// ---------------------------------------------------------------------------

/** Minimal fetch-like interface. */
export interface HttpClient {
  readonly fetch: (url: string, init?: RequestInit) => Effect.Effect<Response, NetworkError>;
}

export class HttpClientService extends Context.Tag('HttpClientService')<
  HttpClientService,
  HttpClient
>() {}

/** Live implementation backed by the global `fetch`. */
export const HttpClientLive = Layer.succeed(
  HttpClientService,
  HttpClientService.of({
    fetch: (url, init) =>
      Effect.tryPromise({
        try: () => globalThis.fetch(url, init),
        catch: (cause) => new NetworkError({ reason: `Fetch failed: ${url}`, cause }),
      }),
  }),
);

// ---------------------------------------------------------------------------
// Storage — read/write extension config
// ---------------------------------------------------------------------------

export interface Storage {
  readonly load: Effect.Effect<ExtensionConfig, StorageError>;
  readonly save: (config: ExtensionConfig) => Effect.Effect<void, StorageError>;
  readonly clear: Effect.Effect<void, StorageError>;
}

export class StorageService extends Context.Tag('StorageService')<StorageService, Storage>() {}

// ---------------------------------------------------------------------------
// UrlResolver — resolve best URL (local vs public)
// ---------------------------------------------------------------------------

export interface UrlResolver {
  readonly resolveServerUrl: (config: ExtensionConfig) => Effect.Effect<string, NetworkError>;
  readonly resolveJellyseerrUrl: (config: ExtensionConfig) => Effect.Effect<string, NetworkError>;
  readonly probeServerUrl: (
    url: string,
    probePath?: string,
    timeoutMs?: number,
  ) => Effect.Effect<boolean, never>;
  readonly clearCache: Effect.Effect<void, never>;
  readonly isUsingLocalUrl: (localUrl: string, publicUrl: string) => boolean;
}

export class UrlResolverService extends Context.Tag('UrlResolverService')<
  UrlResolverService,
  UrlResolver
>() {}

// ---------------------------------------------------------------------------
// MediaServer — Emby/Jellyfin API operations
// ---------------------------------------------------------------------------

export interface MediaServer {
  readonly searchMedia: (
    config: ExtensionConfig,
    query: string,
    type?: 'Movie' | 'Series' | 'Season' | 'Episode',
  ) => Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError>;

  readonly searchByProviderId: (
    config: ExtensionConfig,
    providerId: string,
    providerName: 'Imdb' | 'Tmdb',
    includeItemTypes?: string,
  ) => Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError>;

  readonly getSeasons: (
    config: ExtensionConfig,
    seriesId: string,
  ) => Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError>;

  readonly getEpisodes: (
    config: ExtensionConfig,
    seriesId: string,
    seasonNumber?: number,
  ) => Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError>;

  readonly testConnection: (config: ExtensionConfig) => Effect.Effect<boolean, never>;

  readonly checkAvailability: (
    config: ExtensionConfig,
    media: DetectedMedia,
  ) => Effect.Effect<MediaAvailability, ServerResponseError | NetworkError | ConfigurationError>;

  readonly buildApiHeaders: (config: ExtensionConfig) => Record<string, string>;
}

export class MediaServerService extends Context.Tag('MediaServerService')<
  MediaServerService,
  MediaServer
>() {}

// ---------------------------------------------------------------------------
// Jellyseerr — Jellyseerr API operations
// ---------------------------------------------------------------------------

export interface Jellyseerr {
  readonly search: (
    config: ExtensionConfig,
    query: string,
  ) => Effect.Effect<JellyseerrSearchResponse, JellyseerrError | EmptyQueryError | NetworkError>;

  readonly requestMovie: (
    config: ExtensionConfig,
    tmdbId: number,
  ) => Effect.Effect<JellyseerrRequestResult, JellyseerrError | NetworkError>;

  readonly requestTvShow: (
    config: ExtensionConfig,
    tmdbId: number,
    seasons?: number[],
  ) => Effect.Effect<JellyseerrRequestResult, JellyseerrError | NetworkError>;

  readonly testConnection: (config: ExtensionConfig) => Effect.Effect<boolean, never>;
}

export class JellyseerrService extends Context.Tag('JellyseerrService')<
  JellyseerrService,
  Jellyseerr
>() {}

// ---------------------------------------------------------------------------
// ChromeCookies — abstraction over chrome.cookies for CSRF clearing
// ---------------------------------------------------------------------------

export interface ChromeCookies {
  readonly clearForDomain: (baseUrl: string) => Effect.Effect<void, never>;
}

export class ChromeCookiesService extends Context.Tag('ChromeCookiesService')<
  ChromeCookiesService,
  ChromeCookies
>() {}

/** Live implementation using chrome.cookies API. */
export const ChromeCookiesLive = Layer.succeed(
  ChromeCookiesService,
  ChromeCookiesService.of({
    clearForDomain: (baseUrl) =>
      Effect.gen(function* () {
        if (typeof chrome === 'undefined' || !chrome.cookies) return;

        const result = yield* Effect.tryPromise({
          try: async () => {
            const url = new URL(baseUrl);
            const cookies = await chrome.cookies.getAll({ domain: url.hostname });
            console.log(`[Media Connector] Clearing ${cookies.length} cookies for ${url.hostname}`);
            await Promise.all(
              cookies.map((cookie) => {
                const protocol = cookie.secure ? 'https' : 'http';
                const cookieUrl = `${protocol}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
                return chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
              }),
            );
          },
          catch: () => undefined, // swallow cookie clearing errors
        });

        return result;
      }).pipe(Effect.catchAll(() => Effect.void)),
  }),
);

/** No-op implementation for non-extension contexts (sandbox, tests). */
export const ChromeCookiesNoop = Layer.succeed(
  ChromeCookiesService,
  ChromeCookiesService.of({
    clearForDomain: () => Effect.void,
  }),
);
