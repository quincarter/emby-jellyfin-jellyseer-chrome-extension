import { Effect, Match } from 'effect';
import { loadConfigEffect, saveConfigEffect } from '../utils/storage.js';
import {
  checkMediaAvailabilityEffect,
  searchByProviderIdEffect,
  testServerConnectionEffect,
} from '../utils/api-client.js';
import { clearResolvedUrlCacheEffect, resolveServerUrlEffect } from '../utils/url-resolver.js';
import {
  testJellyseerrConnectionEffect,
  jellyseerrSearchEffect,
  requestMovieEffect,
  requestTvShowEffect,
} from '../utils/jellyseerr-client.js';
import { resolveJellyseerrUrlEffect } from '../utils/url-resolver.js';
import type { ExtensionConfig } from '../types/index.js';
import type {
  CheckMediaMessage,
  OpenTabMessage,
  RequestMediaMessage,
  SearchJellyseerrMessage,
  SaveConfigMessage,
} from '../types/messages.js';
import {
  mapMediaStatus,
  withTimeoutEffect,
  buildDetectedMediaFromMessage,
  buildServerItemUrl,
} from './service-worker-helpers.js';

// ---------------------------------------------------------------------------
// Message router — boundary layer
// ---------------------------------------------------------------------------

/**
 * Service worker message handler.
 * Routes messages from content scripts and popup to appropriate handlers.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const program = handleMessage(message);
  Effect.runPromise(program)
    .then(sendResponse)
    .catch((err: Error) => {
      sendResponse({ type: 'ERROR', payload: { message: err.message } });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Route incoming messages to the correct handler.
 * Uses Effect `Match` for exhaustive message-type routing.
 */
const handleMessage = (
  message:
    | CheckMediaMessage
    | RequestMediaMessage
    | SearchJellyseerrMessage
    | SaveConfigMessage
    | OpenTabMessage
    | { type: string },
): Effect.Effect<unknown> =>
  Match.value(message.type).pipe(
    Match.when('CHECK_MEDIA', () => handleCheckMedia(message as CheckMediaMessage)),
    Match.when('REQUEST_MEDIA', () => handleRequestMedia(message as RequestMediaMessage)),
    Match.when('SEARCH_JELLYSEERR', () =>
      handleSearchJellyseerr(message as SearchJellyseerrMessage),
    ),
    Match.when('SAVE_CONFIG', () => handleSaveConfig(message as SaveConfigMessage)),
    Match.when('GET_CONFIG', () => handleGetConfig()),
    Match.when('TEST_CONNECTION', () => handleTestConnection()),
    Match.when('TEST_JELLYSEERR', () => handleTestJellyseerr()),
    Match.when('OPEN_TAB', () => handleOpenTab(message as OpenTabMessage)),
    Match.orElse((type) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: `Unknown message type: ${type}` },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: CHECK_MEDIA
// ---------------------------------------------------------------------------

/**
 * Check if media exists on the configured server.
 */
const handleCheckMedia = (message: CheckMediaMessage): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;
    const media = buildDetectedMediaFromMessage(message.payload);
    const availability = yield* checkMediaAvailabilityEffect(config, media);

    if (availability.status === 'available') {
      const itemUrl = buildServerItemUrl(
        config.server.serverType,
        availability.serverUrl,
        availability.item.Id,
        availability.item.ServerId,
      );
      return {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'available',
          serverType: config.server.serverType,
          itemId: availability.item.Id,
          itemUrl,
        },
      };
    }

    if (availability.status === 'partial') {
      const itemUrl = buildServerItemUrl(
        config.server.serverType,
        availability.serverUrl,
        availability.item.Id,
        availability.item.ServerId,
      );
      return {
        type: 'CHECK_MEDIA_RESPONSE',
        payload: {
          status: 'partial',
          serverType: config.server.serverType,
          itemId: availability.item.Id,
          itemUrl,
          details: availability.details,
        },
      };
    }

    return {
      type: 'CHECK_MEDIA_RESPONSE',
      payload: {
        status: availability.status,
        serverType: config.server.serverType,
      },
    };
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: REQUEST_MEDIA
// ---------------------------------------------------------------------------

