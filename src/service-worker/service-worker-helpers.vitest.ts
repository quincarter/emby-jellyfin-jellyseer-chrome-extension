import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import {
  mapMediaStatus,
  withTimeout,
  withTimeoutEffect,
  withTimeoutFailEffect,
  buildDetectedMediaFromMessage,
  buildServerItemUrl,
} from './service-worker-helpers.js';

describe('mapMediaStatus', () => {
  it('maps 5 to available', () => {
    expect(mapMediaStatus(5)).toBe('available');
  });

  it('maps 4 to partial', () => {
    expect(mapMediaStatus(4)).toBe('partial');
  });

  it('maps 3 to processing', () => {
    expect(mapMediaStatus(3)).toBe('processing');
  });

  it('maps 2 to pending', () => {
    expect(mapMediaStatus(2)).toBe('pending');
  });

  it('maps 1 to unknown', () => {
    expect(mapMediaStatus(1)).toBe('unknown');
  });

  it('maps undefined to not_requested', () => {
    expect(mapMediaStatus(undefined)).toBe('not_requested');
  });

  it('maps 0 to not_requested', () => {
    expect(mapMediaStatus(0)).toBe('not_requested');
  });

  it('maps any other number to not_requested', () => {
    expect(mapMediaStatus(99)).toBe('not_requested');
    expect(mapMediaStatus(-1)).toBe('not_requested');
  });
});

describe('withTimeout', () => {
  it('returns resolved value when promise resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve('done'), 1000);
    expect(result).toBe('done');
  });

  it('returns undefined when timeout fires first', async () => {
    const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 1000));

    const result = await withTimeout(slowPromise, 10);
    expect(result).toBeUndefined();
  });

  it('preserves object return types', async () => {
    const obj = { id: 1, name: 'test' };
    const result = await withTimeout(Promise.resolve(obj), 1000);
    expect(result).toEqual(obj);
  });
});

describe('withTimeoutEffect', () => {
  it('returns value when effect succeeds before timeout', async () => {
    const result = await Effect.runPromise(withTimeoutEffect(Effect.succeed('done'), 1000));
    expect(result).toBe('done');
  });

  it('returns undefined when timeout fires first', async () => {
    const slowEffect = Effect.promise(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 1000)),
    );
    const result = await Effect.runPromise(withTimeoutEffect(slowEffect, 10));
    expect(result).toBeUndefined();
  });
});

describe('withTimeoutFailEffect', () => {
  it('returns value when effect succeeds before timeout', async () => {
    const result = await Effect.runPromise(
      withTimeoutFailEffect(Effect.succeed('done'), 1000, 'test-op'),
    );
    expect(result).toBe('done');
  });

  it('fails with TimeoutError when timeout fires first', async () => {
    const slowEffect = Effect.promise(
      () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 1000)),
    );
    const exit = await Effect.runPromiseExit(withTimeoutFailEffect(slowEffect, 10, 'test-op'));
    expect(exit._tag).toBe('Failure');
    if (exit._tag === 'Failure') {
      expect(JSON.stringify(exit.cause)).toContain('TimeoutError');
    }
  });
});

describe('buildDetectedMediaFromMessage', () => {
  it('builds movie detection', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
      mediaType: 'movie',
    });

    expect(result).toEqual({
      type: 'movie',
      title: 'The Matrix',
      year: 1999,
      imdbId: 'tt0133093',
      tmdbId: '603',
    });
  });

  it('builds series detection', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'Breaking Bad',
      year: 2008,
      mediaType: 'series',
    });

    expect(result).toEqual({
      type: 'series',
      title: 'Breaking Bad',
      year: 2008,
      imdbId: undefined,
      tmdbId: undefined,
    });
  });

  it('builds season detection with defaults', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'Breaking Bad',
      mediaType: 'season',
    });

    expect(result.type).toBe('season');
    if (result.type === 'season') {
      expect(result.seriesTitle).toBe('Breaking Bad');
      expect(result.seasonNumber).toBe(1); // default
    }
  });

  it('builds season detection with specified number', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'Breaking Bad',
      mediaType: 'season',
      seasonNumber: 3,
    });

    if (result.type === 'season') {
      expect(result.seasonNumber).toBe(3);
    }
  });

  it('builds episode detection with defaults', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'Breaking Bad',
      mediaType: 'episode',
    });

    expect(result.type).toBe('episode');
    if (result.type === 'episode') {
      expect(result.seriesTitle).toBe('Breaking Bad');
      expect(result.seasonNumber).toBe(1); // default
      expect(result.episodeNumber).toBe(1); // default
    }
  });

  it('builds episode detection with specified numbers', () => {
    const result = buildDetectedMediaFromMessage({
      title: 'Breaking Bad',
      mediaType: 'episode',
      seasonNumber: 5,
      episodeNumber: 14,
    });

    if (result.type === 'episode') {
      expect(result.seasonNumber).toBe(5);
      expect(result.episodeNumber).toBe(14);
    }
  });
});

describe('buildServerItemUrl', () => {
  it('builds Emby URL', () => {
    const url = buildServerItemUrl('emby', 'https://emby.example.com', 'abc123');
    expect(url).toBe('https://emby.example.com/web/index.html#!/item?id=abc123');
  });

  it('builds Emby URL with server ID', () => {
    const url = buildServerItemUrl('emby', 'https://emby.example.com', 'abc123', 'server-1');
    expect(url).toBe('https://emby.example.com/web/index.html#!/item?id=abc123&serverId=server-1');
  });

  it('builds Jellyfin URL', () => {
    const url = buildServerItemUrl('jellyfin', 'https://jf.example.com', 'xyz789');
    expect(url).toBe('https://jf.example.com/web/#/details?id=xyz789');
  });

  it('builds Jellyfin URL with server ID', () => {
    const url = buildServerItemUrl('jellyfin', 'https://jf.example.com', 'xyz789', 'server-2');
    expect(url).toBe('https://jf.example.com/web/#/details?id=xyz789&serverId=server-2');
  });
});
