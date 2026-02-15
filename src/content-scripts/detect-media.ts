import type { DetectedMedia, SourceSite } from "../types/index.js";

/**
 * Identify the current site from the URL.
 * @param url - Current page URL
 * @returns The detected source site
 */
export const identifySite = (url: string): SourceSite => {
  const hostname = new URL(url).hostname;

  if (hostname.includes("imdb.com")) return "imdb";
  if (hostname.includes("trakt.tv")) return "trakt";
  if (hostname.includes("netflix.com")) return "netflix";
  if (hostname.includes("amazon.com") || hostname.includes("primevideo.com"))
    return "amazon";
  if (hostname.includes("google.com")) return "google";
  if (hostname.includes("bing.com")) return "bing";
  if (hostname.includes("justwatch.com")) return "justwatch";

  return "unknown";
};

/**
 * Detect media metadata from the current page.
 * Dispatches to site-specific detectors.
 * @returns Detected media info or undefined if no media found
 */
export const detectMedia = (): DetectedMedia | undefined => {
  const site = identifySite(window.location.href);

  switch (site) {
    case "imdb":
      return detectFromImdb();
    case "trakt":
      return detectFromTrakt();
    case "netflix":
      return detectFromNetflix();
    case "amazon":
      return detectFromAmazon();
    case "google":
      return detectFromGoogle();
    case "bing":
      return detectFromBing();
    case "justwatch":
      return detectFromJustWatch();
    default:
      return undefined;
  }
};

/**
 * Extract IMDb ID from URL.
 * @param url - IMDb page URL
 * @returns IMDb ID (e.g., "tt1234567") or undefined
 */
const extractImdbId = (url: string): string | undefined => {
  const match = url.match(/\/(tt\d+)/);
  return match?.[1];
};

/**
 * Extract year from a text string.
 * @param text - Text potentially containing a year
 * @returns Extracted year or undefined
 */
const extractYear = (text: string): number | undefined => {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
};

/**
 * Detect media from IMDb pages.
 * Handles movies, TV shows, seasons, and episodes.
 */
const detectFromImdb = (): DetectedMedia | undefined => {
  const url = window.location.href;
  const imdbId = extractImdbId(url);

  // Get title from page
  const titleElement =
    document.querySelector('[data-testid="hero__pageTitle"] span') ??
    document.querySelector("h1");
  const title = titleElement?.textContent?.trim();

  if (!title) return undefined;

  // Check for episode pattern in URL: /title/tt.../episodes?season=X
  const seasonMatch = url.match(/episodes\?season=(\d+)/);
  if (seasonMatch) {
    return {
      type: "season",
      seriesTitle: title,
      seasonNumber: parseInt(seasonMatch[1], 10),
      imdbId,
    };
  }

  // Check if it's a TV episode (has episode info on page)
  const episodeInfo = document.querySelector(
    '[data-testid="hero-subnav-bar-season-episode-numbers-section"]',
  );
  if (episodeInfo) {
    const seText = episodeInfo.textContent ?? "";
    const seMatch = seText.match(/S(\d+).*?E(\d+)/i);
    if (seMatch) {
      const seriesLink = document.querySelector(
        '[data-testid="hero-title-block__series-link"]',
      );
      const seriesTitle = seriesLink?.textContent?.trim() ?? title;
      return {
        type: "episode",
        seriesTitle,
        seasonNumber: parseInt(seMatch[1], 10),
        episodeNumber: parseInt(seMatch[2], 10),
        episodeTitle: title,
        imdbId,
      };
    }
  }

  // Check if it's a TV series (has "TV Series" or "TV Mini Series" label)
  const typeIndicator = document.querySelector(
    '[data-testid="hero-title-block__metadata"] li',
  );
  const typeText = typeIndicator?.textContent?.toLowerCase() ?? "";

  if (typeText.includes("tv series") || typeText.includes("tv mini")) {
    const yearText =
      document.querySelector('[data-testid="hero-title-block__metadata"]')
        ?.textContent ?? "";
    return {
      type: "series",
      title,
      year: extractYear(yearText),
      imdbId,
    };
  }

  // Default to movie
  const yearText =
    document.querySelector('[data-testid="hero-title-block__metadata"]')
      ?.textContent ?? "";
  return {
    type: "movie",
    title,
    year: extractYear(yearText),
    imdbId,
  };
};

/**
 * Detect media from Trakt.tv pages.
 */
