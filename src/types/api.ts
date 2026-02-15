/**
 * Represents a media item returned from Emby/Jellyfin API.
 */
export interface MediaServerItem {
  /** Server-assigned ID for the item */
  readonly Id: string;
  /** Server ID (used in Emby web URLs) */
  readonly ServerId?: string;
  /** Display name */
  readonly Name: string;
  /** Item type from the server */
  readonly Type: 'Movie' | 'Series' | 'Season' | 'Episode';
  /** Production year */
  readonly ProductionYear?: number;
  /** External provider IDs (IMDb, TMDb, etc.) */
  readonly ProviderIds?: Record<string, string>;
  /** Season number (for Season/Episode types) */
  readonly ParentIndexNumber?: number;
  /** Episode number (for Episode type) */
  readonly IndexNumber?: number;
  /** Series name (for Season/Episode types) */
  readonly SeriesName?: string;
  /** Series ID reference */
  readonly SeriesId?: string;
  /** Season ID reference */
  readonly SeasonId?: string;
  /** Whether the item has been played */
  readonly UserData?: MediaServerUserData;
  /** Image tags for fetching artwork */
  readonly ImageTags?: Record<string, string>;
  /** Overview/description */
  readonly Overview?: string;
}

/**
 * User-specific data for a media item.
 */
export interface MediaServerUserData {
  readonly Played: boolean;
  readonly PlayCount: number;
  readonly IsFavorite: boolean;
  readonly UnplayedItemCount?: number;
}

/**
 * Search results wrapper from Emby/Jellyfin.
 */
export interface MediaSearchResult {
  readonly Items: readonly MediaServerItem[];
  readonly TotalRecordCount: number;
}

/**
 * Availability status of media on the server.
 */
export type MediaAvailability =
  | {
      readonly status: 'available';
      readonly item: MediaServerItem;
      readonly serverUrl: string;
    }
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'partial';
      readonly item: MediaServerItem;
      readonly serverUrl: string;
      readonly details: string;
    }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'unconfigured' };
