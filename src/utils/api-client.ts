import type {
  ExtensionConfig,
  MediaServerItem,
  MediaSearchResult,
  DetectedMedia,
  MediaAvailability,
} from "../types/index.js";
import { resolveServerUrl } from "./url-resolver.js";

/**
 * Build API headers for the configured media server.
 * @param config - Extension configuration
 * @returns Headers object for fetch requests
 */
export const buildApiHeaders = (
  config: ExtensionConfig,
): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (config.server.serverType === "emby") {
    headers["X-Emby-Token"] = config.server.apiKey;
  } else {
    headers["Authorization"] = `MediaBrowser Token="${config.server.apiKey}"`;
  }

  return headers;
};

/**
 * Resolve the best base URL for API requests.
 * Prefers local URL when reachable, falls back to public URL.
 * @param config - Extension configuration
 * @returns Resolved base URL
 */
const getResolvedBaseUrl = async (config: ExtensionConfig): Promise<string> =>
  resolveServerUrl(config);

/**
 * Search for a media item on the configured server.
 * @param config - Extension configuration
 * @param query - Search query string
 * @param type - Media type filter
 * @returns Search results from the server
 */
export const searchMedia = async (
  config: ExtensionConfig,
  query: string,
  type?: "Movie" | "Series" | "Season" | "Episode",
): Promise<MediaSearchResult> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const params = new URLSearchParams({
    SearchTerm: query,
    Recursive: "true",
    Limit: "10",
  });

  if (type) {
    params.set("IncludeItemTypes", type);
  }

  const response = await fetch(`${baseUrl}/Items?${params.toString()}`, {
    headers: buildApiHeaders(config),
  });

  if (!response.ok) {
    throw new Error(
      `Server responded with ${response.status}: ${response.statusText}`,
    );
  }

  return response.json() as Promise<MediaSearchResult>;
};

/**
 * Search for media by external provider ID (IMDb, TMDb).
 * @param config - Extension configuration
 * @param providerId - The provider ID value (e.g., tt1234567)
 * @param providerName - The provider name (e.g., 'Imdb', 'Tmdb')
 * @returns Matching items from the server
 */
export const searchByProviderId = async (
  config: ExtensionConfig,
  providerId: string,
  providerName: "Imdb" | "Tmdb",
  includeItemTypes?: string,
): Promise<MediaSearchResult> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const params = new URLSearchParams({
    Recursive: "true",
  });

  if (includeItemTypes) {
    params.set("IncludeItemTypes", includeItemTypes);
  }

  if (config.server.serverType === "emby") {
    // Emby uses AnyProviderIdEquals with format "prov.id"
    // e.g. "Tmdb.419946" or "Imdb.tt1234567"
    params.set("AnyProviderIdEquals", `${providerName}.${providerId}`);
  } else {
    // Jellyfin uses AnyTmdbId / AnyImdbId
    params.set(`Any${providerName}Id`, providerId);
  }

  const response = await fetch(`${baseUrl}/Items?${params.toString()}`, {
    headers: buildApiHeaders(config),
  });

  if (!response.ok) {
    throw new Error(
      `Server responded with ${response.status}: ${response.statusText}`,
    );
  }

  return response.json() as Promise<MediaSearchResult>;
};

/**
 * Get seasons for a series.
 * @param config - Extension configuration
 * @param seriesId - The series item ID
 * @returns Seasons in the series
 */
export const getSeasons = async (
  config: ExtensionConfig,
  seriesId: string,
): Promise<MediaSearchResult> => {
  const baseUrl = await getResolvedBaseUrl(config);

  const response = await fetch(`${baseUrl}/Shows/${seriesId}/Seasons`, {
    headers: buildApiHeaders(config),
  });

  if (!response.ok) {
    throw new Error(
      `Server responded with ${response.status}: ${response.statusText}`,
    );
  }

  return response.json() as Promise<MediaSearchResult>;
};

/**
 * Get episodes for a series, optionally filtering by season.
 * @param config - Extension configuration
 * @param seriesId - The series item ID
 * @param seasonNumber - Optional season number filter
 * @returns Episodes in the series/season
 */
