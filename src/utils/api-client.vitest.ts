import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildApiHeaders,
  searchMedia,
  searchByProviderId,
  getSeasons,
  getEpisodes,
  testServerConnection,
  checkMediaAvailability,
} from './api-client.js';
import type { ExtensionConfig, MediaSearchResult } from '../types/index.js';

const mockEmbyConfig: ExtensionConfig = {
  server: {
    serverType: 'emby',
    serverUrl: 'https://emby.example.com:8096',
    localServerUrl: '',
    apiKey: 'test-api-key-123',
  },
  jellyseerr: {
    enabled: false,
    serverUrl: '',
    localServerUrl: '',
    apiKey: '',
  },
};

const mockJellyfinConfig: ExtensionConfig = {
  server: {
    serverType: 'jellyfin',
    serverUrl: 'https://jellyfin.example.com',
    localServerUrl: '',
    apiKey: 'jf-api-key-456',
  },
  jellyseerr: {
    enabled: false,
    serverUrl: '',
    localServerUrl: '',
    apiKey: '',
  },
};

const emptySearchResult: MediaSearchResult = {
  Items: [],
  TotalRecordCount: 0,
};

const movieResult: MediaSearchResult = {
  Items: [
    {
      Id: 'item-123',
      Name: 'The Matrix',
      Type: 'Movie',
      ProductionYear: 1999,
      ProviderIds: { Imdb: 'tt0133093' },
    },
  ],
  TotalRecordCount: 1,
};

const seriesResult: MediaSearchResult = {
  Items: [
    {
      Id: 'series-456',
      Name: 'Breaking Bad',
      Type: 'Series',
      ProductionYear: 2008,
    },
  ],
  TotalRecordCount: 1,
};

describe('buildApiHeaders', () => {
  it('returns Emby token header for emby server type', () => {
    const headers = buildApiHeaders(mockEmbyConfig);
    expect(headers['X-Emby-Token']).toBe('test-api-key-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('returns MediaBrowser Authorization header for jellyfin server type', () => {
    const headers = buildApiHeaders(mockJellyfinConfig);
    expect(headers['Authorization']).toBe('MediaBrowser Token="jf-api-key-456"');
    expect(headers['X-Emby-Token']).toBeUndefined();
  });
});

describe('searchMedia', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(movieResult),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls fetch with correct URL and headers', async () => {
    await searchMedia(mockEmbyConfig, 'The Matrix', 'Movie');

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain('emby.example.com:8096/Items?');
    expect(url).toContain('SearchTerm=The+Matrix');
    expect(url).toContain('IncludeItemTypes=Movie');
    expect(url).toContain('Recursive=true');
  });

  it('omits IncludeItemTypes when type is not specified', async () => {
    await searchMedia(mockEmbyConfig, 'The Matrix');

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).not.toContain('IncludeItemTypes');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    await expect(searchMedia(mockEmbyConfig, 'The Matrix')).rejects.toThrow(
      'Server responded with 401: Unauthorized',
    );
  });
});

describe('searchByProviderId', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(movieResult),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses AnyProviderIdEquals for Emby', async () => {
    await searchByProviderId(mockEmbyConfig, 'tt0133093', 'Imdb');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('AnyProviderIdEquals=Imdb.tt0133093');
  });

  it('uses AnyImdbId for Jellyfin', async () => {
    await searchByProviderId(mockJellyfinConfig, 'tt0133093', 'Imdb');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('AnyImdbId=tt0133093');
  });

  it('uses AnyTmdbId for Jellyfin with Tmdb provider', async () => {
    await searchByProviderId(mockJellyfinConfig, '603', 'Tmdb');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('AnyTmdbId=603');
  });

  it('includes IncludeItemTypes when specified', async () => {
    await searchByProviderId(mockEmbyConfig, 'tt0133093', 'Imdb', 'Movie');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('IncludeItemTypes=Movie');
  });
});

describe('getSeasons', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [{ Id: 's1', Name: 'Season 1', Type: 'Season', IndexNumber: 1 }],
            TotalRecordCount: 1,
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls correct endpoint', async () => {
    await getSeasons(mockEmbyConfig, 'series-456');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('/Shows/series-456/Seasons');
  });
});