const detectFromTrakt = (): DetectedMedia | undefined => {
  const url = window.location.href;

  const titleElement = document.querySelector("h1");
  const title = titleElement?.textContent?.trim();
  if (!title) return undefined;

  const yearElement = document.querySelector(".year");
  const year = yearElement
    ? extractYear(yearElement.textContent ?? "")
    : undefined;

  // Trakt movie pages: /movies/movie-slug
  if (url.includes("/movies/")) {
    return { type: "movie", title, year };
  }

  // Trakt show pages with season/episode: /shows/show-slug/seasons/X/episodes/Y
  const episodeMatch = url.match(
    /\/shows\/[^/]+\/seasons\/(\d+)\/episodes\/(\d+)/,
  );
  if (episodeMatch) {
    return {
      type: "episode",
      seriesTitle: title,
      seasonNumber: parseInt(episodeMatch[1], 10),
      episodeNumber: parseInt(episodeMatch[2], 10),
    };
  }

  // Trakt season pages: /shows/show-slug/seasons/X
  const seasonMatch = url.match(/\/shows\/[^/]+\/seasons\/(\d+)/);
  if (seasonMatch) {
    return {
      type: "season",
      seriesTitle: title,
      seasonNumber: parseInt(seasonMatch[1], 10),
    };
  }

  // Trakt show pages: /shows/show-slug
  if (url.includes("/shows/")) {
    return { type: "series", title, year };
  }

  return undefined;
};

/**
 * Detect media from Netflix pages.
 */
const detectFromNetflix = (): DetectedMedia | undefined => {
  // Netflix title pages: /title/XXXXXXXX
  const titleElement =
    document.querySelector(".title-title") ??
    document.querySelector('[data-uia="video-title"]') ??
    document.querySelector("h1");

  const title = titleElement?.textContent?.trim();
  if (!title) return undefined;

  // Check for episodes indicator
  const episodeSelector = document.querySelector('[data-uia="episode-item"]');
  if (episodeSelector) {
    return { type: "series", title };
  }

  return { type: "movie", title };
};

/**
 * Detect media from Amazon Prime Video pages.
 */
const detectFromAmazon = (): DetectedMedia | undefined => {
  const titleElement =
    document.querySelector('[data-automation-id="title"]') ??
    document.querySelector(".av-detail-section h1") ??
    document.querySelector("h1");

  const title = titleElement?.textContent?.trim();
  if (!title) return undefined;

  const yearElement = document.querySelector(
    '[data-automation-id="release-year-badge"]',
  );
  const year = yearElement
    ? extractYear(yearElement.textContent ?? "")
    : undefined;

  // Check for season/episode selectors
  const seasonSelector = document.querySelector(
    '[data-automation-id="season-selector"]',
  );
  if (seasonSelector) {
    return { type: "series", title, year };
  }

  return { type: "movie", title, year };
};

/**
 * Detect media from Google search result knowledge panels.
 * Uses `data-attrid="title"` for the title and `data-attrid="subtitle"` for
 * year/type information (e.g. "2019 ‧ Action/Sci-fi ‧ 3h 1m").
 */
const detectFromGoogle = (): DetectedMedia | undefined => {
  const knowledgePanel =
    document.querySelector('[data-attrid="title"]') ??
    document.querySelector(".kno-ecr-pt");

  if (!knowledgePanel) return undefined;

  const title = knowledgePanel.textContent?.trim();
  if (!title) return undefined;

  const typeLabel =
    document.querySelector('[data-attrid="subtitle"]') ??
    document.querySelector(".kno-ecr-st");
  const typeText = typeLabel?.textContent?.toLowerCase() ?? "";

  const yearMatch = typeText.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

  // Explicit type keywords in the subtitle
  if (
    typeText.includes("tv series") ||
    typeText.includes("tv show") ||
    typeText.includes("tv mini")
  ) {
    return { type: "series", title, year };
  }

  if (typeText.includes("film") || typeText.includes("movie")) {
    return { type: "movie", title, year };
  }

  // Google embeds structured type info in data-maindata on the knowledge panel.
  // e.g. ["FILM"] or "TVM" (TV Movie). Check for these signals.
  const kpElement = document.querySelector<HTMLElement>("[data-maindata]");
  if (kpElement) {
    const maindata =
      kpElement.getAttribute("data-maindata")?.toUpperCase() ?? "";
    if (maindata.includes('"TV_SERIES"') || maindata.includes('"TV_SHOW"')) {
      return { type: "series", title, year };
    }
    if (maindata.includes('"FILM"') || maindata.includes('"TVM"')) {
      return { type: "movie", title, year };
    }
  }

  // Fallback: runtime pattern in subtitle (e.g. "1h 42m", "2h 15m") indicates media.
  // Also check for genre-based data-attrid like "kc:/film/film:cast".
  const hasRuntime = /\d+h\s*\d*m/.test(typeText);
  const hasFilmAttrib = !!document.querySelector('[data-attrid^="kc:/film/"]');
  const hasTvAttrib = !!document.querySelector(
    '[data-attrid^="kc:/tv.tv_show/"], [data-attrid^="kc:/tv/"]',
  );

  if (hasTvAttrib) {
    return { type: "series", title, year };
  }

  if (hasFilmAttrib || hasRuntime) {
    return { type: "movie", title, year };
  }

  return undefined;
};

