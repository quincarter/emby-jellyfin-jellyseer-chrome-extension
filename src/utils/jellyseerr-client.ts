import type { ExtensionConfig } from '../types/index.js';
import { resolveJellyseerrUrl } from './url-resolver.js';

/**
 * Build Jellyseerr API headers.
 *
 * Jellyseerr supports two authentication methods:
 *  1. Cookie-based session auth (requires CSRF tokens)
 *  2. API Key auth via the `X-Api-Key` header
 *
 * This extension uses **API Key auth exclusively**, which means
 * CSRF tokens are NOT required. The `X-Api-Key` header is sufficient
 * for all GET, POST, PUT, and DELETE requests.
 *
 * @param config - Extension configuration
 * @returns Headers for Jellyseerr API requests
 */
const buildJellyseerrHeaders = (config: ExtensionConfig): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Api-Key': config.jellyseerr.apiKey,
});

/**
 * Resolve the best Jellyseerr base URL.
 * Prefers local URL when reachable, falls back to public URL.
 */
const getResolvedBaseUrl = async (config: ExtensionConfig): Promise<string> =>
  resolveJellyseerrUrl(config);

/**
 * Clear all cookies for a Jellyseerr domain.
 *
 * Jellyseerr uses `csurf` middleware. If the browser (or Chrome extension
 * service worker with host permissions) has any leftover session cookies
 * (`_csrf`, `connect.sid`, `XSRF-TOKEN`, etc.) from a previous browser
 * login, the server's CSRF middleware activates and demands a valid CSRF
 * token — even when the request uses API-Key auth.
 *
 * By clearing all cookies for the domain before mutation requests,
 * the server sees a cookie-less request and skips CSRF validation,
 * relying solely on the `X-Api-Key` header.
 */
const clearJellyseerrCookies = async (baseUrl: string): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.cookies) {
    return;
  }

  try {
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
  } catch (e) {
    console.warn('[Media Connector] Failed to clear cookies:', e);
  }
};

/**
 * Search Jellyseerr for a movie or TV show.
 * @param config - Extension configuration
 * @param query - Search query
 * @returns Jellyseerr search results
 */
export const jellyseerrSearch = async (
  config: ExtensionConfig,
  query: string,
): Promise<JellyseerrSearchResponse> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error('Search query is empty');
  }

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

  const response = await fetch(url, {
    headers: buildJellyseerrHeaders(config),
    credentials: 'omit',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(no body)');
    console.error(`[Media Connector] Jellyseerr search failed: ${response.status}`, body);
    throw new Error(`Jellyseerr responded with ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<JellyseerrSearchResponse>;
};

/**
 * Request a movie via Jellyseerr.
 * @param config - Extension configuration
 * @param tmdbId - TMDb ID of the movie
 * @returns Request result
 */
export const requestMovie = async (
  config: ExtensionConfig,
  tmdbId: number,
): Promise<JellyseerrRequestResult> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const headers = buildJellyseerrHeaders(config);

  // Clear any lingering session cookies so the CSRF middleware
  // doesn't activate — we authenticate via X-Api-Key only.
  await clearJellyseerrCookies(baseUrl);

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

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    credentials: 'omit',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Media Connector] Jellyseerr movie request failed:', response.status, errorBody);
    if (errorBody.toLowerCase().includes('csrf')) {
      console.error(
        `[Media Connector] ⚠️ CSRF error detected! Please disable CSRF protection in your Jellyseerr settings:\n  → ${baseUrl}/settings/network\n  Uncheck "Enable CSRF Protection" and save.`,
      );
    }
    throw new Error(`Jellyseerr request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<JellyseerrRequestResult>;
};

/**
 * Request a TV show via Jellyseerr.
 * @param config - Extension configuration
 * @param tmdbId - TMDb ID of the series
 * @param seasons - Optional specific seasons to request
 * @returns Request result
 */
export const requestTvShow = async (
  config: ExtensionConfig,
  tmdbId: number,
  seasons?: number[],
): Promise<JellyseerrRequestResult> => {
  const baseUrl = await getResolvedBaseUrl(config);

  const body: Record<string, unknown> = {
    mediaType: 'tv',
    mediaId: tmdbId,
  };

  if (seasons && seasons.length > 0) {
    body['seasons'] = seasons;
  }

  const headers = buildJellyseerrHeaders(config);

  // Clear any lingering session cookies so the CSRF middleware
  // doesn't activate — we authenticate via X-Api-Key only.
  await clearJellyseerrCookies(baseUrl);

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

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    credentials: 'omit',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Media Connector] Jellyseerr TV request failed:', response.status, errorBody);
    if (errorBody.toLowerCase().includes('csrf')) {
      console.error(
        `[Media Connector] ⚠️ CSRF error detected! Please disable CSRF protection in your Jellyseerr settings:\n  → ${baseUrl}/settings/network\n  Uncheck "Enable CSRF Protection" and save.`,
      );
    }
    throw new Error(`Jellyseerr request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<JellyseerrRequestResult>;
};

/**
 * Test Jellyseerr server connectivity.
 * @param config - Extension configuration
 * @returns True if reachable
 */
export const testJellyseerrConnection = async (config: ExtensionConfig): Promise<boolean> => {
  try {
    const baseUrl = await getResolvedBaseUrl(config);
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

    const response = await fetch(testUrl, {
      headers: buildJellyseerrHeaders(config),
      credentials: 'omit',
    });

    console.log(
      '[Media Connector] Jellyseerr TEST CONNECTION result:',
      response.status,
      response.ok ? 'OK' : 'FAILED',
    );

    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Jellyseerr search response structure.
 */
export interface JellyseerrSearchResponse {
  readonly page: number;
  readonly totalPages: number;
  readonly totalResults: number;
  readonly results: JellyseerrSearchResult[];
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
