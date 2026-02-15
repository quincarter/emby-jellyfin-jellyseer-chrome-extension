import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { buildCheckPayload, buildCheckPayloadEffect } from './content-script-helpers.js';
import type { DetectedMedia } from '../types/index.js';

describe('buildCheckPayload', () => {
  it('throws when media is undefined', () => {
    expect(() => buildCheckPayload(undefined)).toThrow('No media detected');
  });

  it('builds payload for movie', () => {
    const media: DetectedMedia = {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
    };

    const payload = buildCheckPayload(media);
    expect(payload).toEqual({
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
      mediaType: 'movie',
      seasonNumber: undefined,
      episodeNumber: undefined,
    });
  });

  it('builds payload for series', () => {
    const media: DetectedMedia = {
      type: 'series',
      title: 'Breaking Bad',
      year: 2008,
    };

    const payload = buildCheckPayload(media);
    expect(payload).toEqual({
      title: 'Breaking Bad',
      year: 2008,
      imdbId: undefined,
      tmdbId: undefined,
      mediaType: 'series',
      seasonNumber: undefined,
      episodeNumber: undefined,
    });
  });

  it('builds payload for season (uses seriesTitle)', () => {
    const media: DetectedMedia = {
      type: 'season',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 3,
    };

    const payload = buildCheckPayload(media);
    expect(payload.title).toBe('Breaking Bad');
    expect(payload.mediaType).toBe('season');
    expect(payload.seasonNumber).toBe(3);
    expect(payload.episodeNumber).toBeUndefined();
  });

  it('builds payload for episode (uses seriesTitle, season, episode)', () => {
    const media: DetectedMedia = {
      type: 'episode',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 5,
      episodeNumber: 14,
      episodeTitle: 'Ozymandias',
    };

    const payload = buildCheckPayload(media);
    expect(payload.title).toBe('Breaking Bad');
    expect(payload.mediaType).toBe('episode');
    expect(payload.seasonNumber).toBe(5);
    expect(payload.episodeNumber).toBe(14);
  });

  it('handles media without optional fields', () => {
    const media: DetectedMedia = {
      type: 'movie',
      title: 'Unknown Movie',
    };

    const payload = buildCheckPayload(media);
    expect(payload.year).toBeUndefined();
    expect(payload.imdbId).toBeUndefined();
    expect(payload.tmdbId).toBeUndefined();
  });
});

describe('buildCheckPayloadEffect', () => {
  it('fails with NoMediaDetectedError when media is undefined', async () => {
    const exit = await Effect.runPromiseExit(buildCheckPayloadEffect(undefined));
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      expect(JSON.stringify(exit.cause)).toContain('NoMediaDetectedError');
    }
  });

  it('succeeds with payload for movie', async () => {
    const media: DetectedMedia = {
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
    };

    const payload = await Effect.runPromise(buildCheckPayloadEffect(media));
    expect(payload).toEqual({
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
      mediaType: 'movie',
      seasonNumber: undefined,
      episodeNumber: undefined,
    });
  });

  it('succeeds with payload for season (uses seriesTitle)', async () => {
    const media: DetectedMedia = {
      type: 'season',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 3,
    };

    const payload = await Effect.runPromise(buildCheckPayloadEffect(media));
    expect(payload.title).toBe('Breaking Bad');
    expect(payload.mediaType).toBe('season');
    expect(payload.seasonNumber).toBe(3);
    expect(payload.episodeNumber).toBeUndefined();
  });

  it('succeeds with payload for episode', async () => {
    const media: DetectedMedia = {
      type: 'episode',
      seriesTitle: 'Breaking Bad',
      seasonNumber: 5,
      episodeNumber: 14,
      episodeTitle: 'Ozymandias',
    };

    const payload = await Effect.runPromise(buildCheckPayloadEffect(media));
    expect(payload.title).toBe('Breaking Bad');
    expect(payload.mediaType).toBe('episode');
    expect(payload.seasonNumber).toBe(5);
    expect(payload.episodeNumber).toBe(14);
  });
});
