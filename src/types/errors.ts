/**
 * Tagged error types for the extension.
 *
 * All errors extend `Data.TaggedError` so they carry a `_tag` discriminant
 * and are structurally equal.  Using typed errors instead of thrown strings
 * lets Effect propagate them through the error channel, making every
 * failure path visible in the type signature.
 */
import { Data } from 'effect';

/**
 * The media server returned a non-OK HTTP response.
 */
export class ServerResponseError extends Data.TaggedError('ServerResponseError')<{
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
}> {}

/**
 * The extension is not yet configured (missing URL / API key).
 */
export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
  readonly reason: string;
}> {}

/**
 * A network-level failure (timeout, DNS, connection refused …).
 */
export class NetworkError extends Data.TaggedError('NetworkError')<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * The requested media was not found on the server.
 */
export class MediaNotFoundError extends Data.TaggedError('MediaNotFoundError')<{
  readonly title: string;
  readonly mediaType: string;
}> {}

/**
 * A Jellyseerr API call failed.
 */
export class JellyseerrError extends Data.TaggedError('JellyseerrError')<{
  readonly reason: string;
  readonly status?: number;
}> {}

/**
 * A CSRF token error from Jellyseerr.
 */
export class CsrfError extends Data.TaggedError('CsrfError')<{
  readonly serverUrl: string;
}> {}

/**
 * Reading from or writing to browser / local storage failed.
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly operation: 'load' | 'save' | 'clear';
  readonly cause?: unknown;
}> {}

/**
 * A search query was empty or otherwise invalid.
 */
export class EmptyQueryError extends Data.TaggedError('EmptyQueryError')<{
  readonly query: string;
}> {}

/**
 * No media was detected on the current page.
 */
export class NoMediaDetectedError extends Data.TaggedError('NoMediaDetectedError')<object> {}

/**
 * A timeout occurred while waiting for a response.
 */
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
  readonly ms: number;
  readonly operation: string;
}> {}
