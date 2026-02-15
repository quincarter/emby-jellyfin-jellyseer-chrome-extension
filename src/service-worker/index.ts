import { loadConfig, saveConfig } from '../utils/storage.js';
import {
  checkMediaAvailability,
  searchByProviderId,
  testServerConnection,
} from '../utils/api-client.js';
import { clearResolvedUrlCache, resolveServerUrl } from '../utils/url-resolver.js';
import {
  testJellyseerrConnection,
  jellyseerrSearch,
  requestMovie,
  requestTvShow,
} from '../utils/jellyseerr-client.js';
import { resolveJellyseerrUrl } from '../utils/url-resolver.js';
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
  withTimeout,
  buildDetectedMediaFromMessage,
  buildServerItemUrl,
} from './helpers.js';

/**
 * Service worker message handler.
 * Routes messages from content scripts and popup to appropriate handlers.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: Error) => {
      sendResponse({ type: 'ERROR', payload: { message: err.message } });
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
    case 'CHECK_MEDIA':
      return handleCheckMedia(message as CheckMediaMessage);

    case 'REQUEST_MEDIA':
      return handleRequestMedia(message as RequestMediaMessage);

    case 'SEARCH_JELLYSEERR':
      return handleSearchJellyseerr(message as SearchJellyseerrMessage);

    case 'SAVE_CONFIG':
      return handleSaveConfig(message as SaveConfigMessage);

    case 'GET_CONFIG':
      return handleGetConfig();

    case 'TEST_CONNECTION':
      return handleTestConnection();

    case 'TEST_JELLYSEERR':
      return handleTestJellyseerr();

    case 'OPEN_TAB':
      return handleOpenTab(message as OpenTabMessage);

    default:
      return {
        type: 'ERROR',
        payload: { message: `Unknown message type: ${message.type}` },
      };
  }
};

/**
 * Check if media exists on the configured server.
 */
const handleCheckMedia = async (message: CheckMediaMessage) => {
  const config = await loadConfig();

  const media = buildDetectedMediaFromMessage(message.payload);

  const availability = await checkMediaAvailability(config, media);

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
};

/**
 * Request media via Jellyseerr.
 */