export const getEpisodes = async (
  config: ExtensionConfig,
  seriesId: string,
  seasonNumber?: number,
): Promise<MediaSearchResult> => {
  const baseUrl = await getResolvedBaseUrl(config);
  const params = new URLSearchParams();

  if (seasonNumber !== undefined) {
    params.set("Season", seasonNumber.toString());
  }

  const response = await fetch(
    `${baseUrl}/Shows/${seriesId}/Episodes?${params.toString()}`,
    { headers: buildApiHeaders(config) },
  );

  if (!response.ok) {
    throw new Error(
      `Server responded with ${response.status}: ${response.statusText}`,
    );
  }

  return response.json() as Promise<MediaSearchResult>;
};

/**
 * Verify connectivity to the media server.
 * @param config - Extension configuration
 * @returns True if server is reachable and credentials are valid
 */
export const testServerConnection = async (
  config: ExtensionConfig,
): Promise<boolean> => {
  try {
    const baseUrl = await getResolvedBaseUrl(config);
    const response = await fetch(`${baseUrl}/System/Info/Public`, {
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Check media availability on the server.
 * Handles movies, series, seasons, and episodes.
 * @param config - Extension configuration
 * @param media - Detected media from the current page
 * @returns Availability status with item details if found
 */
export const checkMediaAvailability = async (
  config: ExtensionConfig,
  media: DetectedMedia,
): Promise<MediaAvailability> => {
  if (!config.server.serverUrl || !config.server.apiKey) {
    return { status: "unconfigured" };
  }

  try {
    let results: MediaSearchResult;

    // Try IMDb ID first (most reliable)
    if (media.imdbId) {
      results = await searchByProviderId(config, media.imdbId, "Imdb");
      if (results.Items.length > 0) {
        return resolveMediaMatch(config, results.Items, media);
      }
    }

    // Try TMDb ID
    if (media.tmdbId) {
      results = await searchByProviderId(config, media.tmdbId, "Tmdb");
      if (results.Items.length > 0) {
        return resolveMediaMatch(config, results.Items, media);
      }
    }

    // Fall back to title search
    const title =
      media.type === "season" || media.type === "episode"
        ? media.seriesTitle
        : media.title;

    const typeMap: Record<string, "Movie" | "Series"> = {
      movie: "Movie",
      series: "Series",
      season: "Series",
      episode: "Series",
    };

    results = await searchMedia(config, title, typeMap[media.type]);

    if (results.Items.length === 0) {
      return { status: "unavailable" };
    }

    return resolveMediaMatch(config, results.Items, media);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { status: "error", message };
  }
};

/**
 * Resolve the best match from search results based on detected media type.
 */
const resolveMediaMatch = async (
  config: ExtensionConfig,
  items: MediaServerItem[],
  media: DetectedMedia,
): Promise<MediaAvailability> => {
  const baseUrl = await getResolvedBaseUrl(config);

  if (media.type === "movie") {
    const match = items.find((i) => i.Type === "Movie") ?? items[0];
    return {
      status: "available",
      item: match,
      serverUrl: baseUrl,
    };
  }

  if (media.type === "series") {
    const match = items.find((i) => i.Type === "Series") ?? items[0];
    return {
      status: "available",
      item: match,
      serverUrl: baseUrl,
    };
  }

  // For season/episode, find the series first
  const series = items.find((i) => i.Type === "Series");
  if (!series) {
    return { status: "unavailable" };
  }

  if (media.type === "season") {
    const seasons = await getSeasons(config, series.Id);
    const season = seasons.Items.find(
      (s) =>
        s.ParentIndexNumber === media.seasonNumber ||
        s.IndexNumber === media.seasonNumber,
    );
    if (season) {
      return { status: "available", item: season, serverUrl: baseUrl };
    }
    return {
      status: "partial",
      item: series,
      serverUrl: baseUrl,
      details: `Season ${media.seasonNumber} not found, but series exists`,
    };
  }

  if (media.type === "episode") {
    const episodes = await getEpisodes(config, series.Id, media.seasonNumber);
    const episode = episodes.Items.find(
      (ep) =>
        ep.IndexNumber === media.episodeNumber &&
        ep.ParentIndexNumber === media.seasonNumber,
    );
    if (episode) {
      return { status: "available", item: episode, serverUrl: baseUrl };
    }
    return {
      status: "partial",
      item: series,
      serverUrl: baseUrl,
      details: `S${media.seasonNumber}E${media.episodeNumber} not found, but series exists`,
    };
  }

  return { status: "unavailable" };
};
