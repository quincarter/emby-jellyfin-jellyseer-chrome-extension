import type { ExtensionConfig } from "../types/index.js";

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
const buildCacheKey = (localUrl: string, publicUrl: string): string =>
  `${localUrl}|${publicUrl}`;

/**
 * Probe whether a URL is reachable by hitting a health-check endpoint.
 * Uses a short timeout to avoid blocking on unreachable local addresses.
 *
 * @param url - The server base URL to probe
 * @param probePath - The path to GET for the health check (default: `/System/Info/Public`)
 * @param timeoutMs - Max time to wait for a response
 * @returns True if the server responded with HTTP 200
 */
export const probeServerUrl = async (
  url: string,
  probePath = "/System/Info/Public",
  timeoutMs = LOCAL_PROBE_TIMEOUT_MS,
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = url.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}${probePath}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Resolve the best URL from a local/public pair.
 * Prefers the local/LAN URL when reachable, falling back to the public URL.
 *
 * Results are cached for {@link CACHE_TTL_MS} to avoid repeatedly probing.
 *
 * @param localUrl - The local/LAN URL
 * @param publicUrl - The public/remote URL
 * @param probePath - The endpoint path used to test reachability
 * @returns The resolved base URL (trailing slash stripped)
 */
const resolveUrl = async (
  localUrl: string,
  publicUrl: string,
  probePath: string,
): Promise<string> => {
  const cleanPublic = publicUrl.replace(/\/$/, "");
  const cleanLocal = localUrl.replace(/\/$/, "");

  if (!cleanLocal) {
    return cleanPublic;
  }

  const cacheKey = buildCacheKey(cleanLocal, cleanPublic);
  const cached = resolvedCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const localReachable = await probeServerUrl(cleanLocal, probePath);

  const resolved: ResolvedUrlCache = {
    url: localReachable ? cleanLocal : cleanPublic,
    isLocal: localReachable,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  resolvedCache.set(cacheKey, resolved);
  return resolved.url;
};

/**
 * Resolve the best media server URL to use.
 * Prefers the local/LAN URL when reachable, falling back to the public URL.
 *
 * @param config - Extension configuration containing both URLs
 * @returns The resolved base URL (trailing slash stripped)
 */
export const resolveServerUrl = async (
  config: ExtensionConfig,
): Promise<string> =>
  resolveUrl(
    config.server.localServerUrl ?? "",
    config.server.serverUrl,
    "/System/Info/Public",
  );

/**
 * Resolve the best Jellyseerr URL to use.
 * Prefers the local/LAN URL when reachable, falling back to the public URL.
 *
 * @param config - Extension configuration containing both URLs
 * @returns The resolved base URL (trailing slash stripped)
 */
export const resolveJellyseerrUrl = async (
  config: ExtensionConfig,
): Promise<string> =>
  resolveUrl(
    config.jellyseerr.localServerUrl ?? "",
    config.jellyseerr.serverUrl,
    "/api/v1/status",
  );

/**
 * Clear the resolved URL cache.
 * Useful when the user changes server settings.
 */
export const clearResolvedUrlCache = (): void => {
  resolvedCache.clear();
};

/**
 * Check if the currently cached resolution is using the local URL.
 * @param localUrl - The local URL to check
 * @param publicUrl - The public URL to check against
 * @returns True if local URL is being used, false if public or no cache
 */
export const isUsingLocalUrl = (
  localUrl: string,
  publicUrl: string,
): boolean => {
  const cleanLocal = localUrl.replace(/\/$/, "");
  const cleanPublic = publicUrl.replace(/\/$/, "");

  if (!cleanLocal) return false;

  const cacheKey = buildCacheKey(cleanLocal, cleanPublic);
  const cached = resolvedCache.get(cacheKey);

  return cached?.isLocal ?? false;
};