/**
 * Request media via Jellyseerr.
 */
const handleRequestMedia = (message: RequestMediaMessage): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;

    if (!config.jellyseerr.enabled) {
      return {
        type: 'REQUEST_MEDIA_RESPONSE',
        payload: { success: false, message: 'Jellyseerr is not enabled' },
      };
    }

    const resolvedJellyseerrUrl = yield* resolveJellyseerrUrlEffect(config).pipe(
      Effect.catchAll(() => Effect.succeed(config.jellyseerr.serverUrl)),
    );

    console.log(
      '[Media Connector] handleRequestMedia:',
      '\n  Configured Jellyseerr URL:',
      config.jellyseerr.serverUrl,
      '\n  Local Jellyseerr URL:',
      config.jellyseerr.localServerUrl ?? '(none)',
      '\n  Resolved Jellyseerr URL:',
      resolvedJellyseerrUrl,
      '\n  Title:',
      message.payload.title,
      '\n  TMDb ID:',
      message.payload.tmdbId ?? '(none)',
      '\n  Media Type:',
      message.payload.mediaType,
    );

    return yield* Effect.gen(function* () {
      let tmdbId: number | undefined;

      // Use tmdbId directly if provided (from sidebar flow)
      if (message.payload.tmdbId) {
        tmdbId = parseInt(message.payload.tmdbId, 10);
        console.log('[Media Connector] Using provided tmdbId:', tmdbId);
      }

      // Fallback: search Jellyseerr by title to find the TMDb ID
      if (!tmdbId || Number.isNaN(tmdbId)) {
        console.log('[Media Connector] Searching Jellyseerr for:', message.payload.title);
        const searchResults = yield* jellyseerrSearchEffect(config, message.payload.title);
        const match = searchResults.results.find((r) =>
          message.payload.mediaType === 'movie' ? r.mediaType === 'movie' : r.mediaType === 'tv',
        );

        if (!match) {
          return {
            type: 'REQUEST_MEDIA_RESPONSE',
            payload: {
              success: false,
              message: 'Could not find media on Jellyseerr',
            },
          };
        }
        tmdbId = match.id;
      }

      console.log(
        '[Media Connector] Requesting tmdbId:',
        tmdbId,
        'type:',
        message.payload.mediaType,
      );

      if (message.payload.mediaType === 'movie') {
        yield* requestMovieEffect(config, tmdbId);
      } else {
        yield* requestTvShowEffect(config, tmdbId);
      }

      return {
        type: 'REQUEST_MEDIA_RESPONSE',
        payload: {
          success: true,
          message: `Request submitted successfully to ${resolvedJellyseerrUrl}!`,
        },
      };
    }).pipe(
      Effect.catchAll((e) => {
        const errMsg = 'message' in e ? String(e.message) : String(e);
        const isCsrf = errMsg.toLowerCase().includes('csrf');
        console.error(
          '[Media Connector] Request failed:',
          '\n  Server:',
          resolvedJellyseerrUrl,
          '\n  Error:',
          errMsg,
        );
        if (isCsrf) {
          console.error(
            `[Media Connector] ⚠️ CSRF error! Disable CSRF protection at: ${resolvedJellyseerrUrl}/settings/network`,
          );
        }
        const csrfHint = isCsrf
          ? `\n\n💡 Fix: Go to ${resolvedJellyseerrUrl}/settings/network and disable "Enable CSRF Protection".`
          : '';
        return Effect.succeed({
          type: 'REQUEST_MEDIA_RESPONSE',
          payload: {
            success: false,
            message: `[${resolvedJellyseerrUrl}] ${errMsg}${csrfHint}`,
          },
        });
      }),
    );
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: SAVE_CONFIG
// ---------------------------------------------------------------------------

/**
 * Save configuration from the popup.
 */
