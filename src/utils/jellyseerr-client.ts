import type { ExtensionConfig } from "../types/index.js";
import { resolveJellyseerrUrl } from "./url-resolver.js";

/**
 * Build Jellyseerr API headers.
 * @param config - Extension configuration
 * @returns Headers for Jellyseerr API requests
 */
const buildJellyseerrHeaders = (
  config: ExtensionConfig,
): Record<string, string> => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-Api-Key": config.jellyseerr.apiKey,
});

/**
 * Resolve the best Jellyseerr base URL.
 * Prefers local URL when reachable, falls back to public URL.
 */
const getResolvedBaseUrl = async (config: ExtensionConfig): Promise<string> =>
  resolveJellyseerrUrl(config);

/**
 * Fetch the CSRF token from Jellyseerr.
 *
 * Jellyseerr uses `csurf` middleware. The flow is:
 *  1. Make a GET request with `credentials: "include"` to set the
 *     `XSRF-TOKEN` cookie in the browser.
 *  2. Read the cookie via `chrome.cookies.get()`.
 *  3. Return the decoded value to include as `x-xsrf-token` header.
 */
const fetchCsrfToken = async (
  baseUrl: string,
  headers: Record<string, string>,
): Promise<string | undefined> => {
  // 1) Hit a GET endpoint so the server sets the XSRF-TOKEN cookie.
  console.log("[Media Connector] CSRF: fetching token via GET", baseUrl);
  try {
    const res = await fetch(`${baseUrl}/api/v1/status`, {
      headers,
      credentials: "include",
    });
    console.log("[Media Connector] CSRF: GET /status response:", res.status);

    // Try reading token from Set-Cookie via getSetCookie() (Chrome 113+)
    if (typeof res.headers.getSetCookie === "function") {
      const setCookies = res.headers.getSetCookie();
      console.log("[Media Connector] CSRF: Set-Cookie headers:", setCookies);
      for (const sc of setCookies) {
        const xsrfMatch = sc.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) {
          console.log("[Media Connector] CSRF: token from Set-Cookie header");
          return decodeURIComponent(xsrfMatch[1]);
        }
      }
    }
  } catch (e) {
    console.warn("[Media Connector] CSRF: GET /status failed:", e);
  }

  // 2) Read the cookie via chrome.cookies API.
  if (typeof chrome !== "undefined" && chrome.cookies) {
    console.log("[Media Connector] CSRF: trying chrome.cookies for", baseUrl);
    const cookieNames = ["XSRF-TOKEN", "_csrf"];
    for (const name of cookieNames) {
      try {
        const cookie = await chrome.cookies.get({ url: baseUrl, name });
        console.log(
          `[Media Connector] CSRF: chrome.cookies.get(${name}):`,
          cookie,
        );
        if (cookie?.value) {
          console.log(
            `[Media Connector] CSRF: token obtained via chrome.cookies (${name})`,
          );
          return decodeURIComponent(cookie.value);
        }
      } catch (e) {
        console.warn(
          `[Media Connector] CSRF: chrome.cookies.get(${name}) error:`,
          e,
        );
      }
    }

    // Also list ALL cookies for the domain to debug
    try {
      const url = new URL(baseUrl);
      const allCookies = await chrome.cookies.getAll({ domain: url.hostname });
      console.log(
        "[Media Connector] CSRF: all cookies for domain:",
        allCookies.map((c) => `${c.name}=${c.value.slice(0, 20)}...`),
      );
    } catch (e) {
      console.warn("[Media Connector] CSRF: getAll cookies error:", e);
    }
  } else {
    console.warn("[Media Connector] CSRF: chrome.cookies API not available");
  }

  console.warn("[Media Connector] CSRF: could not obtain token");
  return undefined;
};

/**
 * Build headers for a POST/PUT/DELETE request, including the CSRF token.
 */
const buildMutationHeaders = async (
  config: ExtensionConfig,
): Promise<Record<string, string>> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const headers = buildJellyseerrHeaders(config);
  const csrf = await fetchCsrfToken(baseUrl, headers);
  if (csrf) {
    headers["x-xsrf-token"] = csrf;
  }
  return headers;
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
    throw new Error("Search query is empty");
  }

  const url = `${baseUrl}/api/v1/search?query=${encodeURIComponent(trimmed)}&page=1&language=en`;
  console.log("[Media Connector] Jellyseerr search URL:", url);

  const response = await fetch(url, {
    headers: buildJellyseerrHeaders(config),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    console.error(
      `[Media Connector] Jellyseerr search failed: ${response.status}`,
      body,
    );
    throw new Error(
      `Jellyseerr responded with ${response.status}: ${body.slice(0, 200)}`,
    );
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
  const headers = await buildMutationHeaders(config);

  const response = await fetch(`${baseUrl}/api/v1/request`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      mediaType: "movie",
      mediaId: tmdbId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jellyseerr request failed: ${errorBody}`);
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
    mediaType: "tv",
    mediaId: tmdbId,
  };

  if (seasons && seasons.length > 0) {
    body["seasons"] = seasons;
  }

  const headers = await buildMutationHeaders(config);

  const response = await fetch(`${baseUrl}/api/v1/request`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Jellyseerr request failed: ${errorBody}`);
  }

  return response.json() as Promise<JellyseerrRequestResult>;
};

/**
 * Test Jellyseerr server connectivity.
 * @param config - Extension configuration
 * @returns True if reachable
 */
export const testJellyseerrConnection = async (
  config: ExtensionConfig,
): Promise<boolean> => {
  try {
    const baseUrl = await getResolvedBaseUrl(config);
    const response = await fetch(`${baseUrl}/api/v1/status`, {
      headers: buildJellyseerrHeaders(config),
    });
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
  readonly mediaType: "movie" | "tv";
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
