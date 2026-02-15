import { Effect, Layer } from 'effect';
import type { ExtensionConfig } from '../types/index.js';
import { NetworkError } from '../types/errors.js';
import { UrlResolverService } from '../services/index.js';

/**
 * Cached resolved URL and its expiry timestamp.
 * Avoids re-probing the local URL on every request.
 */
interface ResolvedUrlCache {
  readonly url: string;
  readonly isLocal: boolean;
  readonly expiresAt: number;
}

/** Cache TTL in milliseconds (5 minutes). */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Timeout for local URL reachability probe in milliseconds. */
const LOCAL_PROBE_TIMEOUT_MS = 3000;

/** In-memory cache keyed by `localUrl|publicUrl`. */
const resolvedCache = new Map<string, ResolvedUrlCache>();

/**
 * Build a cache key from the two URL candidates.
 */
const buildCacheKey = (localUrl: string, publicUrl: string): string => `${localUrl}|${publicUrl}`;

// ---------------------------------------------------------------------------
// Effect-based implementations
// ---------------------------------------------------------------------------

/**
 * Probe whether a URL is reachable by hitting a health-check endpoint.
 * Returns an `Effect<boolean>` that never fails — unreachable → `false`.
 */
export const probeServerUrlEffect = (
  url: string,
  probePath = '/System/Info/Public',
  timeoutMs = LOCAL_PROBE_TIMEOUT_MS,
): Effect.Effect<boolean> =>
  Effect.tryPromise({
    try: async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const baseUrl = url.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}${probePath}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        });
        return response.ok;
      } finally {
        clearTimeout(timer);
      }
    },
    catch: () => false as never, // never reached — we handle below
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));

/**
 * Resolve the best URL from a local/public pair.
 * Prefers the local/LAN URL when reachable, falling back to the public URL.
 */
const resolveUrlEffect = (
  localUrl: string,
  publicUrl: string,
  probePath: string,
): Effect.Effect<string, NetworkError> =>
  Effect.gen(function* () {
    const cleanPublic = publicUrl.replace(/\/$/, '');
    const cleanLocal = localUrl.replace(/\/$/, '');

    if (!cleanLocal) return cleanPublic;

    const cacheKey = buildCacheKey(cleanLocal, cleanPublic);
    const cached = resolvedCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    const localReachable = yield* probeServerUrlEffect(cleanLocal, probePath);

    const resolved: ResolvedUrlCache = {
      url: localReachable ? cleanLocal : cleanPublic,
      isLocal: localReachable,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    resolvedCache.set(cacheKey, resolved);
    return resolved.url;
  });

/**
 * Resolve the best media server URL to use.
 */
export const resolveServerUrlEffect = (
  config: ExtensionConfig,
): Effect.Effect<string, NetworkError> =>
  resolveUrlEffect(
    config.server.localServerUrl ?? '',
    config.server.serverUrl,
    '/System/Info/Public',
  );

/**
 * Resolve the best Jellyseerr URL to use.
 */
export const resolveJellyseerrUrlEffect = (
  config: ExtensionConfig,
): Effect.Effect<string, NetworkError> =>
  resolveUrlEffect(
    config.jellyseerr.localServerUrl ?? '',
    config.jellyseerr.serverUrl,
    '/api/v1/status',
  );

/**
 * Clear the resolved URL cache.
 */
export const clearResolvedUrlCacheEffect: Effect.Effect<void> = Effect.sync(() => {
  resolvedCache.clear();
});

/**
 * Check if the currently cached resolution is using the local URL.
 */
export const isUsingLocalUrlPure = (localUrl: string, publicUrl: string): boolean => {
  const cleanLocal = localUrl.replace(/\/$/, '');
  const cleanPublic = publicUrl.replace(/\/$/, '');

  if (!cleanLocal) return false;

  const cacheKey = buildCacheKey(cleanLocal, cleanPublic);
  const cached = resolvedCache.get(cacheKey);

  return cached?.isLocal ?? false;
};

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const UrlResolverLive = Layer.succeed(
  UrlResolverService,
  UrlResolverService.of({
    resolveServerUrl: resolveServerUrlEffect,
    resolveJellyseerrUrl: resolveJellyseerrUrlEffect,
    probeServerUrl: probeServerUrlEffect,
    clearCache: clearResolvedUrlCacheEffect,
    isUsingLocalUrl: isUsingLocalUrlPure,
  }),
);

// ---------------------------------------------------------------------------
// Legacy async wrappers (used by existing code / Lit components)
// ---------------------------------------------------------------------------

/** @deprecated Use `probeServerUrlEffect` */
export const probeServerUrl = async (
  url: string,
  probePath = '/System/Info/Public',
  timeoutMs = LOCAL_PROBE_TIMEOUT_MS,
): Promise<boolean> => Effect.runPromise(probeServerUrlEffect(url, probePath, timeoutMs));

/** @deprecated Use `resolveServerUrlEffect` */
export const resolveServerUrl = async (config: ExtensionConfig): Promise<string> =>
  Effect.runPromise(resolveServerUrlEffect(config));

/** @deprecated Use `resolveJellyseerrUrlEffect` */
export const resolveJellyseerrUrl = async (config: ExtensionConfig): Promise<string> =>
  Effect.runPromise(resolveJellyseerrUrlEffect(config));

/** @deprecated Use `clearResolvedUrlCacheEffect` */
export const clearResolvedUrlCache = (): void => {
  resolvedCache.clear();
};

/** @deprecated Use `isUsingLocalUrlPure` */
export const isUsingLocalUrl = isUsingLocalUrlPure;
