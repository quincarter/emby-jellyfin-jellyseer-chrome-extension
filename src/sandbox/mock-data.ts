import type { DetectedMedia } from '../types/index.js';
import type { MediaAvailability } from '../types/index.js';

/**
 * Mock media items for testing in the sandbox.
 */
export interface MockMediaScenario {
  readonly label: string;
  readonly media: DetectedMedia;
  readonly availability: MediaAvailability;
}

/**
 * Collection of mock scenarios covering all states.
 */
export const mockScenarios: MockMediaScenario[] = [
  {
    label: 'Movie - Available',
    media: {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
    },
    availability: {
      status: 'available',
      item: {
        Id: 'mock-1',
        Name: 'The Matrix',
        Type: 'Movie',
        ProductionYear: 1999,
        ProviderIds: { Imdb: 'tt0133093' },
        ImageTags: { Primary: 'abc123' },
        Overview: 'A computer hacker learns about the true nature of reality.',
      },
      serverUrl: 'https://emby.example.com',
    },
  },
  {
    label: 'Movie - Unavailable',
    media: {
      type: 'movie',
      title: 'Unreleased Movie 2026',
      year: 2026,
    },
    availability: {
      status: 'unavailable',
    },
  },
  {
    label: 'TV Series - Available',
    media: {
      type: 'series',
      title: 'Breaking Bad',
      year: 2008,
      imdbId: 'tt0903747',
    },
    availability: {
      status: 'available',
      item: {
        Id: 'mock-2',
        Name: 'Breaking Bad',
        Type: 'Series',
        ProductionYear: 2008,
        ProviderIds: { Imdb: 'tt0903747' },
      },
      serverUrl: 'https://emby.example.com',
    },
  },
  {
    label: 'Season - Partial',
    media: {
      type: 'season',
      seriesTitle: 'The Office',
      seasonNumber: 3,
      year: 2005,
    },
    availability: {
      status: 'partial',
      item: {
        Id: 'mock-3',
        Name: 'The Office',
        Type: 'Series',
        ProductionYear: 2005,
      },
      serverUrl: 'https://emby.example.com',
      details: 'Season 3 not found, but series exists',
    },
  },
  {
    label: 'Episode - Available',
    media: {
      type: 'episode',
      seriesTitle: 'Stranger Things',
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: 'The Vanishing of Will Byers',
      year: 2016,
    },
    availability: {
      status: 'available',
      item: {
        Id: 'mock-4',
        Name: 'The Vanishing of Will Byers',
        Type: 'Episode',
        ProductionYear: 2016,
        ParentIndexNumber: 1,
        IndexNumber: 1,
        SeriesName: 'Stranger Things',
      },
      serverUrl: 'https://emby.example.com',
    },
  },
  {
    label: 'Loading State',
    media: {
      type: 'movie',
      title: 'Loading...',
      year: 2024,
    },
    availability: {
      status: 'loading',
    },
  },
  {
    label: 'Error State',
    media: {
      type: 'movie',
      title: 'Error Movie',
      year: 2024,
    },
    availability: {
      status: 'error',
      message: 'Server connection timeout',
    },
  },
  {
    label: 'Unconfigured',
    media: {
      type: 'movie',
      title: 'Some Movie',
      year: 2024,
    },
    availability: {
      status: 'unconfigured',
    },
  },
];

import type { SearchJellyseerrResponse } from '../types/messages.js';

export const mockSearchResponses: Record<string, SearchJellyseerrResponse> = {
  multiple: {
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [
        {
          id: 603,
          title: 'The Matrix',
          year: 1999,
          mediaType: 'movie',
          status: 'available',
          overview: 'Cool movie',
          posterUrl: 'https://image.tmdb.org/t/p/w92/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
          serverItemUrl: 'https://emby.example.com/item/1',
        },
        {
          id: 1396,
          title: 'Breaking Bad',
          year: 2008,
          mediaType: 'tv',
          status: 'partial',
          overview: 'Science teacher cooks stuff',
          posterUrl: 'https://image.tmdb.org/t/p/w92/ztkUQv9Z19DMp3mHrgbfYzbqh96.jpg',
          serverItemUrl: 'https://emby.example.com/item/2',
        },
        {
          id: 456,
          title: 'Future Movie',
          year: 2026,
          mediaType: 'movie',
          status: 'not_requested',
          overview: 'Coming soon',
          posterUrl: undefined,
        },
      ],
      jellyseerrEnabled: true,
      serverType: 'emby',
      jellyseerrUrl: 'https://jellyseerr.example.com',
    },
  },
  unconfigured: {
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [],
      jellyseerrEnabled: false,
      serverType: 'emby',
    },
  },
  noResults: {
    type: 'SEARCH_JELLYSEERR_RESPONSE',
    payload: {
      results: [],
      jellyseerrEnabled: true,
      serverType: 'jellyfin',
    },
  },
};