const handleRequestMedia = async (message: RequestMediaMessage) => {
  const config = await loadConfig();

  if (!config.jellyseerr.enabled) {
    return {
      type: 'REQUEST_MEDIA_RESPONSE',
      payload: { success: false, message: 'Jellyseerr is not enabled' },
    };
  }

  // Resolve the Jellyseerr URL up front for logging
  const resolvedJellyseerrUrl = await resolveJellyseerrUrl(config);
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

  try {
    let tmdbId: number | undefined;

    // Use tmdbId directly if provided (from sidebar flow)
    if (message.payload.tmdbId) {
      tmdbId = parseInt(message.payload.tmdbId, 10);
      console.log('[Media Connector] Using provided tmdbId:', tmdbId);
    }

    // Fallback: search Jellyseerr by title to find the TMDb ID
    if (!tmdbId || Number.isNaN(tmdbId)) {
      console.log('[Media Connector] Searching Jellyseerr for:', message.payload.title);
      const searchResults = await jellyseerrSearch(config, message.payload.title);
      const match = searchResults.results.find((r) => {
        if (message.payload.mediaType === 'movie') {
          return r.mediaType === 'movie';
        }
        return r.mediaType === 'tv';
      });

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

    console.log('[Media Connector] Requesting tmdbId:', tmdbId, 'type:', message.payload.mediaType);

    if (message.payload.mediaType === 'movie') {
      await requestMovie(config, tmdbId);
    } else {
      await requestTvShow(config, tmdbId);
    }

    return {
      type: 'REQUEST_MEDIA_RESPONSE',
      payload: {
        success: true,
        message: `Request submitted successfully to ${resolvedJellyseerrUrl}!`,
      },
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
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
    return {
      type: 'REQUEST_MEDIA_RESPONSE',
      payload: {
        success: false,
        message: `[${resolvedJellyseerrUrl}] ${errMsg}${csrfHint}`,
      },
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
  return { type: 'SAVE_CONFIG_RESPONSE', payload: { success: true } };
};

/**
 * Retrieve stored configuration.
 */
const handleGetConfig = async () => {
  const config = await loadConfig();
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
};

/**
 * Test media server connectivity.
 */
const handleTestConnection = async () => {
  const config = await loadConfig();
  const ok = await testServerConnection(config);
  return { type: 'TEST_CONNECTION_RESPONSE', payload: { success: ok } };
};

/**
 * Test Jellyseerr connectivity.
 */
const handleTestJellyseerr = async () => {
  const config = await loadConfig();
  const ok = await testJellyseerrConnection(config);
  return { type: 'TEST_JELLYSEERR_RESPONSE', payload: { success: ok } };
};

/**
 * Search Jellyseerr and return enriched results with availability info.
 */
const handleSearchJellyseerr = async (message: SearchJellyseerrMessage) => {
  const config = await loadConfig();

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

  try {
    const searchResults = await jellyseerrSearch(config, message.payload.query);

    // Filter by mediaType if specified
    let filtered = searchResults.results;
    if (message.payload.mediaType) {
      filtered = filtered.filter((r) => r.mediaType === message.payload.mediaType);
    }

    // If a year was provided, prefer the result matching that year.
    // Fall back to all filtered results if no year match is found.
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
      resolvedUrl = await withTimeout(resolveServerUrl(config), 4000);
    }

    const results = await Promise.all(
      filtered.slice(0, 5).map(async (r) => {
        const title = r.title ?? r.name ?? 'Unknown';
        const dateStr = r.releaseDate ?? r.firstAirDate;
        const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : undefined;
        const posterUrl = r.posterPath
          ? `https://image.tmdb.org/t/p/w185${r.posterPath}`
          : undefined;
        const status = mapMediaStatus(r.mediaInfo?.status);

        // For available/partial items, look up the actual server item URL
        let serverItemUrl: string | undefined;
        if ((status === 'available' || status === 'partial') && serverConfigured && resolvedUrl) {
          try {
            const tmdbId = String(r.id);
            console.log(
              '[Media Connector] Looking up server item for TMDb ID:',
              tmdbId,
              'resolvedUrl:',
              resolvedUrl,
            );
            // Map Jellyseerr mediaType to Emby/Jellyfin item type
            const itemType = r.mediaType === 'movie' ? 'Movie' : 'Series';
            const serverResults = await withTimeout(
              searchByProviderId(config, tmdbId, 'Tmdb', itemType),
              5000,
            );
            console.log('[Media Connector] Server lookup results:', JSON.stringify(serverResults));
            const match = serverResults?.Items?.[0];
            if (match) {
              serverItemUrl = buildServerItemUrl(
                config.server.serverType,
                resolvedUrl,
                match.Id,
                match.ServerId,
              );
              console.log('[Media Connector] Built serverItemUrl:', serverItemUrl);
            } else {
              console.warn('[Media Connector] No matching server item found for TMDb ID:', tmdbId);
            }
          } catch (e) {
            console.warn('[Media Connector] Could not resolve server item URL:', e);
          }
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
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    return {
      type: 'SEARCH_JELLYSEERR_RESPONSE',
      payload: {
        results: [],
        jellyseerrEnabled: true,
        serverType: config.server.serverType,
        error: errMsg,
      },
    };
  }
};

/**
 * Open a URL in a new tab via the service worker.
 * This creates a direct navigation that bypasses SameSite cookie
 * restrictions which block session cookies on cross-site link clicks.
 */
const handleOpenTab = async (message: OpenTabMessage) => {
  await chrome.tabs.create({ url: message.payload.url });
  return { type: 'OPEN_TAB_RESPONSE', payload: { success: true } };
};

// Log service worker activation
console.log('[Media Server Connector] Service worker activated');
