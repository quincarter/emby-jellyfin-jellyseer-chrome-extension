import { Effect } from 'effect';
import type { ExtensionConfig } from '../types/index.js';
import { JellyseerrError, EmptyQueryError, NetworkError } from '../types/errors.js';
import { resolveJellyseerrUrlEffect } from './url-resolver.js';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build Jellyseerr API headers.
 *
 * This extension uses **API Key auth exclusively**, which means
 * CSRF tokens are NOT required. The `X-Api-Key` header is sufficient
 * for all GET, POST, PUT, and DELETE requests.
 */
const buildJellyseerrHeaders = (config: ExtensionConfig): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Api-Key': config.jellyseerr.apiKey,
});

// ---------------------------------------------------------------------------
// Cookie clearing (side effect)
// ---------------------------------------------------------------------------

/**
 * Clear all cookies for a Jellyseerr domain.
 * Swallows errors — if cookies can't be cleared, we continue anyway.
 */
const clearJellyseerrCookiesEffect = (baseUrl: string): Effect.Effect<void> =>
  Effect.tryPromise({
    try: async () => {
      if (typeof chrome === 'undefined' || !chrome.cookies) return;

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
    catch: (e) => {
      console.warn('[Media Connector] Failed to clear cookies:', e);
      return undefined as never; // never reached — handled below
    },
  }).pipe(Effect.catchAll(() => Effect.void));

// ---------------------------------------------------------------------------
// Resolve base URL as Effect
// ---------------------------------------------------------------------------

const getResolvedBaseUrlEffect = (config: ExtensionConfig): Effect.Effect<string, NetworkError> =>
  resolveJellyseerrUrlEffect(config);

// ---------------------------------------------------------------------------
// Shared: fetch + validate Jellyseerr response
// ---------------------------------------------------------------------------

/**
 * Perform a fetch and fail with `JellyseerrError` on non-OK responses.
 * Detects CSRF errors and logs guidance.
 */
const fetchJellyseerr = <A>(
  url: string,
  init: RequestInit,
  baseUrl: string,
): Effect.Effect<A, JellyseerrError | NetworkError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => globalThis.fetch(url, init),
      catch: (cause) => new NetworkError({ reason: `Fetch failed: ${url}`, cause }),
    });

    if (!response.ok) {
      const body = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () => new NetworkError({ reason: 'Failed to read error body' }),
      });

      if (body.toLowerCase().includes('csrf')) {
        console.error(
          `[Media Connector] ⚠️ CSRF error detected! Please disable CSRF protection in your Jellyseerr settings:\n  → ${baseUrl}/settings/network\n  Uncheck "Enable CSRF Protection" and save.`,
        );
      }

      return yield* Effect.fail(
        new JellyseerrError({
          reason: `Jellyseerr responded with ${response.status}: ${body.slice(0, 200)}`,
          status: response.status,
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<A>,
      catch: (cause) => new NetworkError({ reason: `JSON parse failed: ${url}`, cause }),
    });
  });

// ---------------------------------------------------------------------------
// Effect-based API operations
// ---------------------------------------------------------------------------

/**
 * Search Jellyseerr for a movie or TV show.
 */
export const jellyseerrSearchEffect = (
  config: ExtensionConfig,
  query: string,
): Effect.Effect<JellyseerrSearchResponse, JellyseerrError | EmptyQueryError | NetworkError> =>
  Effect.gen(function* () {
    const trimmed = query.trim();

    if (!trimmed) {
      return yield* Effect.fail(new EmptyQueryError({ query }));
    }

    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const url = `${baseUrl}/api/v1/search?query=${encodeURIComponent(trimmed)}&page=1&language=en`;

    console.log(
      '[Media Connector] Jellyseerr SEARCH request:',
      '\n  Configured URL:',
      config.jellyseerr.serverUrl,
      '\n  Local URL:',
      config.jellyseerr.localServerUrl ?? '(none)',
      '\n  Resolved URL:',
      baseUrl,
      '\n  Full request URL:',
      url,
    );

    return yield* fetchJellyseerr<JellyseerrSearchResponse>(
      url,
      { headers: buildJellyseerrHeaders(config), credentials: 'omit' },
      baseUrl,
    );
  });

/**
 * Request a movie via Jellyseerr.
 */
export const requestMovieEffect = (
  config: ExtensionConfig,
  tmdbId: number,
): Effect.Effect<JellyseerrRequestResult, JellyseerrError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const headers = buildJellyseerrHeaders(config);

    yield* clearJellyseerrCookiesEffect(baseUrl);

    const requestUrl = `${baseUrl}/api/v1/request`;
    const requestBody = { mediaType: 'movie' as const, mediaId: tmdbId };

    console.log(
      '[Media Connector] Jellyseerr REQUEST MOVIE:',
      '\n  Configured URL:',
      config.jellyseerr.serverUrl,
      '\n  Local URL:',
      config.jellyseerr.localServerUrl ?? '(none)',
      '\n  Resolved URL:',
      baseUrl,
      '\n  POST:',
      requestUrl,
      '\n  Body:',
      JSON.stringify(requestBody),
      '\n  API Key:',
      config.jellyseerr.apiKey ? `${config.jellyseerr.apiKey.slice(0, 4)}...` : '(missing)',
    );

    return yield* fetchJellyseerr<JellyseerrRequestResult>(
      requestUrl,
      {
        method: 'POST',
        headers,
        credentials: 'omit',
        body: JSON.stringify(requestBody),
      },
      baseUrl,
    );
  });

