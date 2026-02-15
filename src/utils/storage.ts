import { Effect, Layer } from 'effect';
import type { ExtensionConfig } from '../types/index.js';
import { DEFAULT_CONFIG, StorageError } from '../types/index.js';
import { StorageService } from '../services/index.js';

const STORAGE_KEY = 'mediaConnectorConfig';

/**
 * Check if chrome.storage API is available (extension context).
 */
const isChromeStorageAvailable = (): boolean =>
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined';

// ---------------------------------------------------------------------------
// Effect-based implementations
// ---------------------------------------------------------------------------

/**
 * Load extension configuration from storage.
 * Falls back to localStorage in non-extension contexts (sandbox).
 */
export const loadConfigEffect: Effect.Effect<ExtensionConfig, StorageError> = Effect.tryPromise({
  try: async () => {
    if (isChromeStorageAvailable()) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as ExtensionConfig | undefined;
      return stored ?? DEFAULT_CONFIG;
    }

    // Fallback for sandbox / dev mode
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as ExtensionConfig;
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  },
  catch: (cause) => new StorageError({ operation: 'load', cause }),
});

/**
 * Save extension configuration to storage.
 * Falls back to localStorage in non-extension contexts (sandbox).
 */
export const saveConfigEffect = (config: ExtensionConfig): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: async () => {
      if (isChromeStorageAvailable()) {
        await chrome.storage.local.set({ [STORAGE_KEY]: config });
        return;
      }
      // Fallback for sandbox / dev mode
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    },
    catch: (cause) => new StorageError({ operation: 'save', cause }),
  });

/**
 * Clear all stored configuration.
 */
export const clearConfigEffect: Effect.Effect<void, StorageError> = Effect.tryPromise({
  try: async () => {
    if (isChromeStorageAvailable()) {
      await chrome.storage.local.remove(STORAGE_KEY);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  },
  catch: (cause) => new StorageError({ operation: 'clear', cause }),
});

// ---------------------------------------------------------------------------
// Layer (provides StorageService from Effect programs)
// ---------------------------------------------------------------------------

export const StorageLive = Layer.succeed(
  StorageService,
  StorageService.of({
    load: loadConfigEffect,
    save: saveConfigEffect,
    clear: clearConfigEffect,
  }),
);

// ---------------------------------------------------------------------------
// Legacy async wrappers (used by Lit components that can't run Effects)
// ---------------------------------------------------------------------------

/**
 * Load extension configuration from storage.
 * @returns The stored configuration or defaults
 */
export const loadConfig = async (): Promise<ExtensionConfig> => Effect.runPromise(loadConfigEffect);

/**
 * Save extension configuration to storage.
 * @param config - The configuration to persist
 */
export const saveConfig = async (config: ExtensionConfig): Promise<void> =>
  Effect.runPromise(saveConfigEffect(config));

/**
 * Clear all stored configuration.
 */
export const clearConfig = async (): Promise<void> => Effect.runPromise(clearConfigEffect);
