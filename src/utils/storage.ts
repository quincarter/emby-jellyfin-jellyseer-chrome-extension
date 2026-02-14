import type { ExtensionConfig } from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

const STORAGE_KEY = "mediaConnectorConfig";

/**
 * Check if chrome.storage API is available (extension context).
 */
const isChromeStorageAvailable = (): boolean =>
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

/**
 * Load extension configuration from storage.
 * Falls back to localStorage in non-extension contexts (sandbox).
 * @returns The stored configuration or defaults
 */
export const loadConfig = async (): Promise<ExtensionConfig> => {
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
};

/**
 * Save extension configuration to storage.
 * Falls back to localStorage in non-extension contexts (sandbox).
 * @param config - The configuration to persist
 */
export const saveConfig = async (config: ExtensionConfig): Promise<void> => {
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: config });
    return;
  }

  // Fallback for sandbox / dev mode
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

/**
 * Clear all stored configuration.
 */
export const clearConfig = async (): Promise<void> => {
  if (isChromeStorageAvailable()) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
};