const handleSaveConfig = (message: SaveConfigMessage): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config: ExtensionConfig = {
      server: {
        serverType: message.payload.serverType,
        serverUrl: message.payload.serverUrl,
        localServerUrl: message.payload.localServerUrl,
        apiKey: message.payload.apiKey,
      },
      jellyseerr: {
        enabled: message.payload.jellyseerrEnabled,
        serverUrl: message.payload.jellyseerrUrl,
        localServerUrl: message.payload.jellyseerrLocalUrl,
        apiKey: message.payload.jellyseerrApiKey,
      },
    };

    yield* saveConfigEffect(config);
    // Clear URL resolution cache so the new URLs are re-evaluated
    yield* clearResolvedUrlCacheEffect;
    return { type: 'SAVE_CONFIG_RESPONSE', payload: { success: true } };
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: GET_CONFIG
// ---------------------------------------------------------------------------

/**
 * Retrieve stored configuration.
 */
const handleGetConfig = (): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;
    return {
      type: 'GET_CONFIG_RESPONSE',
      payload: {
        serverType: config.server.serverType,
        serverUrl: config.server.serverUrl,
        localServerUrl: config.server.localServerUrl,
        apiKey: config.server.apiKey,
        jellyseerrEnabled: config.jellyseerr.enabled,
        jellyseerrUrl: config.jellyseerr.serverUrl,
        jellyseerrLocalUrl: config.jellyseerr.localServerUrl,
        jellyseerrApiKey: config.jellyseerr.apiKey,
      },
    };
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: TEST_CONNECTION
// ---------------------------------------------------------------------------

/**
 * Test media server connectivity.
 */
const handleTestConnection = (): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;
    const ok = yield* testServerConnectionEffect(config);
    return { type: 'TEST_CONNECTION_RESPONSE', payload: { success: ok } };
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: TEST_JELLYSEERR
// ---------------------------------------------------------------------------

/**
 * Test Jellyseerr connectivity.
 */
const handleTestJellyseerr = (): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;
    const ok = yield* testJellyseerrConnectionEffect(config);
    return { type: 'TEST_JELLYSEERR_RESPONSE', payload: { success: ok } };
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: SEARCH_JELLYSEERR
// ---------------------------------------------------------------------------

/**
 * Search Jellyseerr and return enriched results with availability info.
 */