describe('getEpisodes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              {
                Id: 'ep1',
                Name: 'Pilot',
                Type: 'Episode',
                IndexNumber: 1,
                ParentIndexNumber: 1,
              },
            ],
            TotalRecordCount: 1,
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls correct endpoint with season filter', async () => {
    await getEpisodes(mockEmbyConfig, 'series-456', 2);

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).toContain('/Shows/series-456/Episodes');
    expect(url).toContain('Season=2');
  });

  it('omits season param when not specified', async () => {
    await getEpisodes(mockEmbyConfig, 'series-456');

    const url = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(url).not.toContain('Season=');
  });
});

describe('testServerConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when server responds OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const result = await testServerConnection(mockEmbyConfig);
    expect(result).toBe(true);
  });

  it('returns false when server responds with error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await testServerConnection(mockEmbyConfig);
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await testServerConnection(mockEmbyConfig);
    expect(result).toBe(false);
  });
});

describe('checkMediaAvailability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unconfigured when server URL is empty', async () => {
    const unconfigured: ExtensionConfig = {
      server: {
        serverType: 'emby',
        serverUrl: '',
        localServerUrl: '',
        apiKey: '',
      },
      jellyseerr: {
        enabled: false,
        serverUrl: '',
        localServerUrl: '',
        apiKey: '',
      },
    };

    const result = await checkMediaAvailability(unconfigured, {
      type: 'movie',
      title: 'Test',
    });
    expect(result.status).toBe('unconfigured');
  });

  it('returns unconfigured when API key is empty', async () => {
    const unconfigured: ExtensionConfig = {
      server: {
        serverType: 'emby',
        serverUrl: 'https://test.com',
        localServerUrl: '',
        apiKey: '',
      },
      jellyseerr: {
        enabled: false,
        serverUrl: '',
        localServerUrl: '',
        apiKey: '',
      },
    };

    const result = await checkMediaAvailability(unconfigured, {
      type: 'movie',
      title: 'Test',
    });
    expect(result.status).toBe('unconfigured');
  });

  it('returns available when movie is found by IMDb ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(movieResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
    });

    expect(result.status).toBe('available');
    if (result.status === 'available') {
      expect(result.item.Name).toBe('The Matrix');
    }
  });

  it('returns unavailable when no results found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(emptySearchResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'Nonexistent Movie',
    });

    expect(result.status).toBe('unavailable');
  });

  it('returns error status on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'Test',
      imdbId: 'tt9999999',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('Network down');
    }
  });

  it('finds series by title search when no provider IDs match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'series',
      title: 'Breaking Bad',
      year: 2008,
    });

    expect(result.status).toBe('available');
  });

  it('falls back to TMDb ID when IMDb ID yields no results', async () => {
    const fetchMock = vi
      .fn()
      // First call: IMDb search returns empty
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptySearchResult),
      })
      // Second call: TMDb search returns movie
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(movieResult),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
    });

    expect(result.status).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to title search when both IMDb and TMDb yield no results', async () => {
    const fetchMock = vi
      .fn()
      // IMDb search empty
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptySearchResult),
      })
      // TMDb search empty
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptySearchResult),
      })
      // Title search returns movie
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(movieResult),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
    });

    expect(result.status).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns unavailable when movie type doesn't match and year mismatches", async () => {
    const mixedResult: MediaSearchResult = {
      Items: [
        {
          Id: 'item-999',
          Name: 'The Matrix Resurrections',
          Type: 'Movie',
          ProductionYear: 2021,
          ProviderIds: {},
        },
      ],
      TotalRecordCount: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mixedResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
    });

    // Year mismatch > 1 and only Movie type matches → no match falls through to undefined
    expect(result.status).toBe('unavailable');
  });

  it('returns available for series without year', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'series',
      title: 'Breaking Bad',
    });

    expect(result.status).toBe('available');
  });

  it("returns unavailable for series with year that doesn't match", async () => {
    const wrongYear: MediaSearchResult = {
      Items: [
        {
          Id: 'series-789',
          Name: 'Breaking Bad',
          Type: 'Series',
          ProductionYear: 2020,
        },
      ],
      TotalRecordCount: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(wrongYear),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'series',
      title: 'Breaking Bad',
      year: 2008,
    });

    // Year mismatch and only Series type items → match is undefined → unavailable
    expect(result.status).toBe('unavailable');
  });

  it('returns partial for season when season not found but series exists', async () => {
    const fetchMock = vi
      .fn()
      // checkMediaAvailability searches for the series
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      })
      // getSeasons returns seasons that don't match
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              { Id: 's1', Name: 'Season 1', Type: 'Season', IndexNumber: 1 },
              { Id: 's2', Name: 'Season 2', Type: 'Season', IndexNumber: 2 },
            ],
            TotalRecordCount: 2,
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'season',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 5,
    });

    expect(result.status).toBe('partial');
    if (result.status === 'partial') {
      expect(result.details).toContain('Season 5 not found');
    }
  });

  it('returns available for season when season exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              { Id: 's1', Name: 'Season 1', Type: 'Season', IndexNumber: 1 },
              { Id: 's2', Name: 'Season 2', Type: 'Season', IndexNumber: 2 },
            ],
            TotalRecordCount: 2,
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'season',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 2,
    });

    expect(result.status).toBe('available');
  });

  it('returns partial for episode when episode not found but series exists', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              {
                Id: 'ep1',
                Name: 'Pilot',
                Type: 'Episode',
                IndexNumber: 1,
                ParentIndexNumber: 1,
              },
            ],
            TotalRecordCount: 1,
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'episode',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 1,
      episodeNumber: 5,
    });

    expect(result.status).toBe('partial');
    if (result.status === 'partial') {
      expect(result.details).toContain('S1E5 not found');
    }
  });

  it('returns available for episode when found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(seriesResult),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              {
                Id: 'ep1',
                Name: 'Pilot',
                Type: 'Episode',
                IndexNumber: 1,
                ParentIndexNumber: 1,
              },
            ],
            TotalRecordCount: 1,
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'episode',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 1,
      episodeNumber: 1,
    });

    expect(result.status).toBe('available');
  });

  it('returns unavailable for season when no series found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Items: [
              {
                Id: 'm1',
                Name: 'Breaking Bad Movie',
                Type: 'Movie',
                ProductionYear: 2019,
              },
            ],
            TotalRecordCount: 1,
          }),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'season',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 1,
    });

    expect(result.status).toBe('unavailable');
  });

  it('handles non-Error thrown exceptions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'Test',
      imdbId: 'tt9999999',
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('Unknown error');
    }
  });

  it('uses seriesTitle for title search on season type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptySearchResult),
    });

    vi.stubGlobal('fetch', fetchMock);

    await checkMediaAvailability(mockEmbyConfig, {
      type: 'season',
      seriesTitle: 'My Show',
      seasonNumber: 1,
    });

    // Should search for "My Show" not any other title
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('SearchTerm=My+Show');
  });

  it('uses seriesTitle for title search on episode type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptySearchResult),
    });

    vi.stubGlobal('fetch', fetchMock);

    await checkMediaAvailability(mockEmbyConfig, {
      type: 'episode',
      seriesTitle: 'My Show',
      seasonNumber: 1,
      episodeNumber: 3,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('SearchTerm=My+Show');
  });

  it('returns movie match falling back to first non-Movie type item when no Movie type items and year is set', async () => {
    const nonMovieResult: MediaSearchResult = {
      Items: [
        {
          Id: 'special-123',
          Name: 'The Matrix',
          Type: 'Series',
          ProductionYear: 1999,
        },
      ],
      TotalRecordCount: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(nonMovieResult),
      }),
    );

    const result = await checkMediaAvailability(mockEmbyConfig, {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
    });

    // No Movie-type items, so with year set it falls back to items[0] (the Series)
    expect(result.status).toBe('available');
  });
});
