/**
 * Pure helper functions extracted from the service worker for testability.
 * These have no dependency on chrome.* APIs.
 */
import type { DetectedMedia, ExtensionConfig } from '../types/index.js';
import type { CheckMediaMessage } from '../types/messages.js';

/**
 * Map Jellyseerr numeric media status to a human-readable string.
 */
export const mapMediaStatus = (
  status: number | undefined,
): 'available' | 'partial' | 'pending' | 'processing' | 'unknown' | 'not_requested' => {
  switch (status) {
    case 5:
      return 'available';
    case 4:
      return 'partial';
    case 3:
      return 'processing';
    case 2:
      return 'pending';
    case 1:
      return 'unknown';
    default:
      return 'not_requested';
  }
};

/**
 * Race a promise against a timeout.
 * Returns undefined if the timeout fires first.
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);

/**
 * Build a DetectedMedia object from a CHECK_MEDIA message payload.
 */
export const buildDetectedMediaFromMessage = (
  payload: CheckMediaMessage['payload'],
): DetectedMedia => {
  switch (payload.mediaType) {
    case 'movie':
      return {
        type: 'movie',
        title: payload.title,
        year: payload.year,
        imdbId: payload.imdbId,
        tmdbId: payload.tmdbId,
      };
    case 'series':
      return {
        type: 'series',
        title: payload.title,
        year: payload.year,
        imdbId: payload.imdbId,
        tmdbId: payload.tmdbId,
      };
    case 'season':
      return {
        type: 'season',
        seriesTitle: payload.title,
        seasonNumber: payload.seasonNumber ?? 1,
        year: payload.year,
        imdbId: payload.imdbId,
        tmdbId: payload.tmdbId,
      };
    case 'episode':
      return {
        type: 'episode',
        seriesTitle: payload.title,
        seasonNumber: payload.seasonNumber ?? 1,
        episodeNumber: payload.episodeNumber ?? 1,
        year: payload.year,
        imdbId: payload.imdbId,
        tmdbId: payload.tmdbId,
      };
  }
};

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
  if (serverType === 'jellyfin') {
    return `${serverUrl}/web/#/details?id=${itemId}${serverIdParam}`;
  }
  return `${serverUrl}/web/index.html#!/item?id=${itemId}${serverIdParam}`;
};