/**
 * Detect media from Bing search result knowledge panels.
 * Uses the `.wpt_title` heading and `.wpt_subtitle` span for
 * year/type information (e.g. "2019 Film").
 */
const detectFromBing = (): DetectedMedia | undefined => {
  const titleElement =
    document.querySelector<HTMLHeadingElement>("h2.wpt_title");
  if (!titleElement) return undefined;

  const title = titleElement.textContent?.trim();
  if (!title) return undefined;

  const subtitleElement =
    document.querySelector<HTMLSpanElement>("span.wpt_subtitle");
  const subtitleText = subtitleElement?.textContent?.toLowerCase() ?? "";

  const yearMatch = subtitleText.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined;

  if (
    subtitleText.includes("tv series") ||
    subtitleText.includes("tv show") ||
    subtitleText.includes("tv mini")
  ) {
    return { type: "series", title, year };
  }

  if (subtitleText.includes("film") || subtitleText.includes("movie")) {
    return { type: "movie", title, year };
  }

  return undefined;
};

/**
 * Strip JustWatch title suffixes to extract the clean media title.
 * Common formats:
 *   - "FBI - watch tv show streaming online"
 *   - "One Battle After Another streaming: watch online"
 *   - "Title - watch movie streaming online"
 *   - "Title | JustWatch"
 * @param raw - Raw title from og:title, document.title, etc.
 * @returns Cleaned title or empty string
 */
const cleanJustWatchTitle = (raw: string): string | undefined => {
  const cleaned = raw
    // "Title - watch tv show streaming online" → "Title"
    // "Title - watch movie streaming online"   → "Title"
    .replace(/\s*[-–]\s*watch\s+(tv\s+show|movie|tv\s+series).*$/i, "")
    // "Title streaming: watch online" → "Title"
    .replace(/\s*streaming\s*[:.]?\s*watch.*$/i, "")
    // "Title | JustWatch" → "Title"
    .replace(/\s*\|\s*JustWatch$/i, "")
    .trim();

  return cleaned || undefined;
};

/**
 * Detect media from JustWatch title pages.
 * URL patterns:
 *   - Movies:   /xx/movie/slug
 *   - TV Shows: /xx/tv-show/slug
 *
 * JustWatch is a Vue/Nuxt SPA. Title and year are extracted from the
 * `<meta property="og:title">` tag (e.g. "Title streaming: watch online")
 * and from embedded Apollo/JSON state (`"originalReleaseYear":YYYY`).
 */
const detectFromJustWatch = (): DetectedMedia | undefined => {
  const url = window.location.href;
  const path = new URL(url).pathname;

  // Determine media type from URL path segment
  const isMovie = /\/movie\//.test(path);
  const isTvShow = /\/tv-show\//.test(path);
  if (!isMovie && !isTvShow) return undefined;

  // Extract title: prefer og:title meta, fall back to document.title, then h1
  let title: string | undefined;

  const ogTitle = document
    .querySelector<HTMLMetaElement>('meta[property="og:title"]')
    ?.getAttribute("content");
  if (ogTitle) {
    // Strip common JustWatch suffixes:
    //   "Title streaming: watch online"
    //   "Title - watch tv show streaming online"
    //   "Title - watch movie streaming online"
    //   "Title | JustWatch"
    title = cleanJustWatchTitle(ogTitle);
  }

  if (!title) {
    title = cleanJustWatchTitle(document.title ?? "");
  }

  if (!title) {
    // Try the hero title element (Vue scoped, but the class is stable)
    const heroTitle = document.querySelector("h1");
    title = heroTitle?.textContent?.trim();
  }

  if (!title) return undefined;

  // Extract year: look in the embedded JSON state for originalReleaseYear
  let year: number | undefined;

  // Try inline scripts containing Apollo cache data
  const scripts = document.querySelectorAll("script");
  for (const script of scripts) {
    const text = script.textContent ?? "";
    const yearMatch = text.match(/"originalReleaseYear"\s*:\s*(\d{4})/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      break;
    }
  }

  // Fallback: try extracting year from visible release year element
  if (!year) {
    const releaseYearEl = document.querySelector(".release-year");
    if (releaseYearEl) {
      year = extractYear(releaseYearEl.textContent ?? "");
    }
  }

  // Fallback: try the og:title or document.title for a year in parentheses
  if (!year && ogTitle) {
    year = extractYear(ogTitle);
  }

  if (isMovie) {
    return { type: "movie", title, year };
  }

  // TV show — check for season in the URL
  // Season page: /xx/tv-show/slug/season-N
  const seasonMatch = path.match(/\/tv-show\/[^/]+\/season-(\d+)$/);
  if (seasonMatch) {
    return {
      type: "season",
      seriesTitle: title,
      seasonNumber: parseInt(seasonMatch[1], 10),
      year,
    };
  }

  return { type: "series", title, year };
};
