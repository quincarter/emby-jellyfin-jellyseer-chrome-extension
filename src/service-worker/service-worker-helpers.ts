/**
 * Pure helper functions extracted from the service worker for testability.
 * These have no dependency on chrome.* APIs.
 */
import { Effect, Match } from 'effect';
import type { DetectedMedia, ExtensionConfig } from '../types/index.js';
import type { CheckMediaMessage } from '../types/messages.js';
import { TimeoutError } from '../types/errors.js';

// ---------------------------------------------------------------------------
// Media status mapping
// ---------------------------------------------------------------------------

/** Readable Jellyseerr media status. */
export type JellyseerrMediaStatus =
  | 'available'
  | 'partial'
  | 'pending'
  | 'processing'
  | 'unknown'
  | 'not_requested';

/**
 * Map Jellyseerr numeric media status to a human-readable string.
 * Uses Effect `Match` for exhaustive pattern matching on the known status codes.
 */
export const mapMediaStatus = (status: number | undefined): JellyseerrMediaStatus =>
  Match.value(status).pipe(
    Match.when(5, () => 'available' as const),
    Match.when(4, () => 'partial' as const),
    Match.when(3, () => 'processing' as const),
    Match.when(2, () => 'pending' as const),
    Match.when(1, () => 'unknown' as const),
    Match.orElse(() => 'not_requested' as const),
  );

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

/**
 * Race a promise against a timeout.
 * Returns undefined if the timeout fires first.
 *
 * @deprecated Prefer `withTimeoutEffect` for new code.
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);

/**
 * Race an Effect program against a timeout.
 * Returns `undefined` on timeout instead of failing.
 */
export const withTimeoutEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ms: number,
): Effect.Effect<A | undefined, E, R> =>
  effect.pipe(
    Effect.timeoutTo({
      duration: `${ms} millis`,
      onSuccess: (a): A | undefined => a,
      onTimeout: (): A | undefined => undefined,
    }),
  );

/**
 * Race an Effect program against a timeout.
 * Fails with `TimeoutError` if the timeout fires first.
 */
export const withTimeoutFailEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  ms: number,
  operation: string,
): Effect.Effect<A, E | TimeoutError, R> =>
  effect.pipe(
    Effect.timeoutFail({
      duration: `${ms} millis`,
      onTimeout: () => new TimeoutError({ ms, operation }),
    }),
  );

// ---------------------------------------------------------------------------
// Message → DetectedMedia builder
// ---------------------------------------------------------------------------

/**
 * Build a DetectedMedia object from a CHECK_MEDIA message payload.
 * Uses Effect `Match` for exhaustive, type-safe pattern matching.
 */
export const buildDetectedMediaFromMessage = (
  payload: CheckMediaMessage['payload'],
): DetectedMedia =>
  Match.value(payload).pipe(
    Match.when({ mediaType: 'movie' }, (p) => ({
      type: 'movie' as const,
      title: p.title,
      year: p.year,
      imdbId: p.imdbId,
      tmdbId: p.tmdbId,
    })),
    Match.when({ mediaType: 'series' }, (p) => ({
      type: 'series' as const,
      title: p.title,
      year: p.year,
      imdbId: p.imdbId,
      tmdbId: p.tmdbId,
    })),
    Match.when({ mediaType: 'season' }, (p) => ({
      type: 'season' as const,
      seriesTitle: p.title,
      seasonNumber: p.seasonNumber ?? 1,
      imdbId: p.imdbId,
      tmdbId: p.tmdbId,
    })),
    Match.when({ mediaType: 'episode' }, (p) => ({
      type: 'episode' as const,
      seriesTitle: p.title,
      seasonNumber: p.seasonNumber ?? 1,
      episodeNumber: p.episodeNumber ?? 1,
      imdbId: p.imdbId,
      tmdbId: p.tmdbId,
    })),
    Match.exhaustive,
  );

// ---------------------------------------------------------------------------
// Server item URL builder
// ---------------------------------------------------------------------------

/**
 * Build a media server item URL from config and item details.
 */
export const buildServerItemUrl = (
  serverType: ExtensionConfig['server']['serverType'],
  serverUrl: string,
  itemId: string,
  serverId?: string,
): string => {
  const serverIdParam = serverId ? `&serverId=${serverId}` : '';
  return Match.value(serverType).pipe(
    Match.when('jellyfin', () => `${serverUrl}/web/#/details?id=${itemId}${serverIdParam}`),
    Match.orElse(() => `${serverUrl}/web/index.html#!/item?id=${itemId}${serverIdParam}`),
  );
};
