import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Option } from 'effect';
import { identifySite, detectMedia, detectMediaOption } from './detect-media.js';

describe('identifySite', () => {
  it('identifies IMDb', () => {
    expect(identifySite('https://www.imdb.com/title/tt0133093/')).toBe('imdb');
    expect(identifySite('https://m.imdb.com/title/tt0133093/')).toBe('imdb');
  });

  it('identifies Trakt', () => {
    expect(identifySite('https://trakt.tv/movies/the-matrix-1999')).toBe('trakt');
    expect(identifySite('https://trakt.tv/shows/breaking-bad')).toBe('trakt');
  });

  it('identifies Netflix', () => {
    expect(identifySite('https://www.netflix.com/title/80100172')).toBe('netflix');
  });

  it('identifies Amazon', () => {
    expect(identifySite('https://www.amazon.com/gp/video/detail/B00BI1KNY6')).toBe('amazon');
    expect(identifySite('https://www.primevideo.com/detail/0RCNZ4K3V8DHSCOKN44')).toBe('amazon');
  });

  it('identifies Google', () => {
    expect(identifySite('https://www.google.com/search?q=the+matrix')).toBe('google');
  });

  it('identifies Bing', () => {
    expect(identifySite('https://www.bing.com/search?q=the+matrix')).toBe('bing');
  });

  it('identifies JustWatch', () => {
    expect(identifySite('https://www.justwatch.com/us/movie/the-matrix')).toBe('justwatch');
  });

  it('returns unknown for unsupported sites', () => {
    expect(identifySite('https://www.example.com')).toBe('unknown');
    expect(identifySite('https://www.reddit.com/r/movies')).toBe('unknown');
  });
});