const handleSearchJellyseerr = (message: SearchJellyseerrMessage): Effect.Effect<unknown> =>
  Effect.gen(function* () {
    const config = yield* loadConfigEffect;

    if (!config.jellyseerr.enabled) {
      return {
        type: 'SEARCH_JELLYSEERR_RESPONSE',
        payload: {
          results: [],
          jellyseerrEnabled: false,
          serverType: config.server.serverType,
          error: 'Jellyseerr is not enabled. Configure it in the extension popup.',
        },
      };
    }

    return yield* Effect.gen(function* () {
      const searchResults = yield* jellyseerrSearchEffect(config, message.payload.query);

      // Filter by mediaType if specified
      let filtered = searchResults.results;
      if (message.payload.mediaType) {
        filtered = filtered.filter((r) => r.mediaType === message.payload.mediaType);
      }

      // If a year was provided, prefer the result matching that year.
      if (message.payload.year) {
        const targetYear = message.payload.year;
        const yearMatched = filtered.filter((r) => {
          const dateStr = r.releaseDate ?? r.firstAirDate;
          const resultYear = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;
          return resultYear === targetYear;
        });
        if (yearMatched.length > 0) {
          filtered = yearMatched;
        }
      }

      // Build the item URL base
      const serverUrl = config.server.serverUrl;
      const jellyseerrUrl = config.jellyseerr.serverUrl;

      // Resolve the server URL once up-front (avoids repeated probing in the loop)
      const serverConfigured = !!(config.server.serverUrl && config.server.apiKey);
      let resolvedUrl: string | undefined;
      if (serverConfigured) {
        resolvedUrl = yield* withTimeoutEffect(resolveServerUrlEffect(config), 4000);
      }

      const results = yield* Effect.forEach(
        filtered.slice(0, 5),
        (r) =>
          Effect.gen(function* () {
            const title = r.title ?? r.name ?? 'Unknown';
            const dateStr = r.releaseDate ?? r.firstAirDate;
            const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;
            const posterUrl = r.posterPath
              ? `https://image.tmdb.org/t/p/w185${r.posterPath}`
              : undefined;
            const status = mapMediaStatus(r.mediaInfo?.status);

            // For available/partial items, look up the actual server item URL
            let serverItemUrl: string | undefined;
            if (
              (status === 'available' || status === 'partial') &&
              serverConfigured &&
              resolvedUrl
            ) {
              const lookupResult = yield* Effect.gen(function* () {
                const tmdbId = String(r.id);
                console.log(
                  '[Media Connector] Looking up server item for TMDb ID:',
                  tmdbId,
                  'resolvedUrl:',
                  resolvedUrl,
                );
                const itemType = r.mediaType === 'movie' ? 'Movie' : 'Series';
                const serverResults = yield* withTimeoutEffect(
                  searchByProviderIdEffect(config, tmdbId, 'Tmdb', itemType as 'Movie' | 'Series'),
                  5000,
                );
                console.log(
                  '[Media Connector] Server lookup results:',
                  JSON.stringify(serverResults),
                );
                const match = serverResults?.Items?.[0];
                if (match) {
                  const url = buildServerItemUrl(
                    config.server.serverType,
                    resolvedUrl!,
                    match.Id,
                    match.ServerId,
                  );
                  console.log('[Media Connector] Built serverItemUrl:', url);
                  return url;
                }
                console.warn(
                  '[Media Connector] No matching server item found for TMDb ID:',
                  tmdbId,
                );
                return undefined;
              }).pipe(
                Effect.catchAll((e) => {
                  console.warn('[Media Connector] Could not resolve server item URL:', e);
                  return Effect.succeed(undefined);
                }),
              );
              serverItemUrl = lookupResult;
            } else {
              console.log(
                '[Media Connector] Skipping server item lookup — status:',
                status,
                'serverConfigured:',
                serverConfigured,
                'resolvedUrl:',
                resolvedUrl,
              );
            }

            return {
              id: r.id,
              title,
              year: Number.isNaN(year) ? undefined : year,
              mediaType: r.mediaType,
              overview: r.overview,
              posterUrl,
              status,
              serverUrl,
              serverItemUrl,
            };
          }),
        { concurrency: 'unbounded' },
      );

      return {
        type: 'SEARCH_JELLYSEERR_RESPONSE',
        payload: {
          results,
          jellyseerrEnabled: true,
          serverType: config.server.serverType,
          jellyseerrUrl,
          serverUrl,
        },
      };
    }).pipe(
      Effect.catchAll((e) => {
        const errMsg = 'message' in e ? String(e.message) : String(e);
        return Effect.succeed({
          type: 'SEARCH_JELLYSEERR_RESPONSE',
          payload: {
            results: [],
            jellyseerrEnabled: true,
            serverType: config.server.serverType,
            error: errMsg,
          },
        });
      }),
    );
  }).pipe(
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: 'message' in e ? String(e.message) : String(e) },
      }),
    ),
  );

// ---------------------------------------------------------------------------
// Handler: OPEN_TAB
// ---------------------------------------------------------------------------

/**
 * Open a URL in a new tab via the service worker.
 */
const handleOpenTab = (message: OpenTabMessage): Effect.Effect<unknown> =>
  Effect.tryPromise({
    try: () => chrome.tabs.create({ url: message.payload.url }),
    catch: () => new Error('Failed to open tab'),
  }).pipe(
    Effect.map(() => ({ type: 'OPEN_TAB_RESPONSE', payload: { success: true } })),
    Effect.catchAll((e) =>
      Effect.succeed({
        type: 'ERROR',
        payload: { message: e instanceof Error ? e.message : String(e) },
      }),
    ),
  );

// Log service worker activation
console.log('[Media Server Connector] Service worker activated');
