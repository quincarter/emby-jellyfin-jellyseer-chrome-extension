/**
 * Discriminated union for media type identification.
 */
export type MediaType = "movie" | "series" | "season" | "episode";

/**
 * Detected media context from a third-party page.
 */
export type DetectedMedia =
  | DetectedMovie
  | DetectedSeries
  | DetectedSeason
  | DetectedEpisode;

/**
 * A detected movie with metadata.
 */
export interface DetectedMovie {
  readonly type: "movie";
  readonly title: string;
  readonly year?: number;
  readonly imdbId?: string;
  readonly tmdbId?: string;
}

/**
 * A detected TV series (show level).
 */
export interface DetectedSeries {
  readonly type: "series";
  readonly title: string;
  readonly year?: number;
  readonly imdbId?: string;
  readonly tmdbId?: string;
}

/**
 * A detected season of a TV series.
 */
export interface DetectedSeason {
  readonly type: "season";
  readonly seriesTitle: string;
  readonly seasonNumber: number;
  readonly year?: number;
  readonly imdbId?: string;
  readonly tmdbId?: string;
}

/**
 * A detected episode of a TV series.
 */
export interface DetectedEpisode {
  readonly type: "episode";
  readonly seriesTitle: string;
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly episodeTitle?: string;
  readonly year?: number;
  readonly imdbId?: string;
  readonly tmdbId?: string;
}

/**
 * Source site where media was detected.
 */
export type SourceSite =
  | "imdb"
  | "trakt"
  | "netflix"
  | "amazon"
  | "google"
  | "bing"
  | "unknown";
