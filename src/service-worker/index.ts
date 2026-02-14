import { loadConfig, saveConfig } from "../utils/storage.js";
import {
  checkMediaAvailability,
  searchByProviderId,
  testServerConnection,
} from "../utils/api-client.js";
import {
  clearResolvedUrlCache,
  resolveServerUrl,
} from "../utils/url-resolver.js";
import {
  testJellyseerrConnection,
  jellyseerrSearch,
  requestMovie,
  requestTvShow,
} from "../utils/jellyseerr-client.js";
import type { DetectedMedia, ExtensionConfig } from "../types/index.js";
import type {
  CheckMediaMessage,
  RequestMediaMessage,
  SearchJellyseerrMessage,
  SaveConfigMessage,
} from "../types/messages.js";

/**
 * Service worker message handler.
 * Routes messages from content scripts and popup to appropriate handlers.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: Error) => {
      sendResponse({ type: "ERROR", payload: { message: err.message } });
    });

  // Return true to indicate async response
  return true;
});

/**
 * Route incoming messages to the correct handler.
 */
const handleMessage = async (
  message:
    | CheckMediaMessage
    | RequestMediaMessage
    | SearchJellyseerrMessage
    | SaveConfigMessage
    | { type: string },
): Promise<unknown> => {
  switch (message.type) {
    case "CHECK_MEDIA":
      return handleCheckMedia(message as CheckMediaMessage);

    case "REQUEST_MEDIA":
      return handleRequestMedia(message as RequestMediaMessage);

    case "SEARCH_JELLYSEERR":
      return handleSearchJellyseerr(message as SearchJellyseerrMessage);

    case "SAVE_CONFIG":
      return handleSaveConfig(message as SaveConfigMessage);

    case "GET_CONFIG":
      return handleGetConfig();

    case "TEST_CONNECTION":
      return handleTestConnection();

    case "TEST_JELLYSEERR":
      return handleTestJellyseerr();

    default:
      return {
        type: "ERROR",
        payload: { message: `Unknown message type: ${message.type}` },
      };
  }
};

/**
 * Check if media exists on the configured server.
 */
const handleCheckMedia = async (message: CheckMediaMessage) => {
  const config = await loadConfig();

  const media: DetectedMedia =
    message.payload.mediaType === "movie"
      ? {
          type: "movie",
          title: message.payload.title,
          year: message.payload.year,
          imdbId: message.payload.imdbId,
          tmdbId: message.payload.tmdbId,
        }
      : message.payload.mediaType === "series"
        ? {
            type: "series",
            title: message.payload.title,
            year: message.payload.year,
            imdbId: message.payload.imdbId,
            tmdbId: message.payload.tmdbId,
          }
        : message.payload.mediaType === "season"
          ? {
              type: "season",
              seriesTitle: message.payload.title,
              seasonNumber: message.payload.seasonNumber ?? 1,
              year: message.payload.year,
              imdbId: message.payload.imdbId,
              tmdbId: message.payload.tmdbId,
            }
          : {
              type: "episode",
              seriesTitle: message.payload.title,
              seasonNumber: message.payload.seasonNumber ?? 1,
              episodeNumber: message.payload.episodeNumber ?? 1,
              year: message.payload.year,
              imdbId: message.payload.imdbId,
              tmdbId: message.payload.tmdbId,
            };

  const availability = await checkMediaAvailability(config, media);

  if (availability.status === "available") {
    const serverIdParam = availability.item.ServerId
      ? `&serverId=${availability.item.ServerId}`
      : "";
    const itemUrl =
      config.server.serverType === "jellyfin"
        ? `${availability.serverUrl}/web/#/details?id=${availability.item.Id}${serverIdParam}`
        : `${availability.serverUrl}/web/index.html#!/item?id=${availability.item.Id}${serverIdParam}`;

    return {
      type: "CHECK_MEDIA_RESPONSE",
      payload: {
        status: "available",
        serverType: config.server.serverType,
        itemId: availability.item.Id,
        itemUrl,
      },
    };
  }

  if (availability.status === "partial") {
    const serverIdParam = availability.item.ServerId
      ? `&serverId=${availability.item.ServerId}`
      : "";
    const itemUrl =
      config.server.serverType === "jellyfin"
        ? `${availability.serverUrl}/web/#/details?id=${availability.item.Id}${serverIdParam}`
        : `${availability.serverUrl}/web/index.html#!/item?id=${availability.item.Id}${serverIdParam}`;

    return {
      type: "CHECK_MEDIA_RESPONSE",
      payload: {
        status: "partial",
        serverType: config.server.serverType,
        itemId: availability.item.Id,
        itemUrl,
        details: availability.details,
      },
    };
  }

  return {
    type: "CHECK_MEDIA_RESPONSE",
    payload: {
      status: availability.status,
      serverType: config.server.serverType,
    },
  };
};