describe('detectMedia', () => {
  // These tests exercise the DOM-dependent detectors.
  // In happy-dom we can set window.location and create DOM elements.

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('IMDb detection', () => {
    it('detects a movie from IMDb title page', () => {
      // Set location to an IMDb movie page
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt0133093/'),
        writable: true,
        configurable: true,
      });

      // Mock the page structure
      document.body.innerHTML = `
        <div data-testid="hero__pageTitle"><span>The Matrix</span></div>
        <div data-testid="hero-title-block__metadata">
          <li>1999</li>
          <span>1h 56m</span>
        </div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Matrix');
        expect(result!.year).toBe(1999);
        expect(result!.imdbId).toBe('tt0133093');
      }
    });

    it('detects a TV series from IMDb', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt0903747/'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-testid="hero__pageTitle"><span>Breaking Bad</span></div>
        <div data-testid="hero-title-block__metadata">
          <li>TV Series</li>
          <span>2008–2013</span>
        </div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('series');
      if (result!.type === 'series') {
        expect(result!.title).toBe('Breaking Bad');
        expect(result!.imdbId).toBe('tt0903747');
      }
    });

    it('detects a season from IMDb episodes page', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt0903747/episodes?season=3'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-testid="hero__pageTitle"><span>Breaking Bad</span></div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('season');
      if (result!.type === 'season') {
        expect(result!.seriesTitle).toBe('Breaking Bad');
        expect(result!.seasonNumber).toBe(3);
      }
    });

    it('detects an episode from IMDb', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt2301451/'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-testid="hero__pageTitle"><span>Ozymandias</span></div>
        <div data-testid="hero-subnav-bar-season-episode-numbers-section">S5.E14</div>
        <a data-testid="hero-title-block__series-link">Breaking Bad</a>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('episode');
      if (result!.type === 'episode') {
        expect(result!.seriesTitle).toBe('Breaking Bad');
        expect(result!.seasonNumber).toBe(5);
        expect(result!.episodeNumber).toBe(14);
      }
    });

    it('returns undefined when no title element exists', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt0000000/'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `<div></div>`;

      const result = detectMedia();
      expect(result).toBeUndefined();
    });
  });

  describe('Google detection', () => {
    it('detects a movie from Google knowledge panel', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.google.com/search?q=the+matrix+1999'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-attrid="title">The Matrix</div>
        <div data-attrid="subtitle">1999 ‧ Action/Sci-fi ‧ 2h 16m</div>
        <div data-attrid="kc:/film/film:cast"></div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Matrix');
        expect(result!.year).toBe(1999);
      }
    });

    it('detects a TV series from Google', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.google.com/search?q=breaking+bad+tv+series'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-attrid="title">Breaking Bad</div>
        <div data-attrid="subtitle">TV Series ‧ 2008–2013</div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('series');
    });

    it('returns undefined when no knowledge panel exists', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.google.com/search?q=random+query'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `<div class="search-results"></div>`;

      const result = detectMedia();
      expect(result).toBeUndefined();
    });
  });

  describe('Bing detection', () => {
    it('detects a movie from Bing', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.bing.com/search?q=the+matrix'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h2 class="wpt_title">The Matrix</h2>
        <span class="wpt_subtitle">1999 Film</span>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Matrix');
        expect(result!.year).toBe(1999);
      }
    });

    it('returns undefined when no knowledge panel', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.bing.com/search?q=random'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `<div></div>`;

      const result = detectMedia();
      expect(result).toBeUndefined();
    });
  });

  describe('JustWatch detection', () => {
    it('detects a movie from JustWatch', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.justwatch.com/us/movie/the-matrix'),
        writable: true,
        configurable: true,
      });

      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', 'The Matrix - watch movie streaming online');
      document.head.appendChild(meta);

      document.body.innerHTML = `
        <script>{"originalReleaseYear":1999}</script>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Matrix');
        expect(result!.year).toBe(1999);
      }
    });

    it('detects a TV show from JustWatch', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.justwatch.com/us/tv-show/breaking-bad'),
        writable: true,
        configurable: true,
      });

      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', 'Breaking Bad - watch tv show streaming online');
      document.head.appendChild(meta);

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('series');
    });

    it('detects a season from JustWatch', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.justwatch.com/us/tv-show/breaking-bad/season-3'),
        writable: true,
        configurable: true,
      });

      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', 'Breaking Bad - watch tv show streaming online');
      document.head.appendChild(meta);

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('season');
      if (result!.type === 'season') {
        expect(result!.seasonNumber).toBe(3);
      }
    });

    it('returns undefined for non-media JustWatch pages', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.justwatch.com/us/search'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `<div></div>`;

      const result = detectMedia();
      expect(result).toBeUndefined();
    });
  });

  describe('Trakt detection', () => {
    it('detects a movie from Trakt', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://trakt.tv/movies/the-matrix-1999'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>The Matrix</h1>
        <span class="year">1999</span>
        <a href="https://www.imdb.com/title/tt0133093">IMDb</a>
        <a href="https://www.themoviedb.org/movie/603">TMDb</a>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Matrix');
        expect(result!.year).toBe(1999);
        expect(result!.imdbId).toBe('tt0133093');
        expect(result!.tmdbId).toBe('603');
      }
    });

    it('detects a series from Trakt', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://trakt.tv/shows/breaking-bad'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>Breaking Bad</h1>
        <span class="year">2008</span>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('series');
    });

    it('detects a season from Trakt', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://trakt.tv/shows/breaking-bad/seasons/3'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>Breaking Bad</h1>
        <span class="year">2008</span>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('season');
      if (result!.type === 'season') {
        expect(result!.seasonNumber).toBe(3);
      }
    });

    it('detects an episode from Trakt', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://trakt.tv/shows/breaking-bad/seasons/5/episodes/14'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>Breaking Bad</h1>
        <span class="year">2008</span>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('episode');
      if (result!.type === 'episode') {
        expect(result!.seasonNumber).toBe(5);
        expect(result!.episodeNumber).toBe(14);
      }
    });
  });

  describe('Netflix detection', () => {
    it('detects a series from Netflix', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.netflix.com/title/80100172'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>Stranger Things</h1>
        <div data-uia="episode-item">Episode 1</div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('series');
      if (result!.type === 'series') {
        expect(result!.title).toBe('Stranger Things');
      }
    });

    it('detects a movie from Netflix (no episodes)', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.netflix.com/title/80100173'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>Glass Onion</h1>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
    });
  });

  describe('Amazon detection', () => {
    it('detects a movie from Amazon', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.amazon.com/gp/video/detail/B00BI1KNY6'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <h1>The Tomorrow War</h1>
        <div data-automation-id="release-year-badge">2021</div>
      `;

      const result = detectMedia();
      expect(result).toBeDefined();
      expect(result!.type).toBe('movie');
      if (result!.type === 'movie') {
        expect(result!.title).toBe('The Tomorrow War');
        expect(result!.year).toBe(2021);
      }
    });
  });

  describe('unknown site', () => {
    it('returns undefined for unsupported sites', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.example.com'),
        writable: true,
        configurable: true,
      });

      const result = detectMedia();
      expect(result).toBeUndefined();
    });
  });

  describe('detectMediaOption', () => {
    it('returns Option.none for unsupported sites', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.example.com'),
        writable: true,
        configurable: true,
      });

      const result = detectMediaOption();
      expect(Option.isNone(result)).toBe(true);
    });

    it('returns Option.some for IMDb movie page', () => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://www.imdb.com/title/tt0133093/'),
        writable: true,
        configurable: true,
      });

      document.body.innerHTML = `
        <div data-testid="hero__pageTitle"><span>The Matrix</span></div>
        <div data-testid="hero-title-block__metadata">
          <li>1999</li>
          <span>1h 56m</span>
        </div>
      `;

      const result = detectMediaOption();
      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        const media = result.value;
        if (media.type === 'movie') {
          expect(media.title).toBe('The Matrix');
        }
      }
    });
  });
});
