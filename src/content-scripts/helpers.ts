/**
 * Pure helper functions extracted from the content script for testability.
 * These have no dependency on the DOM or chrome.* APIs.
 */
import type { DetectedMedia } from '../types/index.js';
import type { CheckMediaMessage } from '../types/messages.js';

/**
 * Build CHECK_MEDIA payload from detected media.
 * @param media - The detected media from page scraping
 * @returns The message payload for the service worker
 * @throws If media is undefined
 */
export const buildCheckPayload = (
  media: DetectedMedia | undefined,
): CheckMediaMessage['payload'] => {
  if (!media) throw new Error('No media detected');
  return {
    title: media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title,
    year: media.year,
    imdbId: media.imdbId,
    tmdbId: media.tmdbId,
    mediaType: media.type,
    seasonNumber:
      media.type === 'season'
        ? media.seasonNumber
        : media.type === 'episode'
          ? media.seasonNumber
          : undefined,
    episodeNumber: media.type === 'episode' ? media.episodeNumber : undefined,
  };
};
