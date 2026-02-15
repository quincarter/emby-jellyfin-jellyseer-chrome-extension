import { Effect } from 'effect';
import type {
  ExtensionConfig,
  MediaServerItem,
  MediaSearchResult,
  DetectedMedia,
  MediaAvailability,
} from '../types/index.js';
import { ServerResponseError, NetworkError } from '../types/errors.js';
import { resolveServerUrlEffect } from './url-resolver.js';

// ---------------------------------------------------------------------------
// Pure helpers (no Effect needed)
// ---------------------------------------------------------------------------

/**
 * Build API headers for the configured media server.
 * @param config - Extension configuration
 * @returns Headers object for fetch requests
 */
export const buildApiHeaders = (config: ExtensionConfig): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (config.server.serverType === 'emby') {
    headers['X-Emby-Token'] = config.server.apiKey;
  } else {
    headers['Authorization'] = `MediaBrowser Token="${config.server.apiKey}"`;
  }

  return headers;
};

// ---------------------------------------------------------------------------
// Shared: fetch + validate response
// ---------------------------------------------------------------------------

/**
 * Perform a fetch and fail with `ServerResponseError` on non-OK responses.
 */
const fetchJson = <A>(
  url: string,
  init: RequestInit,
): Effect.Effect<A, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => globalThis.fetch(url, init),
      catch: (cause) => new NetworkError({ reason: `Fetch failed: ${url}`, cause }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new ServerResponseError({
          status: response.status,
          statusText: response.statusText,
          url,
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<A>,
      catch: (cause) => new NetworkError({ reason: `JSON parse failed: ${url}`, cause }),
    });
  });

/**
 * Resolve base URL as an Effect.
 */
const getResolvedBaseUrlEffect = (config: ExtensionConfig): Effect.Effect<string, NetworkError> =>
  resolveServerUrlEffect(config);

// ---------------------------------------------------------------------------
// Effect-based API operations
// ---------------------------------------------------------------------------

/**
 * Search for a media item on the configured server.
 */
export const searchMediaEffect = (
  config: ExtensionConfig,
  query: string,
  type?: 'Movie' | 'Series' | 'Season' | 'Episode',
): Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const params = new URLSearchParams({
      SearchTerm: query,
      Recursive: 'true',
      Limit: '10',
    });

    if (type) {
      params.set('IncludeItemTypes', type);
    }

    return yield* fetchJson<MediaSearchResult>(`${baseUrl}/Items?${params.toString()}`, {
      headers: buildApiHeaders(config),
    });
  });

/**
 * Search for media by external provider ID (IMDb, TMDb).
 */
export const searchByProviderIdEffect = (
  config: ExtensionConfig,
  providerId: string,
  providerName: 'Imdb' | 'Tmdb',
  includeItemTypes?: string,
): Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const params = new URLSearchParams({
      Recursive: 'true',
    });

    if (includeItemTypes) {
      params.set('IncludeItemTypes', includeItemTypes);
    }

    if (config.server.serverType === 'emby') {
      params.set('AnyProviderIdEquals', `${providerName}.${providerId}`);
    } else {
      params.set(`Any${providerName}Id`, providerId);
    }

    return yield* fetchJson<MediaSearchResult>(`${baseUrl}/Items?${params.toString()}`, {
      headers: buildApiHeaders(config),
    });
  });

/**
 * Get seasons for a series.
 */
export const getSeasonsEffect = (
  config: ExtensionConfig,
  seriesId: string,
): Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    return yield* fetchJson<MediaSearchResult>(`${baseUrl}/Shows/${seriesId}/Seasons`, {
      headers: buildApiHeaders(config),
    });
  });

/**
 * Get episodes for a series, optionally filtering by season.
 */
export const getEpisodesEffect = (
  config: ExtensionConfig,
  seriesId: string,
  seasonNumber?: number,
): Effect.Effect<MediaSearchResult, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const params = new URLSearchParams();

    if (seasonNumber !== undefined) {
      params.set('Season', seasonNumber.toString());
    }

    return yield* fetchJson<MediaSearchResult>(
      `${baseUrl}/Shows/${seriesId}/Episodes?${params.toString()}`,
      { headers: buildApiHeaders(config) },
    );
  });

/**
 * Verify connectivity to the media server.
 * Never fails — returns `false` on any error.
 */
export const testServerConnectionEffect = (config: ExtensionConfig): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const response = yield* Effect.tryPromise({
      try: () =>
        globalThis.fetch(`${baseUrl}/System/Info/Public`, {
          headers: { Accept: 'application/json' },
        }),
      catch: () => new NetworkError({ reason: 'Connection test failed' }),
    });
    return response.ok;
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));

/**
 * Resolve the best match from search results based on detected media type.
 */
