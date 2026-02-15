## 🔋 Effect Migration Plan — Type-Driven Development

### Current State

- `effect` v3.19.17 is already installed but **unused**
- All types use `readonly` properties and discriminated unions — very Effect-compatible
- Every util function takes `config` as first arg (classic DI anti-pattern → perfect for Effect services)
- All error handling is try/catch with thrown strings/errors → no typed error channel
- URL resolution uses a module-level `Map` cache with manual TTL → Effect has `Cache`/`Ref`

---

### Phase 1: Foundation — Tagged Errors & Schema (types layer)

| File                      | Changes                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| src/types/errors.ts (new) | Define all errors as `Data.TaggedError`: `ServerResponseError`, `ConfigurationError`, `NetworkError`, `MediaNotFoundError`, `JellyseerrError`, `StorageError`, `EmptyQueryError`, `CsrfError` |
| config.ts                 | Add `Schema` definitions for runtime validation of `ServerConfig`, `JellyseerrConfig`, `ExtensionConfig`                                                                                      |
| api.ts                    | Add `Schema` for `MediaSearchResult`, `MediaServerItem` — validate API responses at runtime                                                                                                   |
| media.ts                  | Keep as-is (already well-typed discriminated unions)                                                                                                                                          |
| messages.ts               | Add `Schema` for message validation, use `Data.TaggedEnum` for the message union                                                                                                              |

### Phase 2: Services & Layers (dependency injection)

| Service              | Purpose                                                                               | Replaces                                               |
| -------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `ConfigService`      | Provides `ExtensionConfig` from storage                                               | `config` first-arg pattern                             |
| `StorageService`     | `load`/`save`/`clear` with `Effect<A, StorageError>`                                  | storage.ts functions                                   |
| `UrlResolverService` | URL resolution with `Effect.cachedWithTTL` for probing                                | url-resolver.ts module-level `Map`                     |
| `HttpClientService`  | Wraps `fetch` for testability                                                         | Direct `fetch` calls in api-client & jellyseerr-client |
| `MediaServerService` | `searchMedia`, `searchByProviderId`, `getSeasons`, `getEpisodes`, `checkAvailability` | api-client.ts                                          |
| `JellyseerrService`  | `search`, `requestMovie`, `requestTvShow`, `testConnection`                           | jellyseerr-client.ts                                   |

### Phase 3: Convert Utils to Effect Programs

| File                 | Key Changes                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url-resolver.ts      | `probeServerUrl` → `Effect.tryPromise` + `Effect.timeout`. Cache via `Effect.cachedWithTTL` instead of manual `Map`. Return `Effect<string, NetworkError, UrlResolverService>`                           |
| api-client.ts        | Every function returns `Effect<A, ServerResponseError \| NetworkError, MediaServerService>`. Cascading search (IMDb → TMDb → title) uses `Effect.orElse` chains. `resolveMediaMatch` becomes a pure pipe |
| jellyseerr-client.ts | Returns `Effect<A, JellyseerrError, JellyseerrService>`. Cookie clearing becomes a side-effect in the Effect pipeline                                                                                    |
| storage.ts           | Returns `Effect<ExtensionConfig, StorageError>`. Chrome vs localStorage becomes two `Layer` implementations                                                                                              |

### Phase 4: Service Worker Migration

| File                      | Key Changes                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| service-worker-helpers.ts | `withTimeout` → `Effect.timeout`. Pure functions stay as-is                                                                                                                                                 |
| index.ts                  | Message routing via `Match.type` (pattern matching). Each handler becomes an Effect program. `Effect.runPromise` at the `chrome.runtime.onMessage` boundary. All error handling via the typed error channel |

### Phase 5: Content Scripts (light touch)

| File                      | Key Changes                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| detect-media.ts           | Return `Option<DetectedMedia>` instead of `DetectedMedia \| undefined`                                                            |
| content-script-helpers.ts | `buildCheckPayload` → `Effect.fail` instead of `throw`                                                                            |
| index.ts                  | Minimal changes — `Effect.runPromise` at async boundaries. This is mostly DOM manipulation, so heavy Effect adoption is low-value |

### Phase 6: Tests

| Change       | Details                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest tests | Use `Effect.runPromise` to run Effect programs. Provide mock services via `Layer.succeed(ServiceTag, mockImpl)`. No more `vi.stubGlobal('fetch')` — mock at the service layer |
| WTR tests    | Minimal changes — components consume Effect services through properties, not directly                                                                                         |
| Coverage     | Maintain ≥90% target. Effect's typed errors make edge cases more explicit and testable                                                                                        |

### Phase 7: Backward Compatibility Wrappers

The Lit components (popup-view.ts, sandbox-app.ts) call utils directly. We'll add thin wrappers that run Effect programs via `Effect.runPromise` so the component layer doesn't need deep Effect knowledge.

---

### Migration Order (dependency-safe)

```
1. errors.ts (new)           — no deps
2. Schema definitions        — depends on errors
3. storage.ts                — leaf dependency
4. url-resolver.ts           — depends on storage only indirectly
5. api-client.ts             — depends on url-resolver
6. jellyseerr-client.ts      — depends on url-resolver
7. service-worker/service-worker-helpers.ts — pure functions
8. service-worker/index.ts   — depends on everything above
9. content-scripts/*         — independent leaf
10. tests                    — after each file conversion
```

### What Stays the Same

- **Lit components** — UI rendering, styles, decorators (no Effect needed in templates)
- **Component Mixin** — stays as Lit mixin, receives config as property
- **Vite config** — no changes needed
- **Manifest** — no changes
- **Mock data** — stays as static fixtures

---
