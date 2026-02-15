/**
 * Effect Schema definitions for runtime validation.
 *
 * Each schema mirrors the corresponding TypeScript interface from
 * the types layer, but can also **decode** unknown data at runtime
 * (e.g. JSON from `fetch` or `chrome.storage`).
 *
 * Re-exported branded types let the rest of the codebase use
 * `Schema.decodeUnknown` to get validated, strongly-typed data.
 */
import { Schema } from 'effect';
import type {
  ServerType,
  ExtensionConfig,
  MediaServerItem,
  MediaServerUserData,
  MediaSearchResult,
} from './index.js';

// ---------------------------------------------------------------------------
// Config schemas
// ---------------------------------------------------------------------------

/** Schema for `ServerType` */
export const ServerTypeSchema: Schema.Schema<ServerType> = Schema.Union(
  Schema.Literal('emby'),
  Schema.Literal('jellyfin'),
);

export const ServerConfigSchema = Schema.Struct({
  serverType: ServerTypeSchema,
  serverUrl: Schema.String,
  localServerUrl: Schema.String,
  apiKey: Schema.String,
});

export const JellyseerrConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  serverUrl: Schema.String,
  localServerUrl: Schema.String,
  apiKey: Schema.String,
});

export const ExtensionConfigSchema: Schema.Schema<ExtensionConfig> = Schema.Struct({
  server: ServerConfigSchema,
  jellyseerr: JellyseerrConfigSchema,
});

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------

export const MediaServerUserDataSchema: Schema.Schema<MediaServerUserData> = Schema.Struct({
  Played: Schema.Boolean,
  PlayCount: Schema.Number,
  IsFavorite: Schema.Boolean,
  UnplayedItemCount: Schema.optional(Schema.Number),
});

export const MediaServerItemSchema: Schema.Schema<MediaServerItem> = Schema.Struct({
  Id: Schema.String,
  ServerId: Schema.optional(Schema.String),
  Name: Schema.String,
  Type: Schema.Union(
    Schema.Literal('Movie'),
    Schema.Literal('Series'),
    Schema.Literal('Season'),
    Schema.Literal('Episode'),
  ),
  ProductionYear: Schema.optional(Schema.Number),
  ProviderIds: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  ParentIndexNumber: Schema.optional(Schema.Number),
  IndexNumber: Schema.optional(Schema.Number),
  SeriesName: Schema.optional(Schema.String),
  SeriesId: Schema.optional(Schema.String),
  SeasonId: Schema.optional(Schema.String),
  UserData: Schema.optional(MediaServerUserDataSchema),
  ImageTags: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  Overview: Schema.optional(Schema.String),
});

export const MediaSearchResultSchema: Schema.Schema<MediaSearchResult> = Schema.Struct({
  Items: Schema.Array(MediaServerItemSchema),
  TotalRecordCount: Schema.Number,
});

// ---------------------------------------------------------------------------
// Jellyseerr response schemas
// ---------------------------------------------------------------------------

export const JellyseerrMediaRequestSchema = Schema.Struct({
  id: Schema.Number,
  status: Schema.Number,
  requestedBy: Schema.Struct({
    displayName: Schema.String,
  }),
});

export const JellyseerrMediaInfoSchema = Schema.Struct({
  id: Schema.Number,
  tmdbId: Schema.Number,
  status: Schema.Number,
  requests: Schema.optional(Schema.Array(JellyseerrMediaRequestSchema)),
});

export const JellyseerrSearchResultSchema = Schema.Struct({
  id: Schema.Number,
  mediaType: Schema.Union(Schema.Literal('movie'), Schema.Literal('tv')),
  title: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  releaseDate: Schema.optional(Schema.String),
  firstAirDate: Schema.optional(Schema.String),
  overview: Schema.String,
  posterPath: Schema.optional(Schema.String),
  backdropPath: Schema.optional(Schema.String),
  voteAverage: Schema.optional(Schema.Number),
  mediaInfo: Schema.optional(JellyseerrMediaInfoSchema),
});

export const JellyseerrSearchResponseSchema = Schema.Struct({
  page: Schema.Number,
  totalPages: Schema.Number,
  totalResults: Schema.Number,
  results: Schema.Array(JellyseerrSearchResultSchema),
});

export const JellyseerrRequestResultSchema = Schema.Struct({
  id: Schema.Number,
  status: Schema.Number,
  media: Schema.Struct({
    id: Schema.Number,
    tmdbId: Schema.Number,
    status: Schema.Number,
  }),
});