const resolveMediaMatchEffect = (
  config: ExtensionConfig,
  items: readonly MediaServerItem[],
  media: DetectedMedia,
): Effect.Effect<MediaAvailability, ServerResponseError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);

    if (media.type === 'movie') {
      const year = media.year;
      const typeMatches = items.filter((i) => i.Type === 'Movie');
      const match = year
        ? (typeMatches.find(
            (i) => i.ProductionYear !== undefined && Math.abs(i.ProductionYear - year) <= 1,
          ) ?? (typeMatches.length > 0 ? undefined : items[0]))
        : (typeMatches[0] ?? items[0]);

      if (!match) return { status: 'unavailable' as const };
      return { status: 'available' as const, item: match, serverUrl: baseUrl };
    }

    if (media.type === 'series') {
      const year = media.year;
      const typeMatches = items.filter((i) => i.Type === 'Series');
      const match = year
        ? (typeMatches.find(
            (i) => i.ProductionYear !== undefined && Math.abs(i.ProductionYear - year) <= 1,
          ) ?? (typeMatches.length > 0 ? undefined : items[0]))
        : (typeMatches[0] ?? items[0]);

      if (!match) return { status: 'unavailable' as const };
      return { status: 'available' as const, item: match, serverUrl: baseUrl };
    }

    // For season/episode, find the series first
    const series = items.find((i) => i.Type === 'Series');
    if (!series) return { status: 'unavailable' as const };

    if (media.type === 'season') {
      const seasons = yield* getSeasonsEffect(config, series.Id);
      const season = seasons.Items.find(
        (s) => s.ParentIndexNumber === media.seasonNumber || s.IndexNumber === media.seasonNumber,
      );
      if (season) {
        return { status: 'available' as const, item: season, serverUrl: baseUrl };
      }
      return {
        status: 'partial' as const,
        item: series,
        serverUrl: baseUrl,
        details: `Season ${media.seasonNumber} not found, but series exists`,
      };
    }

    if (media.type === 'episode') {
      const episodes = yield* getEpisodesEffect(config, series.Id, media.seasonNumber);
      const episode = episodes.Items.find(
        (ep) =>
          ep.IndexNumber === media.episodeNumber && ep.ParentIndexNumber === media.seasonNumber,
      );
      if (episode) {
        return { status: 'available' as const, item: episode, serverUrl: baseUrl };
      }
      return {
        status: 'partial' as const,
        item: series,
        serverUrl: baseUrl,
        details: `S${media.seasonNumber}E${media.episodeNumber} not found, but series exists`,
      };
    }

    return { status: 'unavailable' as const };
  });

/**
 * Check media availability on the server.
 *
 * Cascading search strategy: IMDb ID → TMDb ID → title search.
 * Each step is an Effect that falls through if no results are found.
 */
export const checkMediaAvailabilityEffect = (
  config: ExtensionConfig,
  media: DetectedMedia,
): Effect.Effect<MediaAvailability> =>
  Effect.gen(function* () {
    if (!config.server.serverUrl || !config.server.apiKey) {
      return { status: 'unconfigured' as const };
    }

    // Try IMDb ID first (most reliable)
    if (media.imdbId) {
      const results = yield* searchByProviderIdEffect(config, media.imdbId, 'Imdb');
      if (results.Items.length > 0) {
        return yield* resolveMediaMatchEffect(config, results.Items, media);
      }
    }

    // Try TMDb ID
    if (media.tmdbId) {
      const results = yield* searchByProviderIdEffect(config, media.tmdbId, 'Tmdb');
      if (results.Items.length > 0) {
        return yield* resolveMediaMatchEffect(config, results.Items, media);
      }
    }

    // Fall back to title search
    const title =
      media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

    const typeMap: Record<string, 'Movie' | 'Series'> = {
      movie: 'Movie',
      series: 'Series',
      season: 'Series',
      episode: 'Series',
    };

    const results = yield* searchMediaEffect(config, title, typeMap[media.type]);

    if (results.Items.length === 0) {
      return { status: 'unavailable' as const };
    }

    return yield* resolveMediaMatchEffect(config, results.Items, media);
  }).pipe(
    Effect.catchTag('ServerResponseError', (e) =>
      Effect.succeed({
        status: 'error' as const,
        message: `Server responded with ${e.status}: ${e.statusText}`,
      }),
    ),
    Effect.catchTag('NetworkError', (e) =>
      Effect.succeed({ status: 'error' as const, message: e.reason }),
    ),
  );

// ---------------------------------------------------------------------------
// Legacy async wrappers (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use `searchMediaEffect` */
export const searchMedia = async (
  config: ExtensionConfig,
  query: string,
  type?: 'Movie' | 'Series' | 'Season' | 'Episode',
): Promise<MediaSearchResult> => Effect.runPromise(searchMediaEffect(config, query, type));

/** @deprecated Use `searchByProviderIdEffect` */
export const searchByProviderId = async (
  config: ExtensionConfig,
  providerId: string,
  providerName: 'Imdb' | 'Tmdb',
  includeItemTypes?: string,
): Promise<MediaSearchResult> =>
  Effect.runPromise(searchByProviderIdEffect(config, providerId, providerName, includeItemTypes));

/** @deprecated Use `getSeasonsEffect` */
export const getSeasons = async (
  config: ExtensionConfig,
  seriesId: string,
): Promise<MediaSearchResult> => Effect.runPromise(getSeasonsEffect(config, seriesId));

/** @deprecated Use `getEpisodesEffect` */
export const getEpisodes = async (
  config: ExtensionConfig,
  seriesId: string,
  seasonNumber?: number,
): Promise<MediaSearchResult> =>
  Effect.runPromise(getEpisodesEffect(config, seriesId, seasonNumber));

/** @deprecated Use `testServerConnectionEffect` */
export const testServerConnection = async (config: ExtensionConfig): Promise<boolean> =>
  Effect.runPromise(testServerConnectionEffect(config));

/** @deprecated Use `checkMediaAvailabilityEffect` */
export const checkMediaAvailability = async (
  config: ExtensionConfig,
  media: DetectedMedia,
): Promise<MediaAvailability> => Effect.runPromise(checkMediaAvailabilityEffect(config, media));