/**
 * Request media via Jellyseerr.
 */
const handleRequestMedia = async (message: RequestMediaMessage) => {
  const config = await loadConfig();

  if (!config.jellyseerr.enabled) {
    return {
      type: "REQUEST_MEDIA_RESPONSE",
      payload: { success: false, message: "Jellyseerr is not enabled" },
    };
  }

  try {
    let tmdbId: number | undefined;

    // Use tmdbId directly if provided (from sidebar flow)
    if (message.payload.tmdbId) {
      tmdbId = parseInt(message.payload.tmdbId, 10);
      console.log("[Media Connector] Using provided tmdbId:", tmdbId);
    }

    // Fallback: search Jellyseerr by title to find the TMDb ID
    if (!tmdbId || Number.isNaN(tmdbId)) {
      console.log(
        "[Media Connector] Searching Jellyseerr for:",
        message.payload.title,
      );
      const searchResults = await jellyseerrSearch(
        config,
        message.payload.title,
      );
      const match = searchResults.results.find((r) => {
        if (message.payload.mediaType === "movie") {
          return r.mediaType === "movie";
        }
        return r.mediaType === "tv";
      });

      if (!match) {
        return {
          type: "REQUEST_MEDIA_RESPONSE",
          payload: {
            success: false,
            message: "Could not find media on Jellyseerr",
          },
        };
      }
      tmdbId = match.id;
    }

    console.log(
      "[Media Connector] Requesting tmdbId:",
      tmdbId,
      "type:",
      message.payload.mediaType,
    );

    if (message.payload.mediaType === "movie") {
      await requestMovie(config, tmdbId);
    } else {
      await requestTvShow(config, tmdbId);
    }

    return {
      type: "REQUEST_MEDIA_RESPONSE",
      payload: { success: true, message: "Request submitted successfully!" },
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("[Media Connector] Request failed:", errMsg);
    return {
      type: "REQUEST_MEDIA_RESPONSE",
      payload: { success: false, message: errMsg },
    };
  }
};

/**
 * Save configuration from the popup.
 */
const handleSaveConfig = async (message: SaveConfigMessage) => {
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

  await saveConfig(config);
  // Clear URL resolution cache so the new URLs are re-evaluated
  clearResolvedUrlCache();
  return { type: "SAVE_CONFIG_RESPONSE", payload: { success: true } };
};

/**
 * Retrieve stored configuration.
 */
const handleGetConfig = async () => {
  const config = await loadConfig();
  return {
    type: "GET_CONFIG_RESPONSE",
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
};

/**
 * Test media server connectivity.
 */
const handleTestConnection = async () => {
  const config = await loadConfig();
  const ok = await testServerConnection(config);
  return { type: "TEST_CONNECTION_RESPONSE", payload: { success: ok } };
};

/**
 * Test Jellyseerr connectivity.
 */
const handleTestJellyseerr = async () => {
  const config = await loadConfig();
  const ok = await testJellyseerrConnection(config);
  return { type: "TEST_JELLYSEERR_RESPONSE", payload: { success: ok } };
};

/**
 * Map Jellyseerr numeric media status to a human-readable string.
 */
const mapMediaStatus = (
  status: number | undefined,
):
  | "available"
  | "partial"
  | "pending"
  | "processing"
  | "unknown"
  | "not_requested" => {
  switch (status) {
    case 5:
      return "available";
    case 4:
      return "partial";
    case 3:
      return "processing";
    case 2:
      return "pending";
    case 1:
      return "unknown";
    default:
      return "not_requested";
  }
};

/**
 * Race a promise against a timeout.
 * Returns undefined if the timeout fires first.
 */
const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | undefined> =>
  Promise.race([
    promise,
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms),
    ),
  ]);