/**
 * Request a TV show via Jellyseerr.
 */
export const requestTvShowEffect = (
  config: ExtensionConfig,
  tmdbId: number,
  seasons?: number[],
): Effect.Effect<JellyseerrRequestResult, JellyseerrError | NetworkError> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);

    const body: Record<string, unknown> = {
      mediaType: 'tv',
      mediaId: tmdbId,
    };

    if (seasons && seasons.length > 0) {
      body['seasons'] = seasons;
    }

    const headers = buildJellyseerrHeaders(config);
    yield* clearJellyseerrCookiesEffect(baseUrl);

    const requestUrl = `${baseUrl}/api/v1/request`;

    console.log(
      '[Media Connector] Jellyseerr REQUEST TV SHOW:',
      '\n  Configured URL:',
      config.jellyseerr.serverUrl,
      '\n  Local URL:',
      config.jellyseerr.localServerUrl ?? '(none)',
      '\n  Resolved URL:',
      baseUrl,
      '\n  POST:',
      requestUrl,
      '\n  Body:',
      JSON.stringify(body),
      '\n  API Key:',
      config.jellyseerr.apiKey ? `${config.jellyseerr.apiKey.slice(0, 4)}...` : '(missing)',
    );

    return yield* fetchJellyseerr<JellyseerrRequestResult>(
      requestUrl,
      {
        method: 'POST',
        headers,
        credentials: 'omit',
        body: JSON.stringify(body),
      },
      baseUrl,
    );
  });

/**
 * Test Jellyseerr server connectivity.
 * Never fails — returns `false` on any error.
 */
export const testJellyseerrConnectionEffect = (config: ExtensionConfig): Effect.Effect<boolean> =>
  Effect.gen(function* () {
    const baseUrl = yield* getResolvedBaseUrlEffect(config);
    const testUrl = `${baseUrl}/api/v1/status`;

    console.log(
      '[Media Connector] Jellyseerr TEST CONNECTION:',
      '\n  Configured URL:',
      config.jellyseerr.serverUrl,
      '\n  Local URL:',
      config.jellyseerr.localServerUrl ?? '(none)',
      '\n  Resolved URL:',
      baseUrl,
      '\n  GET:',
      testUrl,
    );

    const response = yield* Effect.tryPromise({
      try: () =>
        globalThis.fetch(testUrl, {
          headers: buildJellyseerrHeaders(config),
          credentials: 'omit',
        }),
      catch: () => new NetworkError({ reason: 'Connection test failed' }),
    });

    console.log(
      '[Media Connector] Jellyseerr TEST CONNECTION result:',
      response.status,
      response.ok ? 'OK' : 'FAILED',
    );

    return response.ok;
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));

// ---------------------------------------------------------------------------
// Legacy async wrappers (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use `jellyseerrSearchEffect` */
export const jellyseerrSearch = async (
  config: ExtensionConfig,
  query: string,
): Promise<JellyseerrSearchResponse> => Effect.runPromise(jellyseerrSearchEffect(config, query));

/** @deprecated Use `requestMovieEffect` */
export const requestMovie = async (
  config: ExtensionConfig,
  tmdbId: number,
): Promise<JellyseerrRequestResult> => Effect.runPromise(requestMovieEffect(config, tmdbId));

/** @deprecated Use `requestTvShowEffect` */
export const requestTvShow = async (
  config: ExtensionConfig,
  tmdbId: number,
  seasons?: number[],
): Promise<JellyseerrRequestResult> =>
  Effect.runPromise(requestTvShowEffect(config, tmdbId, seasons));

/** @deprecated Use `testJellyseerrConnectionEffect` */
export const testJellyseerrConnection = async (config: ExtensionConfig): Promise<boolean> =>
  Effect.runPromise(testJellyseerrConnectionEffect(config));

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility)
// ---------------------------------------------------------------------------

/**
 * Jellyseerr search response structure.
 */
export interface JellyseerrSearchResponse {
  readonly page: number;
  readonly totalPages: number;
  readonly totalResults: number;
  readonly results: readonly JellyseerrSearchResult[];
}

/**
 * Individual search result from Jellyseerr.
 */
export interface JellyseerrSearchResult {
  readonly id: number;
  readonly mediaType: 'movie' | 'tv';
  readonly title?: string;
  readonly name?: string;
  readonly releaseDate?: string;
  readonly firstAirDate?: string;
  readonly overview: string;
  readonly posterPath?: string;
  readonly backdropPath?: string;
  readonly voteAverage?: number;
  readonly mediaInfo?: JellyseerrMediaInfo;
}

/**
 * Jellyseerr media info — indicates whether the item
 * already exists in the connected media server.
 *
 * status values:
 *  1 = Unknown
 *  2 = Pending
 *  3 = Processing
 *  4 = Partially Available
 *  5 = Available
 */
export interface JellyseerrMediaInfo {
  readonly id: number;
  readonly tmdbId: number;
  readonly status: number;
  readonly requests?: JellyseerrMediaRequest[];
}

/**
 * A request entry attached to media info.
 */
export interface JellyseerrMediaRequest {
  readonly id: number;
  readonly status: number;
  readonly requestedBy: { readonly displayName: string };
}

/**
 * Result from a Jellyseerr media request.
 */
export interface JellyseerrRequestResult {
  readonly id: number;
  readonly status: number;
  readonly media: {
    readonly id: number;
    readonly tmdbId: number;
    readonly status: number;
  };
}
