/**
 * Messages sent between content scripts, popup, and service worker.
 */
export type ExtensionMessage =
  | CheckMediaMessage
  | CheckMediaResponse
  | RequestMediaMessage
  | RequestMediaResponse
  | SearchJellyseerrMessage
  | SearchJellyseerrResponse
  | GetConfigMessage
  | GetConfigResponse
  | SaveConfigMessage
  | SaveConfigResponse
  | OpenTabMessage;

/**
 * Request to open a URL in a new tab via the service worker.
 * This bypasses SameSite cookie restrictions that prevent
 * cross-site link clicks from carrying session cookies.
 */
export interface OpenTabMessage {
  readonly type: "OPEN_TAB";
  readonly payload: {
    readonly url: string;
  };
}

/**
 * Request to check if media exists on the server.
 */
export interface CheckMediaMessage {
  readonly type: "CHECK_MEDIA";
  readonly payload: {
    readonly title: string;
    readonly year?: number;
    readonly imdbId?: string;
    readonly tmdbId?: string;
    readonly mediaType: "movie" | "series" | "season" | "episode";
    readonly seasonNumber?: number;
    readonly episodeNumber?: number;
  };
}

/**
 * Response with media availability status.
 */
export interface CheckMediaResponse {
  readonly type: "CHECK_MEDIA_RESPONSE";
  readonly payload: {
    readonly status:
      | "available"
      | "unavailable"
      | "partial"
      | "error"
      | "unconfigured";
    readonly serverType?: "emby" | "jellyfin";
    readonly itemId?: string;
    readonly itemUrl?: string;
    readonly details?: string;
    readonly error?: string;
  };
}

/**
 * Request to submit a media request via Jellyseerr.
 */
export interface RequestMediaMessage {
  readonly type: "REQUEST_MEDIA";
  readonly payload: {
    readonly title: string;
    readonly year?: number;
    readonly imdbId?: string;
    readonly tmdbId?: string;
    readonly mediaType: "movie" | "series";
  };
}

/**
 * Response from a Jellyseerr media request.
 */
export interface RequestMediaResponse {
  readonly type: "REQUEST_MEDIA_RESPONSE";
  readonly payload: {
    readonly success: boolean;
    readonly message: string;
  };
}

/**
 * Request to search Jellyseerr and return enriched results
 * including availability info from the connected media server.
 */
export interface SearchJellyseerrMessage {
  readonly type: "SEARCH_JELLYSEERR";
  readonly payload: {
    readonly query: string;
    readonly mediaType?: "movie" | "tv";
    readonly year?: number;
  };
}

/**
 * Jellyseerr search result item surfaced to the content script.
 */
export interface JellyseerrResultItem {
  readonly id: number;
  readonly title: string;
  readonly year?: number;
  readonly mediaType: "movie" | "tv";
  readonly overview: string;
  readonly posterUrl?: string;
  readonly status:
    | "available"
    | "partial"
    | "pending"
    | "processing"
    | "unknown"
    | "not_requested";
  readonly serverUrl?: string;
  /** Direct link to the item on Emby/Jellyfin (only set when available/partial). */
  readonly serverItemUrl?: string;
}

/**
 * Response with Jellyseerr search results.
 */
export interface SearchJellyseerrResponse {
  readonly type: "SEARCH_JELLYSEERR_RESPONSE";
  readonly payload: {
    readonly results: JellyseerrResultItem[];
    readonly jellyseerrEnabled: boolean;
    readonly serverType: "emby" | "jellyfin";
    readonly jellyseerrUrl?: string;
    readonly serverUrl?: string;
    readonly error?: string;
  };
}

/**
 * Request to retrieve extension configuration.
 */
export interface GetConfigMessage {
  readonly type: "GET_CONFIG";
}

/**
 * Response with the stored extension configuration.
 */
export interface GetConfigResponse {
  readonly type: "GET_CONFIG_RESPONSE";
  readonly payload: {
    readonly serverType: "emby" | "jellyfin";
    readonly serverUrl: string;
    readonly localServerUrl: string;
    readonly apiKey: string;
    readonly jellyseerrEnabled: boolean;
    readonly jellyseerrUrl: string;
    readonly jellyseerrLocalUrl: string;
    readonly jellyseerrApiKey: string;
  };
}

/**
 * Request to save extension configuration.
 */
export interface SaveConfigMessage {
  readonly type: "SAVE_CONFIG";
  readonly payload: {
    readonly serverType: "emby" | "jellyfin";
    readonly serverUrl: string;
    readonly localServerUrl: string;
    readonly apiKey: string;
    readonly jellyseerrEnabled: boolean;
    readonly jellyseerrUrl: string;
    readonly jellyseerrLocalUrl: string;
    readonly jellyseerrApiKey: string;
  };
}

/**
 * Response after saving configuration.
 */
export interface SaveConfigResponse {
  readonly type: "SAVE_CONFIG_RESPONSE";
  readonly payload: {
    readonly success: boolean;
  };
}