/**
 * Search Jellyseerr and return enriched results with availability info.
 */
const handleSearchJellyseerr = async (message: SearchJellyseerrMessage) => {
  const config = await loadConfig();

  if (!config.jellyseerr.enabled) {
    return {
      type: "SEARCH_JELLYSEERR_RESPONSE",
      payload: {
        results: [],
        jellyseerrEnabled: false,
        serverType: config.server.serverType,
        error:
          "Jellyseerr is not enabled. Configure it in the extension popup.",
      },
    };
  }

  try {
    const searchResults = await jellyseerrSearch(config, message.payload.query);

    // Filter by mediaType if specified
    let filtered = searchResults.results;
    if (message.payload.mediaType) {
      filtered = filtered.filter(
        (r) => r.mediaType === message.payload.mediaType,
      );
    }

    // Build the item URL base
    const serverUrl = config.server.serverUrl;
    const jellyseerrUrl = config.jellyseerr.serverUrl;

    // Resolve the server URL once up-front (avoids repeated probing in the loop)
    const serverConfigured = !!(
      config.server.serverUrl && config.server.apiKey
    );
    let resolvedUrl: string | undefined;
    if (serverConfigured) {
      resolvedUrl = await withTimeout(resolveServerUrl(config), 4000);
    }

    const results = await Promise.all(
      filtered.slice(0, 5).map(async (r) => {
        const title = r.title ?? r.name ?? "Unknown";
        const dateStr = r.releaseDate ?? r.firstAirDate;
        const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;
        const posterUrl = r.posterPath
          ? `https://image.tmdb.org/t/p/w185${r.posterPath}`
          : undefined;
        const status = mapMediaStatus(r.mediaInfo?.status);

        // For available/partial items, look up the actual server item URL
        let serverItemUrl: string | undefined;
        if (
          (status === "available" || status === "partial") &&
          serverConfigured &&
          resolvedUrl
        ) {
          try {
            const tmdbId = String(r.id);
            const serverResults = await withTimeout(
              searchByProviderId(config, tmdbId, "Tmdb"),
              5000,
            );
            const match = serverResults?.Items[0];
            if (match) {
              const serverIdParam = match.ServerId
                ? `&serverId=${match.ServerId}`
                : "";
              serverItemUrl =
                config.server.serverType === "jellyfin"
                  ? `${resolvedUrl}/web/#/details?id=${match.Id}${serverIdParam}`
                  : `${resolvedUrl}/web/index.html#!/item?id=${match.Id}${serverIdParam}`;
            }
          } catch (e) {
            console.warn(
              "[Media Connector] Could not resolve server item URL:",
              e,
            );
          }
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
    );

    return {
      type: "SEARCH_JELLYSEERR_RESPONSE",
      payload: {
        results,
        jellyseerrEnabled: true,
        serverType: config.server.serverType,
        jellyseerrUrl,
        serverUrl,
      },
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    return {
      type: "SEARCH_JELLYSEERR_RESPONSE",
      payload: {
        results: [],
        jellyseerrEnabled: true,
        serverType: config.server.serverType,
        error: errMsg,
      },
    };
  }
};

// Log service worker activation
console.log("[Media Server Connector] Service worker activated");
