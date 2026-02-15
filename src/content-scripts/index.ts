import { Option, Effect } from 'effect';
import { detectMediaOption, identifySite } from './detect-media.js';
import { buildCheckPayloadEffect, getJustWatchPageType } from './content-script-helpers.js';
import type {
  CheckMediaResponse,
  GetConfigResponse,
  RequestMediaResponse,
  SearchJellyseerrResponse,
  JellyseerrResultItem,
} from '../types/messages.js';

/**
 * Detect media from the current page, returning `undefined` when nothing is found.
 * Wraps `detectMediaOption` for convenient use at the boundary.
 */
const tryDetectMedia = () => Option.getOrUndefined(detectMediaOption());

/**
 * Build a CHECK_MEDIA payload from detected media (sync boundary helper).
 */
const buildPayload = (media: NonNullable<ReturnType<typeof tryDetectMedia>>) =>
  Effect.runSync(buildCheckPayloadEffect(media));

/** Raw Emby SVG string for injection into non-Lit DOM. */
const EMBY_SVG = `<svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Emby"><path d="m97.1 229.4 26.5 26.5L0 379.5l132.4 132.4 26.5-26.5L282.5 609l141.2-141.2-26.5-26.5L512 326.5 379.6 194.1l-26.5 26.5L229.5 97z" fill="#52b54b" transform="translate(0 -97)"/><path d="M196.8 351.2v-193L366 254.7 281.4 303z" fill="#fff" transform="translate(0 97)"/></svg>`;

/** Raw Jellyfin SVG string for injection into non-Lit DOM. */
const JELLYFIN_SVG = `<svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Jellyfin"><defs><linearGradient id="jellyfin-gradient-cs" x1="110.25" y1="213.3" x2="496.14" y2="436.09" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#aa5cc3"/><stop offset="1" stop-color="#00a4dc"/></linearGradient></defs><g transform="translate(-5.42, -7.37)"><path d="M261.42,201.62c-20.44,0-86.24,119.29-76.2,139.43s142.48,19.92,152.4,0S281.86,201.63,261.42,201.62Z" fill="url(#jellyfin-gradient-cs)"/><path d="M261.42,23.3C199.83,23.3,1.57,382.73,31.8,443.43s429.34,60,459.24,0S323,23.3,261.42,23.3ZM411.9,390.76c-19.59,39.33-281.08,39.77-300.9,0S221.1,115.48,261.45,115.48,431.49,351.42,411.9,390.76Z" fill="url(#jellyfin-gradient-cs)"/></g></svg>`;

/** Raw Combined logo SVG string. */
const COMBINED_SVG = `<svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Media Server Connector">
  <defs>
    <linearGradient id="jellyfin-gradient-combined-cs" x1="110.25" y1="213.3" x2="496.14" y2="436.09" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#aa5cc3" />
      <stop offset="1" stop-color="#00a4dc" />
    </linearGradient>
    <linearGradient id="a-combined-cs" x1="-2254.016" x2="-2267.51" y1="-2831.433" y2="-2961.618" gradientTransform="matrix(1.75 0 0 -1.75 4099.705 -4631.96)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#502d95" /><stop offset=".1" style="stop-color:#6d37ac" /><stop offset=".57" style="stop-color:#6786d1" /></linearGradient>
    <linearGradient id="b-combined-cs" x1="-2175.81" x2="-2189.303" y1="-2839.483" y2="-2969.721" gradientTransform="matrix(1.75 0 0 -1.75 4099.705 -4631.96)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#502d95" /><stop offset=".1" style="stop-color:#6d37ac" /><stop offset=".57" style="stop-color:#6786d1" /></linearGradient>
    <linearGradient id="c-combined-cs" x1="-1831.757" x2="-1831.757" y1="-2576.996" y2="-2695.45" gradientTransform="matrix(2.12 0 0 -2.12 4199.46 -5137.32)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#763dcd" /><stop offset=".22" style="stop-color:#8d61eb" /><stop offset=".37" style="stop-color:#8c86ec" /><stop offset=".64" style="stop-color:#748ce8" /><stop offset=".9" style="stop-color:#6ba1e6" /></linearGradient>
    <linearGradient id="d-combined-cs" x1="-1891.134" x2="-1891.134" y1="-2576.996" y2="-2695.45" gradientTransform="matrix(2.12 0 0 -2.12 4199.46 -5137.32)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#763dcd" /><stop offset=".22" style="stop-color:#8d61eb" /><stop offset=".37" style="stop-color:#8c86ec" /><stop offset=".64" style="stop-color:#748ce8" /><stop offset=".9" style="stop-color:#6ba1e6" /></linearGradient>
    <linearGradient id="e-combined-cs" x1="-1922.004" x2="-1922.004" y1="-2576.996" y2="-2695.45" gradientTransform="matrix(2.12 0 0 -2.12 4199.46 -5137.32)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#763dcd" /><stop offset=".22" style="stop-color:#8d61eb" /><stop offset=".37" style="stop-color:#8c86ec" /><stop offset=".64" style="stop-color:#748ce8" /><stop offset=".9" style="stop-color:#6ba1e6" /></linearGradient>
    <linearGradient id="f-combined-cs" x1="-1862.421" x2="-1862.421" y1="-2576.996" y2="-2695.45" gradientTransform="matrix(2.12 0 0 -2.12 4199.46 -5137.32)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#763dcd" /><stop offset=".22" style="stop-color:#8d61eb" /><stop offset=".37" style="stop-color:#8c86ec" /><stop offset=".64" style="stop-color:#748ce8" /><stop offset=".9" style="stop-color:#6ba1e6" /></linearGradient>
    <linearGradient id="g-combined-cs" x1="-1735.548" x2="-1586.936" y1="-2673.095" y2="-2838.19" gradientTransform="matrix(1.79 0 0 -1.79 3246.155 -4657.91)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#c395fc" /><stop offset="1" style="stop-color:#4f65f5" /></linearGradient>
    <linearGradient id="h-combined-cs" x1="-1059.872" x2="-1059.872" y1="-6378.031" y2="-6594.775" gradientTransform="matrix(.51 0 0 -.51 687.865 -3205.53)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#fff;stop-opacity:.4" /><stop offset="1" style="stop-color:#fff;stop-opacity:0" /></linearGradient>
    <linearGradient id="i-combined-cs" x1="-1351.382" x2="-1485.195" y1="-3908.894" y2="-4007.24" gradientTransform="matrix(1.02 0 0 -1.02 1657.5 -3832.45)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#f9f9f9" /><stop offset="1" style="stop-color:#f9f9f9;stop-opacity:0" /></linearGradient>
    <linearGradient id="j-combined-cs" x1="-1293.035" x2="-1228.344" y1="-3139.552" y2="-3205.578" gradientTransform="matrix(1.43 0 0 -1.43 2027.665 -4326.01)" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:#0043a2" /><stop offset="1" style="stop-color:#00133a" /></linearGradient>
  </defs>
  <g transform="translate(128, 10) scale(0.5)">
    <g transform="translate(0, -97)">
      <path d="m97.1 229.4 26.5 26.5L0 379.5l132.4 132.4 26.5-26.5L282.5 609l141.2-141.2-26.5-26.5L512 326.5 379.6 194.1l-26.5 26.5L229.5 97z" fill="#52b54b" />
      <path d="M196.8 351.2v-193L366 254.7 281.4 303z" fill="#fff" transform="translate(0 97)" />
    </g>
  </g>
  <g transform="translate(0, 240) scale(0.5)">
    <g transform="translate(-5.42, -7.37)">
      <path d="M261.42,201.62c-20.44,0-86.24,119.29-76.2,139.43s142.48,19.92,152.4,0S281.86,201.63,261.42,201.62Z" fill="url(#jellyfin-gradient-combined-cs)" />
      <path d="M261.42,23.3C199.83,23.3,1.57,382.73,31.8,443.43s429.34,60,459.24,0S323,23.3,261.42,23.3ZM411.9,390.76c-19.59,39.33-281.08,39.77-300.9,0S221.1,115.48,261.45,115.48,431.49,351.42,411.9,390.76Z" fill="url(#jellyfin-gradient-combined-cs)" />
    </g>
  </g>
  <g transform="translate(256, 240) scale(0.42) translate(30, 30)">
    <g transform="translate(0, -97)">
      <path d="m170.9 314-27-6s-6.2 39.6-8.6 59.5c-3.8 32.1-8.4 76.5-6.6 110.5 2 37.4 12.2 73.4 15.6 73.4s-1.8-22.9.5-73.3c1.5-33.6 7.1-74 13.8-110.5 3.3-18 12.9-53.4 12.9-53.4h-.6z" fill="url(#a-combined-cs)" />
      <path d="M284.8 311.2h8.3c11.1 41.4 13.2 101.1 10.8 146.1-2.6 49.5-16.2 97.2-20.6 97.2s2.4-30.3-.7-97.1C280.4 412.9 271 371 270 311.2z" fill="url(#b-combined-cs)" />
      <path d="M309.8 181.6h13.3c17.8 66.2 26.1 161.9 22.2 234-4.2 79.4-25.9 155.7-33.1 155.7s3.8-48.6-1.1-155.6c-3.3-71.4-23.5-138.4-25.1-234.2z" fill="url(#c-combined-cs)" />
      <path d="M196.6 180.1h-13.3c-17.8 66.2-26.1 161.9-22.2 234 4.2 79.4 25.9 155.7 33.1 155.7s-3.8-48.6 1.1-155.6c3.3-71.4 23.5-138.4 25.1-234.2h-23.8z" fill="url(#d-combined-cs)" />
      <path d="m155.6 150-30.2-10.8s-11.1 70.7-15.3 106.2c-6.7 57.3-20 136.6-16.7 197.3 3.6 66.8 21.8 131.1 27.8 131.1s-3.2-40.9 1-131c2.8-60.1 21.2-117 27.4-197.4 2.5-31.9 7.3-95.5 7.3-95.5z" fill="url(#e-combined-cs)" />
      <path d="m255.5 181.6-27.3 4.6s3.6 53 3.6 83.1c0 48.9 1.9 98.2 1.8 149.5-.2 58.9 9.7 157.6 14.8 157.6s21.7-127 25.2-203c2.3-50.7-5.2-95.1-6.5-125.4-1.2-27-5-63.4-5-63.4z" fill="url(#f-combined-cs)" />
      <path d="M405.8 197.7c0 68.8-11.7 73-30.8 102.1-13.8 20.9 14.1 37.1 2.9 42.9-13.3 6.9-9.1-5.6-35.6-12.7-11.5-3-36.5.3-46.6 2.3-10 1.9-40.6-15.1-48.7-17.3-12.1-3.3-41.8 12.5-59.9 12.5s-37-15.8-61.1-9.3c-28.6 7.7-63.1 26.3-68.3 20.2-10-11.7 21.9-20.6 10-41.4-7.5-13.2-33.4-47.9-34.2-83-2.4-112.8 91-208.1 191.1-208.1s181.1 86.8 181.1 183.9" fill="url(#g-combined-cs)" />
      <path d="M218.4 41.7C163.7 41.7 87.3 98.3 87.3 153c0 6.1-4.9 11-11 11s-11-4.9-11-11c0-66.8 86.2-133.2 153.1-133.2 6.1 0 11 4.9 11 11s-5 10.9-11 10.9" fill-rule="evenodd" clip-rule="evenodd" fill="url(#h-combined-cs)" />
      <path d="M299.3 248.5c-5.8 9.5-13.7 17.1-23 22.3-4 2.2-8.2 3.9-12.6 5.2-13.1 5.9-27.7 9-42.6 9.3-50.8.9-93-31.6-94.7-72.8-.8-20.2 11.3-41.2 20.6-57.3 7.9-13.7 21.5-37.2 39.4-46.6 36.5-19.2 85.8 1.1 110.4 45.6 7.1 12.9 11.7 27 13.2 41.1 1.1 4.6 1.8 9.3 1.8 14 .2 12.2-3.4 24.3-10.2 35.1-.7 1.4-1.4 2.7-2.2 4 0 .1-.1.1-.1.1" fill="url(#i-combined-cs)" />
      <path d="M219 147.4c31.7 0 57.3 25.7 57.3 57.3S250.6 262 219 262s-57.3-25.7-57.3-57.3c0-5.9.9-11.5 2.5-16.9 4.5 10 14.5 16.9 26.1 16.9 15.8 0 28.6-12.9 28.6-28.6 0-11.6-6.9-21.7-16.9-26.1 5.4-1.7 11-2.5 17-2.6" fill="url(#j-combined-cs)" />
    </g>
  </g>
</svg>`;

/**
 * Content script entry point.
 * Detects media on the current page and injects the status indicator.
 * For SPA sites like Trakt (Svelte), uses a persistent MutationObserver
 * to survive framework re-renders and SPA navigations.
 */
const init = async (): Promise<void> => {
  const site = identifySite(window.location.href);
  console.log('[Media Connector] init: site =', site, ', URL =', window.location.href);
  if (site === 'unknown') return;

  if (site === 'trakt') {
    initTrakt();
    return;
  }

  // Search engines get a dedicated sidebar powered by Jellyseerr
  if (site === 'google' || site === 'bing') {
    initSearchEngineSidebar();
    return;
  }

  // IMDb gets an inline card below the hero section
  if (site === 'imdb') {
    initImdb();
    return;
  }

  // JustWatch is a Nuxt SPA — use a unified handler that adapts to
  // page-type transitions (search ↔ detail) during client-side navigation.
  if (site === 'justwatch') {
    initJustWatchSPA();
    return;
  }

  // Non-SPA sites: detect once and inject
  const media = tryDetectMedia();
  if (!media) return;

  const response = await sendMessage<CheckMediaResponse>({
    type: 'CHECK_MEDIA',
    payload: buildPayload(media),
  });

  if (response) {
    injectStatusIndicator(response, media.type);
  }
};

/**
 * Trakt-specific init.
 * Uses a persistent MutationObserver that:
 *  1. Waits for the <h1> to appear (Svelte hasn't rendered yet at document_idle)
 *  2. Detects media and queries the service worker
 *  3. Re-injects the WTW item whenever Svelte re-renders and removes it
 *  4. Re-detects on SPA navigation (URL changes)
 */
const initTrakt = (): void => {
  let lastUrl = window.location.href;
  let cachedResponse: CheckMediaResponse | undefined;
  let detecting = false;

  const detect = async (): Promise<void> => {
    if (detecting) return;
    detecting = true;

    try {
      const media = tryDetectMedia();
      if (!media) return;

      const response = await sendMessage<CheckMediaResponse>({
        type: 'CHECK_MEDIA',
        payload: buildPayload(media),
      });

      if (response) {
        cachedResponse = response;
        tryInjectTraktLegacyButton(response);
        tryInjectTraktItem(response);
      }
    } finally {
      detecting = false;
    }
  };

  const onMutation = (): void => {
    const currentUrl = window.location.href;

    // SPA navigation — URL changed, need to re-detect
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      cachedResponse = undefined;
      detect();
      return;
    }

    // If we have a cached response, ensure our elements are still in the DOM
    if (cachedResponse) {
      const wtwExists = document.getElementById('media-connector-wtw-item');
      const legacyExists = document.getElementById('media-connector-trakt-action-btn');
      if (!wtwExists || !legacyExists) {
        tryInjectTraktLegacyButton(cachedResponse);
        tryInjectTraktItem(cachedResponse);
      }
      return;
    }

    // Haven't detected yet — keep trying
    detect();
  };

  // Try immediately, then observe
  detect();

  const observer = new MutationObserver(() => onMutation());
  observer.observe(document.body, { childList: true, subtree: true });

  // No timeout — observer stays active for the lifetime of the tab
};

/**
 * Send a message to the extension service worker.
 * Gracefully handles "Extension context invalidated" (after reload/update).
 */
const sendMessage = <T>(message: unknown): Promise<T | undefined> => {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
      console.warn(
        '[Media Connector] Extension context unavailable (extension was reloaded). Refresh the page.',
      );
      resolve(undefined);
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        if (chrome.runtime.lastError) {
          console.error('[Media Connector] sendMessage error:', chrome.runtime.lastError.message);
          resolve(undefined);
          return;
        }
        resolve(response);
      });
    } catch (e) {
      console.warn('[Media Connector] sendMessage failed (context invalidated):', e);
      resolve(undefined);
    }
  });
};

/**
 * Modern Trakt UI: Attempt to inject the server item into "Where to Watch" list.
 * Called both on initial detection and whenever Svelte re-renders the section.
 * This is a synchronous injection — the persistent observer in initTrakt()
 * handles re-calling this when the element is removed.
 */
const tryInjectTraktItem = (response: CheckMediaResponse): void => {
  const canLink =
    (response.payload.status === 'available' || response.payload.status === 'partial') &&
    response.payload.itemUrl;
  const canRequest = response.payload.status === 'unavailable';
  const isUnconfigured = response.payload.status === 'unconfigured';

  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const logoSvg = serverType === 'jellyfin' ? JELLYFIN_SVG : EMBY_SVG;

  // Don't duplicate — if our element already exists, skip
  if (document.getElementById('media-connector-wtw-item')) return;

  // Find the "Where to Watch" section by its title text
  const titleSpans = document.querySelectorAll<HTMLSpanElement>('.trakt-list-title span.title');
  let whereToWatchSection: Element | undefined;
  for (const span of titleSpans) {
    if (span.textContent?.trim() === 'Where to Watch') {
      whereToWatchSection = span.closest('.section-list-container') ?? undefined;
      break;
    }
  }

  if (!whereToWatchSection) return;

  const listContainer = whereToWatchSection.querySelector('.trakt-list-item-container');
  if (!listContainer) return;

  // Shared inline styles matching Trakt's native "Where to Watch" items
  // Values derived from Trakt's CSS variables:
  // --width/height-where-to-watch-item: var(--ni-96) = 6rem
  // --font-size-tag: var(--ni-10) = 0.625rem
  // --border-radius-m: var(--ni-12) = 0.75rem
  const itemStyle = `
    width: 6rem;
    height: 6rem;
    scroll-snap-align: start;
    flex-shrink: 0;
    background-color: var(--color-card-background);
    border-radius: 12px;
  `.replace(/\n/g, '');

  const contentStyle = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    gap: 0.25rem;
    border-radius: 0.75rem;
  `.replace(/\n/g, '');

  const logoContainerStyle = `
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
  `.replace(/\n/g, '');

  const labelStyle = `
    margin: 0;
    font-size: 0.625rem;
    font-family: "Roboto", Arial, sans-serif;
    line-height: 1.2;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    color: var(--color-foreground, inherit);
  `.replace(/\n/g, '');

  // Build the item element matching Trakt's native structure
  const item = document.createElement('div');
  item.id = 'media-connector-wtw-item';
  item.className = 'where-to-watch-item';

  let labelText: string;

  if (canLink) {
    labelText = serverLabel;
    item.innerHTML = `
      <a target="_blank" tabindex="0" data-color="default"
         href="${response.payload.itemUrl}"
         class="trakt-link"
         style="text-decoration: none; color: inherit; display: flex; width: 100%; height: 100%;">
        <div class="where-to-watch-item-content" style="${contentStyle}">
          <div class="trakt-streaming-service-logo" style="${logoContainerStyle}">
            ${logoSvg}
          </div>
          <p style="${labelStyle}">${labelText}${response.payload.status === 'partial' ? ' (Partial)' : ''}</p>
        </div>
      </a>`;
  } else if (canRequest) {
    labelText = 'Request';
    item.innerHTML = `
      <div class="where-to-watch-item-content" style="${contentStyle} cursor: pointer;">
        <div class="trakt-streaming-service-logo" style="${logoContainerStyle}">
          ${logoSvg}
        </div>
        <p style="${labelStyle}">${labelText}</p>
      </div>`;
    item.addEventListener('click', () => {
      handleRequestClick();
    });
  } else if (isUnconfigured) {
    labelText = `Set up ${serverLabel}`;
    item.innerHTML = `
      <div class="where-to-watch-item-content" style="${contentStyle} cursor: pointer; opacity: 0.6;">
        <div class="trakt-streaming-service-logo" style="${logoContainerStyle}">
          ${logoSvg}
        </div>
        <p style="${labelStyle}">${labelText}</p>
      </div>`;
  } else {
    return; // Should not happen with current logic
  }

  // Apply item-level styles (no border/ring — matches native items)
  item.setAttribute('style', itemStyle);

  // Prepend as the first item in the list
  listContainer.prepend(item);
};

/**
 * Inject a "Play on Emby/Jellyfin" button into Trakt's legacy action-buttons area.
 */
const TRAKT_ACTION_BTN_ID = 'media-connector-trakt-action-btn';

const tryInjectTraktLegacyButton = (response: CheckMediaResponse): void => {
  // Don't duplicate
  if (document.getElementById(TRAKT_ACTION_BTN_ID)) return;

  // Find the Check In button in the action-buttons area
  const checkinBtn = document.querySelector<HTMLAnchorElement>('.action-buttons .btn-checkin');
  if (!checkinBtn) return;

  const canLink =
    (response.payload.status === 'available' || response.payload.status === 'partial') &&
    response.payload.itemUrl;

  const canRequest = response.payload.status === 'unavailable';
  const isUnconfigured = response.payload.status === 'unconfigured';

  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const logoSvg = serverType === 'jellyfin' ? JELLYFIN_SVG : EMBY_SVG;
  const serverColor = serverType === 'jellyfin' ? '#00A4DC' : '#52B54B';

  // Build the btn matching Trakt's native action button structure
  const btn = document.createElement('a');
  btn.id = TRAKT_ACTION_BTN_ID;
  btn.className = 'btn btn-block btn-summary';
  btn.style.cssText = [
    `border: 1px solid ${serverColor}`,
    `border-left: 3px solid ${serverColor}`,
    `background-color: transparent`,
    `color: ${serverColor}`,
    'display: flex',
    'align-items: center',
    'transition: background-color 0.15s, color 0.15s',
  ].join(';');

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = serverColor;
    btn.style.color = '#fff';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
    btn.style.color = serverColor;
  });

  // Scale the SVG to 20x20 to fit Trakt's icon size
  const iconHtml = logoSvg
    .replace(/width="48"/, 'width="20"')
    .replace(/height="48"/, 'height="20"');

  if (canLink) {
    btn.href = response.payload.itemUrl!;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.innerHTML = `
      <div class="fa fa-fw" style="display:inline-flex;align-items:center;justify-content:center;width:1.28571429em;">${iconHtml}</div>
      <div class="text">
        <div class="main-info">Play on ${serverLabel}</div>
        ${response.payload.status === 'partial' ? '<div class="under-info">Partial</div>' : ''}
      </div>`;
  } else if (canRequest) {
    btn.href = '#';
    btn.innerHTML = `
      <div class="fa fa-fw" style="display:inline-flex;align-items:center;justify-content:center;width:1.28571429em;">${iconHtml}</div>
      <div class="text">
        <div class="main-info">Request on ${serverLabel}</div>
      </div>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textEl = btn.querySelector('.main-info');
      if (textEl) textEl.textContent = 'Requesting…';
      handleRequestClick().then(() => {
        if (textEl) textEl.textContent = 'Requested!';
      });
    });
  } else if (isUnconfigured) {
    btn.href = '#';
    btn.style.opacity = '0.6';
    btn.innerHTML = `
      <div class="fa fa-fw" style="display:inline-flex;align-items:center;justify-content:center;width:1.28571429em;">${iconHtml}</div>
      <div class="text">
        <div class="main-info">Set up ${serverLabel}</div>
      </div>`;
  } else {
    return;
  }

  // Insert above the Check In button
  checkinBtn.insertAdjacentElement('beforebegin', btn);
};

/**
 * Initialise the sidebar for Google/Bing search results.
 *
 * 1. Detect the media from the knowledge panel (title + year + type).
 * 2. Send a SEARCH_JELLYSEERR message to the service worker.
 * 3. Render a sidebar card with results, availability badges, and a
 *    "Request" button for items that are missing.
 */
const SIDEBAR_ID = 'media-connector-sidebar';
const SKELETON_ID = 'media-connector-skeleton';

/**
 * Inject a CSS @keyframes rule for the skeleton shimmer animation.
 * Only injected once.
 */
const injectSkeletonKeyframes = (): void => {
  if (document.getElementById('media-connector-skeleton-style')) return;
  const style = document.createElement('style');
  style.id = 'media-connector-skeleton-style';
  style.textContent = `
    @keyframes mcShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0;  }
    }
  `;
  document.head.appendChild(style);
};

/**
 * Build and insert a skeleton loading placeholder.
 * Shows the real header (logo + title) with shimmer placeholders
 * only on the content area below.
 */
const showSkeleton = (serverLabel: string): void => {
  if (document.getElementById(SKELETON_ID)) return;
  injectSkeletonKeyframes();

  const shimmerBg =
    'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)';
  const shimmerStyle = `background: ${shimmerBg}; background-size: 800px 100%; animation: mcShimmer 1.6s ease-in-out infinite;`;

  const skeleton = document.createElement('div');
  skeleton.id = SKELETON_ID;
  Object.assign(skeleton.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    maxWidth: '360px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBlock: '1rem',
  });

  // Use the combined icon for search engine sidebars
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  skeleton.innerHTML = `
    <!-- real header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
        <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr &middot; ${serverLabel}</div>
      </div>
    </div>
    <!-- skeleton content -->
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="width:60px;height:90px;border-radius:8px;flex-shrink:0;${shimmerStyle}"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px;">
        <div style="width:75%;height:14px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:40%;height:11px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:55%;height:20px;border-radius:6px;${shimmerStyle}"></div>
        <div style="width:50%;height:26px;border-radius:6px;margin-top:4px;${shimmerStyle}"></div>
      </div>
    </div>
  `;

  appendSidebarToPage(skeleton as HTMLDivElement);
};

/**
 * Remove the skeleton placeholder from the DOM.
 */
const removeSkeleton = (): void => {
  document.getElementById(SKELETON_ID)?.remove();
};

/**
 * IMDb-specific init.
 * Detects media, queries Jellyseerr, and injects a media connector card
 * below the hero section (title + poster + video area).
 */
const initImdb = async (): Promise<void> => {
  const media = tryDetectMedia();
  if (!media) {
    console.log('[Media Connector] No media detected on IMDb page');
    return;
  }

  const title =
    media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

  const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

  console.log('[Media Connector] IMDb detected media:', {
    title,
    mediaType,
    year: media.year,
    imdbId: media.imdbId,
  });

  // Fetch config for server label
  const configRes = await sendMessage<GetConfigResponse>({
    type: 'GET_CONFIG',
  });
  const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  // Show skeleton while we wait for the Jellyseerr response
  showImdbSkeleton(serverLabel);

  const response = await sendMessage<SearchJellyseerrResponse>({
    type: 'SEARCH_JELLYSEERR',
    payload: { query: title, mediaType, year: media.year },
  });

  // Remove skeleton regardless of outcome
  removeImdbSkeleton();

  if (!response) {
    console.log('[Media Connector] No response from service worker');
    return;
  }

  console.log('[Media Connector] Jellyseerr response:', response);
  injectImdbCard(response, title);
};

/**
 * Build and insert a skeleton loading placeholder on IMDb.
 * Shows the real header (logo + title) with shimmer placeholders
 * only on the content area below.
 */
const IMDB_SKELETON_ID = 'media-connector-imdb-skeleton';

const showImdbSkeleton = (serverLabel: string): void => {
  if (document.getElementById(IMDB_SKELETON_ID)) return;
  injectSkeletonKeyframes();

  const shimmerBg =
    'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)';
  const shimmerStyle = `background: ${shimmerBg}; background-size: 800px 100%; animation: mcShimmer 1.6s ease-in-out infinite;`;

  const skeleton = document.createElement('div');
  skeleton.id = IMDB_SKELETON_ID;
  Object.assign(skeleton.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBlock: '1rem',
  });

  // Use the combined icon for IMDb card
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  skeleton.innerHTML = `
    <!-- real header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
        <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr &middot; ${serverLabel}</div>
      </div>
    </div>
    <!-- skeleton content -->
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="width:60px;height:90px;border-radius:8px;flex-shrink:0;${shimmerStyle}"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px;">
        <div style="width:75%;height:14px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:40%;height:11px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:55%;height:20px;border-radius:6px;${shimmerStyle}"></div>
        <div style="width:50%;height:26px;border-radius:6px;margin-top:4px;${shimmerStyle}"></div>
      </div>
    </div>
  `;

  appendCardToImdbPage(skeleton);
};

/**
 * Remove the IMDb skeleton placeholder from the DOM.
 */
const removeImdbSkeleton = (): void => {
  document.getElementById(IMDB_SKELETON_ID)?.remove();
};

/**
 * Build and inject the media connector card into the IMDb page
 * below the hero section.
 */
const IMDB_CARD_ID = 'media-connector-imdb-card';

const injectImdbCard = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(IMDB_CARD_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;

  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  /* ---------- outer card ---------- */
  const card = document.createElement('div');
  card.id = IMDB_CARD_ID;
  Object.assign(card.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    color: '#e8e0f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBlock: '1rem',
    fontSize: '14px',
    lineHeight: '1.5',
  });

  /* ---------- header ---------- */
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  });

  // Use the combined icon for IMDb card header
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  header.innerHTML = `
    <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
      <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr · ${serverLabel}</div>
    </div>
  `;
  card.appendChild(header);

  /* ---------- error / unconfigured states ---------- */
  if (!jellyseerrEnabled) {
    card.appendChild(
      createInfoRow(
        '⚙️',
        'Jellyseerr not configured',
        'Open the extension popup to set your Jellyseerr URL and API key.',
      ),
    );
    appendCardToImdbPage(card);
    return;
  }

  if (error) {
    card.appendChild(createInfoRow('⚠️', 'Connection error', error));
    appendCardToImdbPage(card);
    return;
  }

  if (results.length === 0) {
    card.appendChild(
      createInfoRow('🔍', 'No results', `"${queryTitle}" was not found on Jellyseerr.`),
    );
    appendCardToImdbPage(card);
    return;
  }

  /* ---------- result cards ---------- */
  results.forEach((item, idx) => {
    const row = buildResultRow(item, serverLabel, jellyseerrUrl);
    if (idx > 0) {
      row.style.borderTop = '1px solid rgba(255,255,255,0.06)';
      row.style.paddingTop = '12px';
    }
    card.appendChild(row);
  });

  appendCardToImdbPage(card);
};

/**
 * Append the media connector card to the IMDb page below the hero section.
 * Uses stable `data-testid` selectors to find the hero section.
 */
const appendCardToImdbPage = (card: HTMLDivElement): void => {
  // Find the hero section by its stable data-testid attribute
  const heroSection = document.querySelector<HTMLElement>('[data-testid="hero-parent"]');

  if (heroSection) {
    // The hero-parent is nested inside a wrapper section that applies a blur
    // overlay (ipc-page-background--baseAlt with sc-14a487d5-* classes).
    // We must insert OUTSIDE that wrapper to avoid inheriting the blur.
    const blurWrapper = heroSection.closest('section.ipc-page-background--baseAlt');
    if (blurWrapper) {
      blurWrapper.after(card);
    } else {
      heroSection.after(card);
    }
    return;
  }

  // Fallback: try the hero page title and insert after its closest section
  const heroTitle = document.querySelector<HTMLElement>('[data-testid="hero__pageTitle"]');
  const heroContainer = heroTitle?.closest('section.ipc-page-background--baseAlt');
  if (heroContainer) {
    heroContainer.after(card);
    return;
  }

  // Last resort: prepend to the main content area
  const main = document.querySelector<HTMLElement>('main[role="main"]');
  if (main) {
    main.prepend(card);
  }
};

/* ------------------------------------------------------------------ */
/*  JustWatch integration                                             */
/* ------------------------------------------------------------------ */

const JUSTWATCH_CARD_ID = 'media-connector-justwatch-card';
const JUSTWATCH_SKELETON_ID = 'media-connector-justwatch-skeleton';

/**
 * Unified JustWatch SPA handler.
 * JustWatch is a Nuxt SPA, so client-side navigation changes the URL
 * without a full page reload. A single debounced MutationObserver routes
 * between detail-page and search-page behaviors, preventing mutation storms
 * that can interfere with Vue's rendering cycle.
 *
 * The card is injected before the "buybox-container" — the "Watch Now" /
 * "Where to Watch" streaming offers section.
 */
const initJustWatchSPA = (): void => {
  console.log('[Media Connector] JW SPA: initializing, URL =', window.location.href);
  let lastUrl = window.location.href;
  let currentPageType: 'detail' | 'search' | 'other' = getJustWatchPageType(lastUrl);
  console.log('[Media Connector] JW SPA: initial page type =', currentPageType);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // ── Observer (declared early so closures below can reference it) ──
  let observerConnected = false;
  const observer = new MutationObserver(() => scheduleMutation());

  const pauseObserver = (): void => {
    if (observerConnected) {
      observer.disconnect();
      observerConnected = false;
    }
  };

  const resumeObserver = (): void => {
    if (!observerConnected) {
      observer.observe(document.body, { childList: true, subtree: true });
      observerConnected = true;
    }
  };

  // ── Detail-page state ──
  let detailInjected = false;
  let detailDetecting = false;

  // ── Search-page state ──
  let searchProcessing = false;
  let searchServerLabel = 'Emby';
  let searchServerType = 'emby';

  const detectDetail = async (): Promise<void> => {
    console.log(
      '[Media Connector] JW SPA: detectDetail called, detailDetecting =',
      detailDetecting,
      ', detailInjected =',
      detailInjected,
    );
    if (detailDetecting || detailInjected) return;
    detailDetecting = true;

    try {
      const media = tryDetectMedia();
      console.log('[Media Connector] JW SPA: tryDetectMedia result:', media ?? 'undefined');
      if (!media) return;

      const title =
        media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;
      const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

      console.log('[Media Connector] JW SPA: detected media:', {
        title,
        mediaType,
        year: media.year,
      });

      const configRes = await sendMessage<GetConfigResponse>({ type: 'GET_CONFIG' });
      console.log('[Media Connector] JW SPA: config response:', configRes);
      const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

      pauseObserver();
      showJustWatchSkeleton(serverLabel);
      resumeObserver();
      console.log('[Media Connector] JW SPA: skeleton shown');

      const response = await sendMessage<SearchJellyseerrResponse>({
        type: 'SEARCH_JELLYSEERR',
        payload: { query: title, mediaType, year: media.year },
      });

      pauseObserver();
      removeJustWatchSkeleton();

      if (!response) {
        console.log('[Media Connector] JW SPA: no response from service worker');
        resumeObserver();
        return;
      }

      console.log('[Media Connector] JW SPA: Jellyseerr response:', response);
      injectJustWatchCard(response, title);
      resumeObserver();
      console.log(
        '[Media Connector] JW SPA: card injected, in DOM =',
        !!document.getElementById(JUSTWATCH_CARD_ID),
      );
      detailInjected = true;
    } finally {
      detailDetecting = false;
    }
  };

  const processSearchRows = async (): Promise<void> => {
    console.log(
      '[Media Connector] JW SPA: processSearchRows called, searchProcessing =',
      searchProcessing,
    );
    if (searchProcessing) return;
    searchProcessing = true;

    try {
      const configRes = await sendMessage<GetConfigResponse>({ type: 'GET_CONFIG' });
      searchServerLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
      searchServerType = configRes?.payload.serverType ?? 'emby';

      const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');
      console.log('[Media Connector] JW SPA: search found', rows.length, 'total rows');
      let processed = 0;
      for (const row of rows) {
        if (
          row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) ||
          row.dataset.mcProcessing === 'true'
        )
          continue;
        processed++;
        pauseObserver();
        await processJustWatchSearchRow(row, searchServerLabel, searchServerType);
        resumeObserver();
      }
      console.log('[Media Connector] JW SPA: processed', processed, 'search rows');
    } finally {
      searchProcessing = false;
    }
  };

  /** Clean up all extension-injected elements. */
  const cleanupAll = (): void => {
    pauseObserver();
    document.getElementById(JUSTWATCH_CARD_ID)?.remove();
    document.getElementById(JUSTWATCH_SKELETON_ID)?.remove();
    document.querySelectorAll(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`).forEach((el) => el.remove());
    detailInjected = false;
    resumeObserver();
  };

  let lastMutationRun = 0;
  const DEBOUNCE_MS = 300;
  const MAX_WAIT_MS = 1000;

  const scheduleMutation = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const elapsed = Date.now() - lastMutationRun;
    // If we haven't run in over MAX_WAIT_MS, run immediately to avoid
    // infinite postponement on busy pages (ads, lazy images, analytics).
    if (elapsed >= MAX_WAIT_MS) {
      lastMutationRun = Date.now();
      handleMutation();
      return;
    }
    debounceTimer = setTimeout(() => {
      lastMutationRun = Date.now();
      handleMutation();
    }, DEBOUNCE_MS);
  };

  const handleMutation = (): void => {
    const currentUrl = window.location.href;
    const newPageType = getJustWatchPageType(currentUrl);

    // SPA navigation detected — URL changed
    if (currentUrl !== lastUrl) {
      console.log(
        '[Media Connector] JW SPA: URL changed',
        lastUrl,
        '→',
        currentUrl,
        '(',
        newPageType,
        ')',
      );
      lastUrl = currentUrl;

      // Page type changed: clean up old content and reset state
      if (newPageType !== currentPageType) {
        console.log(
          '[Media Connector] JW SPA: page type changed',
          currentPageType,
          '→',
          newPageType,
        );
        cleanupAll();
        currentPageType = newPageType;
      }

      if (newPageType === 'detail') {
        detailInjected = false;
        pauseObserver();
        document.getElementById(JUSTWATCH_CARD_ID)?.remove();
        document.getElementById(JUSTWATCH_SKELETON_ID)?.remove();
        resumeObserver();
        detectDetail();
      } else if (newPageType === 'search') {
        processSearchRows();
      } else {
        console.log('[Media Connector] JW SPA: "other" page type — skipping');
      }
      return;
    }

    // Same URL — handle in-page DOM updates
    if (currentPageType === 'detail') {
      if (detailInjected) {
        // Card was removed by a Vue re-render — re-inject
        if (!document.getElementById(JUSTWATCH_CARD_ID)) {
          console.log('[Media Connector] JW SPA: card missing from DOM, re-injecting');
          detailInjected = false;
          detectDetail();
        }
        return;
      }
      // Wait for the buybox anchor to appear
      const buybox =
        document.querySelector('.buybox-container') ?? document.getElementById('buybox-anchor');
      if (buybox) {
        console.log('[Media Connector] JW SPA: buybox found, triggering detection');
        detectDetail();
      }
    } else if (currentPageType === 'search') {
      // Check for new unprocessed rows (infinite scroll / pagination)
      const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');
      for (const row of rows) {
        if (
          !row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) &&
          row.dataset.mcProcessing !== 'true'
        ) {
          console.log('[Media Connector] JW SPA: new search rows found, processing');
          processSearchRows();
          break;
        }
      }
    }
  };

  // Initial detection
  console.log('[Media Connector] JW SPA: starting initial detection for', currentPageType);
  if (currentPageType === 'detail') {
    detectDetail();
  } else if (currentPageType === 'search') {
    processSearchRows();
  }

  // Start observing
  observer.observe(document.body, { childList: true, subtree: true });
  observerConnected = true;
  console.log('[Media Connector] JW SPA: MutationObserver attached');
};

/**
 * Show a skeleton loading placeholder on JustWatch,
 * inserted before the buybox container.
 */
const showJustWatchSkeleton = (serverLabel: string): void => {
  if (document.getElementById(JUSTWATCH_SKELETON_ID)) return;
  injectSkeletonKeyframes();

  const shimmerBg =
    'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)';
  const shimmerStyle = `background: ${shimmerBg}; background-size: 800px 100%; animation: mcShimmer 1.6s ease-in-out infinite;`;

  const skeleton = document.createElement('div');
  skeleton.id = JUSTWATCH_SKELETON_ID;
  Object.assign(skeleton.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBottom: '24px',
  });

  // Use the combined icon for JustWatch skeleton
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  skeleton.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
        <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr &middot; ${serverLabel}</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="width:60px;height:90px;border-radius:8px;flex-shrink:0;${shimmerStyle}"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px;">
        <div style="width:75%;height:14px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:40%;height:11px;border-radius:4px;${shimmerStyle}"></div>
        <div style="width:55%;height:20px;border-radius:6px;${shimmerStyle}"></div>
        <div style="width:50%;height:26px;border-radius:6px;margin-top:4px;${shimmerStyle}"></div>
      </div>
    </div>
  `;

  appendCardToJustWatchPage(skeleton);
};

/**
 * Remove the JustWatch skeleton placeholder from the DOM.
 */
const removeJustWatchSkeleton = (): void => {
  document.getElementById(JUSTWATCH_SKELETON_ID)?.remove();
};

/**
 * Build and inject the media connector card into the JustWatch page,
 * positioned before the buybox (streaming offers) section.
 */
const injectJustWatchCard = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(JUSTWATCH_CARD_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;

  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  /* ---------- outer card ---------- */
  const card = document.createElement('div');
  card.id = JUSTWATCH_CARD_ID;
  Object.assign(card.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    color: '#e8e0f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBottom: '24px',
    fontSize: '14px',
    lineHeight: '1.5',
  });

  /* ---------- header ---------- */
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  });

  // Use the combined icon for JustWatch card header
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  header.innerHTML = `
    <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
      <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr · ${serverLabel}</div>
    </div>
  `;
  card.appendChild(header);

  /* ---------- error / unconfigured states ---------- */
  if (!jellyseerrEnabled) {
    card.appendChild(
      createInfoRow(
        '⚙️',
        'Jellyseerr not configured',
        'Open the extension popup to set your Jellyseerr URL and API key.',
      ),
    );
    appendCardToJustWatchPage(card);
    return;
  }

  if (error) {
    card.appendChild(createInfoRow('⚠️', 'Connection error', error));
    appendCardToJustWatchPage(card);
    return;
  }

  if (results.length === 0) {
    card.appendChild(
      createInfoRow('🔍', 'No results', `"${queryTitle}" was not found on Jellyseerr.`),
    );
    appendCardToJustWatchPage(card);
    return;
  }

  /* ---------- result cards ---------- */
  results.forEach((item, idx) => {
    const row = buildResultRow(item, serverLabel, jellyseerrUrl);
    if (idx > 0) {
      row.style.borderTop = '1px solid rgba(255,255,255,0.06)';
      row.style.paddingTop = '12px';
    }
    card.appendChild(row);
  });

  appendCardToJustWatchPage(card);
};

/**
 * Append the media connector card to the JustWatch page.
 * Inserts before the buybox-container (the "Watch Now" / "Where to Watch"
 * streaming offers section) so it appears at the top of that list.
 */
const appendCardToJustWatchPage = (card: HTMLElement): void => {
  // Primary: insert before the buybox container
  const buyboxContainer = document.querySelector<HTMLElement>('.buybox-container');
  if (buyboxContainer) {
    console.log('[Media Connector] JW SPA: appending card before .buybox-container');
    buyboxContainer.parentElement?.insertBefore(card, buyboxContainer);
    return;
  }

  // Fallback: insert before the buybox anchor element
  const buyboxAnchor = document.getElementById('buybox-anchor');
  if (buyboxAnchor) {
    console.log('[Media Connector] JW SPA: appending card before #buybox-anchor');
    buyboxAnchor.parentElement?.insertBefore(card, buyboxAnchor);
    return;
  }

  // Fallback: insert into the title-detail content area
  const titleContent = document.querySelector<HTMLElement>('.title-detail__content');
  if (titleContent) {
    console.log('[Media Connector] JW SPA: appending card into .title-detail__content');
    titleContent.prepend(card);
    return;
  }

  // Last resort: insert after the hero details section
  const heroDetails = document.querySelector<HTMLElement>('.title-detail-hero__details');
  if (heroDetails) {
    console.log('[Media Connector] JW SPA: appending card after .title-detail-hero__details');
    heroDetails.after(card);
    return;
  }

  // Absolute fallback: prepend to main content
  console.log(
    '[Media Connector] JW SPA: appending card to fallback container (#__layout / main / body)',
  );
  const main =
    document.querySelector<HTMLElement>('#__layout') ??
    document.querySelector<HTMLElement>('main') ??
    document.body;
  main.prepend(card);
};

/* ------------------------------------------------------------------ */
/*  JustWatch SEARCH results — per-row "Play on" button below title   */
/* ------------------------------------------------------------------ */

const JUSTWATCH_SEARCH_BADGE_CLASS = 'media-connector-jw-search-badge';

/**
 * Extract title and media type from a JustWatch search result row.
 * The `.title-list-row__column-header` link contains an href like:
 *   /us/movie/the-man-in-the-iron-mask
 *   /us/tv-show/fbi
 */
const parseJustWatchSearchRow = (
  row: HTMLElement,
): { title: string; year?: number; mediaType: 'movie' | 'tv' } | undefined => {
  const link = row.querySelector<HTMLAnchorElement>('.title-list-row__column-header');
  if (!link) return undefined;

  const href = link.getAttribute('href') ?? '';
  const isMovie = /\/movie\//.test(href);
  const isTvShow = /\/tv-show\//.test(href);
  if (!isMovie && !isTvShow) return undefined;

  // Extract title from the link text content (the anchor wraps the title text)
  const rawTitle = link.textContent?.trim();
  if (!rawTitle) return undefined;

  // Extract and strip trailing year like "(1998)"
  const yearMatch = rawTitle.match(/\s*\((\d{4})\)\s*$/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  const title = rawTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  if (!title) return undefined;

  return {
    title,
    year,
    mediaType: isMovie ? 'movie' : 'tv',
  };
};

/**
 * Process a single JustWatch search result row:
 * query Jellyseerr, then insert a wide "Play on …" button below the title.
 */
const processJustWatchSearchRow = async (
  row: HTMLElement,
  serverLabel: string,
  serverType: string,
): Promise<void> => {
  // Don't double-process — check both the final badge AND the in-progress marker
  if (row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`)) return;
  if (row.dataset.mcProcessing === 'true') return;

  // Mark as in-progress immediately to prevent re-entry during async gap
  row.dataset.mcProcessing = 'true';

  const parsed = parseJustWatchSearchRow(row);
  if (!parsed) {
    console.log('[Media Connector] JW Search: could not parse row, skipping');
    return;
  }

  const { title, year, mediaType } = parsed;
  console.log('[Media Connector] JW Search: processing row:', title, year, mediaType);

  // Find the title link to insert the button after it
  const titleLink = row.querySelector<HTMLAnchorElement>('.title-list-row__column-header');
  if (!titleLink) {
    console.log('[Media Connector] JW Search: no title link found for', title);
    return;
  }

  const isJellyfin = serverType === 'jellyfin';
  const serverIcon = isJellyfin ? JELLYFIN_SVG : EMBY_SVG;
  const serverBg = isJellyfin ? '#00A4DC' : '#52B54B';
  const serverBgHover = isJellyfin ? '#0088B8' : '#43A047';

  // Create a shimmer loading placeholder button
  injectSkeletonKeyframes();
  const placeholder = document.createElement('div');
  placeholder.className = JUSTWATCH_SEARCH_BADGE_CLASS;
  Object.assign(placeholder.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    height: '32px',
    borderRadius: '8px',
    marginTop: '8px',
    marginInline: '1rem',
    background:
      'linear-gradient(90deg, rgba(123,47,190,0.08) 25%, rgba(123,47,190,0.18) 50%, rgba(123,47,190,0.08) 75%)',
    backgroundSize: '800px 100%',
    animation: 'mcShimmer 1.6s ease-in-out infinite',
  });
  titleLink.insertAdjacentElement('afterend', placeholder);

  // Query Jellyseerr
  const response = await sendMessage<SearchJellyseerrResponse>({
    type: 'SEARCH_JELLYSEERR',
    payload: { query: title, mediaType, year },
  });

  // Remove placeholder
  placeholder.remove();

  if (!response) {
    console.log('[Media Connector] JW Search: no response for', title);
    return;
  }

  const { results, jellyseerrEnabled, error, jellyseerrUrl } = response.payload;
  console.log('[Media Connector] JW Search: response for', title, {
    jellyseerrEnabled,
    error,
    resultCount: results.length,
  });

  if (!jellyseerrEnabled || error || results.length === 0) {
    console.log('[Media Connector] JW Search: skipping', title, '- no usable results');
    return;
  }

  // Use the first (best) result
  const item = results[0];

  // Build the wide button
  const btn = document.createElement('a');
  btn.className = JUSTWATCH_SEARCH_BADGE_CLASS;
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');

  const baseBtnStyles: Partial<CSSStyleDeclaration> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '8px',
    marginTop: '8px',
    marginInline: '1rem',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
    lineHeight: '1.4',
    whiteSpace: 'nowrap',
    width: 'fit-content',
    maxWidth: '100%',
  };

  // Scale the SVG down to fit inside the button
  const iconHtml = `<span style="display:inline-flex;width:18px;height:18px;flex-shrink:0;">${serverIcon.replace(/width="48" height="48"/, 'width="18" height="18"')}</span>`;

  if (item.status === 'available' || item.status === 'partial') {
    Object.assign(btn.style, {
      ...baseBtnStyles,
      background: serverBg,
      color: '#fff',
      boxShadow: `0 2px 8px ${serverBg}55`,
    });

    const statusNote = item.status === 'partial' ? ' (partial)' : '';
    btn.innerHTML = `${iconHtml}<span>▶ Play on ${serverLabel}${statusNote}</span>`;

    if (item.serverItemUrl) {
      btn.href = item.serverItemUrl;
      btn.target = '_blank';
      btn.rel = 'noopener';
    }

    btn.addEventListener('mouseenter', () => {
      btn.style.background = serverBgHover;
      btn.style.boxShadow = `0 4px 14px ${serverBg}77`;
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = serverBg;
      btn.style.boxShadow = `0 2px 8px ${serverBg}55`;
      btn.style.transform = 'translateY(0)';
    });
  } else if (item.status === 'pending' || item.status === 'processing') {
    Object.assign(btn.style, {
      ...baseBtnStyles,
      background: '#616161',
      color: '#ccc',
      cursor: jellyseerrUrl ? 'pointer' : 'default',
    });
    btn.innerHTML = `${iconHtml}<span>⏳ Request Pending</span>`;

    if (jellyseerrUrl) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = item.mediaType === 'movie' ? 'movie' : 'tv';
        const url = `${jellyseerrUrl}/${slug}/${item.id}`;
        console.log('[Media Connector] Opening via service worker:', url);
        sendMessage({ type: 'OPEN_TAB', payload: { url } });
      });
    }
  } else {
    // Not requested — allow requesting
    Object.assign(btn.style, {
      ...baseBtnStyles,
      background: 'rgba(123, 47, 190, 0.2)',
      color: '#d0bcff',
      border: '1px solid rgba(123, 47, 190, 0.5)',
    });
    btn.innerHTML = `${iconHtml}<span>＋ Request on ${serverLabel}</span>`;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(123, 47, 190, 0.35)';
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(123, 47, 190, 0.2)';
      btn.style.transform = 'translateY(0)';
    });

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const label = btn.querySelector('span:last-child');
      if (label) label.textContent = 'Requesting…';
      btn.style.opacity = '0.6';
      btn.style.pointerEvents = 'none';

      const ok = await requestFromSidebar(item);

      if (ok) {
        if (label) label.textContent = `✓ Requested on ${serverLabel}!`;
        btn.style.background = '#4CAF50';
        btn.style.color = '#fff';
        btn.style.border = '1px solid #4CAF50';
        btn.style.opacity = '1';
      } else {
        if (label) label.textContent = '✗ Failed — click to retry';
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        setTimeout(() => {
          if (label) label.textContent = `＋ Request on ${serverLabel}`;
        }, 3000);
      }
    });
  }

  console.log('[Media Connector] JW Search: inserting button for', title, 'status:', item.status);
  titleLink.insertAdjacentElement('afterend', btn);
  console.log(
    '[Media Connector] JW Search: button inserted for',
    title,
    '- in DOM:',
    document.contains(btn),
  );
};

const initSearchEngineSidebar = async (): Promise<void> => {
  const media = tryDetectMedia();
  if (!media) {
    console.log('[Media Connector] No media detected on page');
    return;
  }

  const title =
    media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

  const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

  console.log('[Media Connector] Detected media:', {
    title,
    mediaType,
    year: media.year,
  });

  // Fetch config first (fast local storage read) so the skeleton header
  // can display the correct server label immediately.
  const configRes = await sendMessage<GetConfigResponse>({
    type: 'GET_CONFIG',
  });
  const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  // Show skeleton while we wait for the Jellyseerr response
  showSkeleton(serverLabel);

  const response = await sendMessage<SearchJellyseerrResponse>({
    type: 'SEARCH_JELLYSEERR',
    payload: { query: title, mediaType, year: media.year },
  });

  // Remove skeleton regardless of outcome
  removeSkeleton();

  if (!response) {
    console.log('[Media Connector] No response from service worker');
    return;
  }

  console.log('[Media Connector] Jellyseerr response:', response);
  injectSidebar(response, title);
};

/* ------------------------------------------------------------------ */
/*  Sidebar injection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Build and inject the sidebar card into the search results page.
 */
const injectSidebar = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(SIDEBAR_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;

  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  /* ---------- outer card ---------- */
  const card = document.createElement('div');
  card.id = SIDEBAR_ID;
  Object.assign(card.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    color: '#e8e0f0',
    maxWidth: '360px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBlock: '1rem',
    fontSize: '14px',
    lineHeight: '1.5',
  });

  /* ---------- header ---------- */
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  });

  // Use the combined icon for search engine sidebar header
  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  header.innerHTML = `
    <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
      <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr · ${serverLabel}</div>
    </div>
  `;
  card.appendChild(header);

  /* ---------- error / unconfigured states ---------- */
  if (!jellyseerrEnabled) {
    card.appendChild(
      createInfoRow(
        '⚙️',
        'Jellyseerr not configured',
        'Open the extension popup to set your Jellyseerr URL and API key.',
      ),
    );
    appendSidebarToPage(card);
    return;
  }

  if (error) {
    card.appendChild(createInfoRow('⚠️', 'Connection error', error));
    appendSidebarToPage(card);
    return;
  }

  if (results.length === 0) {
    card.appendChild(
      createInfoRow('🔍', 'No results', `"${queryTitle}" was not found on Jellyseerr.`),
    );
    appendSidebarToPage(card);
    return;
  }

  /* ---------- result cards ---------- */
  results.forEach((item, idx) => {
    const row = buildResultRow(item, serverLabel, jellyseerrUrl);
    if (idx > 0) {
      row.style.borderTop = '1px solid rgba(255,255,255,0.06)';
      row.style.paddingTop = '12px';
    }
    card.appendChild(row);
  });

  appendSidebarToPage(card);
};

/**
 * Create a simple info/status row with emoji, title, and description.
 */
const createInfoRow = (emoji: string, title: string, description: string): HTMLDivElement => {
  const row = document.createElement('div');
  Object.assign(row.style, { padding: '8px 0' });
  row.innerHTML = `
    <div style="font-weight:600;font-size:14px;margin-bottom:4px;">
      ${emoji} ${title}
    </div>
    <div style="font-size:12px;color:#a89cc0;">${description}</div>
  `;
  return row;
};

/**
 * Build a single result row with poster, title, status badge, and request button.
 */
const buildResultRow = (
  item: JellyseerrResultItem,
  serverLabel: string,
  jellyseerrUrl?: string,
): HTMLDivElement => {
  const row = document.createElement('div');
  Object.assign(row.style, {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'flex-start',
  });

  /* poster */
  const poster = document.createElement('div');
  Object.assign(poster.style, {
    width: '60px',
    minWidth: '60px',
    height: '90px',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#2a2040',
    flexShrink: '0',
  });
  if (item.posterUrl) {
    poster.innerHTML = `<img src="${item.posterUrl}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover;" />`;
  } else {
    poster.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;">🎬</div>`;
  }
  row.appendChild(poster);

  /* info column */
  const info = document.createElement('div');
  Object.assign(info.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1',
    minWidth: '0',
  });

  const typeLabel = item.mediaType === 'movie' ? 'Movie' : 'TV Show';
  const yearStr = item.year ? ` (${item.year})` : '';

  info.innerHTML = `
    <div style="font-weight:600;font-size:14px;color:#f0e8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      ${item.title}${yearStr}
    </div>
    <div style="font-size:11px;color:#a89cc0;">${typeLabel}</div>
    ${buildStatusBadge(item.status)}
  `;

  /* action buttons */
  const btnContainer = document.createElement('div');
  Object.assign(btnContainer.style, {
    marginTop: '6px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  });

  /* Server-type-based button colors: Emby = green, Jellyfin = blue/purple */
  const isJellyfin = serverLabel === 'Jellyfin';
  const serverBtnBg = isJellyfin ? '#00A4DC' : '#4CAF50';
  const serverBtnHover = isJellyfin ? '#0088B8' : '#388E3C';

  if (item.status === 'available' || item.status === 'partial') {
    /* "Play on [server]" → opens the media server web UI (deep link). */
    if (item.serverItemUrl) {
      const serverBtn = createActionButton('▶ Play on ' + serverLabel, serverBtnBg, serverBtnHover);
      serverBtn.addEventListener('click', () => {
        window.open(item.serverItemUrl, '_blank');
      });
      btnContainer.appendChild(serverBtn);
    }
    /* "Manage in Jellyseerr" → opens via service worker to bypass SameSite cookies */
    if (jellyseerrUrl) {
      const slug = item.mediaType === 'movie' ? 'movie' : 'tv';
      const manageBtn = createActionButton('Manage in Jellyseerr', '#7B2FBE', '#5E1F9B');
      manageBtn.addEventListener('click', () => {
        const url = `${jellyseerrUrl}/${slug}/${item.id}`;
        console.log('[Media Connector] Opening via service worker:', url);
        sendMessage({ type: 'OPEN_TAB', payload: { url } });
      });
      btnContainer.appendChild(manageBtn);
    }
  } else if (item.status === 'pending' || item.status === 'processing') {
    const pendingBtn = createActionButton('⏳ Request Pending', '#616161', '#424242');
    if (jellyseerrUrl) {
      const slug = item.mediaType === 'movie' ? 'movie' : 'tv';
      pendingBtn.style.cursor = 'pointer';
      pendingBtn.addEventListener('click', () => {
        const url = `${jellyseerrUrl}/${slug}/${item.id}`;
        console.log('[Media Connector] Opening via service worker:', url);
        sendMessage({ type: 'OPEN_TAB', payload: { url } });
      });
    } else {
      pendingBtn.style.cursor = 'default';
    }
    btnContainer.appendChild(pendingBtn);
  } else {
    /* not_requested / unknown */
    const reqBtn = createActionButton('＋ Request', '#7B2FBE', '#5E1F9B');
    reqBtn.addEventListener('click', () => {
      reqBtn.textContent = 'Requesting…';
      reqBtn.style.opacity = '0.7';
      reqBtn.style.pointerEvents = 'none';
      requestFromSidebar(item).then((ok) => {
        if (ok) {
          reqBtn.textContent = '✓ Requested!';
          reqBtn.style.background = '#4CAF50';
        } else {
          reqBtn.textContent = '✗ Failed';
          reqBtn.style.background = '#c62828';
          setTimeout(() => {
            reqBtn.textContent = '＋ Request';
            reqBtn.style.background = '#7B2FBE';
            reqBtn.style.opacity = '1';
            reqBtn.style.pointerEvents = 'auto';
          }, 3000);
        }
      });
    });
    btnContainer.appendChild(reqBtn);
  }

  info.appendChild(btnContainer);
  row.appendChild(info);
  return row;
};

/**
 * Build an HTML string for a status badge.
 */
const buildStatusBadge = (status: JellyseerrResultItem['status']): string => {
  const map: Record<JellyseerrResultItem['status'], { label: string; bg: string; fg: string }> = {
    available: {
      label: '✓ Available',
      bg: 'rgba(76,175,80,0.15)',
      fg: '#81C784',
    },
    partial: { label: '◐ Partial', bg: 'rgba(255,152,0,0.15)', fg: '#FFB74D' },
    pending: { label: '⏳ Pending', bg: 'rgba(97,97,97,0.2)', fg: '#BDBDBD' },
    processing: {
      label: '⚙ Processing',
      bg: 'rgba(97,97,97,0.2)',
      fg: '#BDBDBD',
    },
    unknown: { label: '? Unknown', bg: 'rgba(97,97,97,0.2)', fg: '#BDBDBD' },
    not_requested: {
      label: 'Not in library',
      bg: 'rgba(123,47,190,0.15)',
      fg: '#CE93D8',
    },
  };

  const { label, bg, fg } = map[status];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${bg};color:${fg};">${label}</span>`;
};

/**
 * Create a styled action button.
 */
const createActionButton = (text: string, bg: string, hoverBg: string): HTMLButtonElement => {
  const btn = document.createElement('button');
  btn.textContent = text;
  Object.assign(btn.style, {
    display: 'inline-block',
    padding: '5px 12px',
    border: 'none',
    borderRadius: '6px',
    background: bg,
    color: '#fff',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.15s',
    lineHeight: '1.4',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.background = hoverBg;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = bg;
  });
  return btn;
};

/**
 * Request an item via Jellyseerr from the sidebar.
 */
const requestFromSidebar = async (item: JellyseerrResultItem): Promise<boolean> => {
  const mediaType = item.mediaType === 'movie' ? ('movie' as const) : ('series' as const);

  console.log(
    '[Media Connector] Requesting media:',
    '\n  Title:',
    item.title,
    '\n  TMDb ID:',
    item.id,
    '\n  Type:',
    mediaType,
    '\n  (server details will appear in the service worker console)',
  );

  const response = await sendMessage<RequestMediaResponse>({
    type: 'REQUEST_MEDIA',
    payload: {
      title: item.title,
      year: item.year,
      tmdbId: String(item.id),
      mediaType,
    },
  });

  console.log(
    '[Media Connector] Request response:',
    '\n  Success:',
    response?.payload.success ?? false,
    '\n  Message:',
    response?.payload.message ?? '(no response)',
  );

  return response?.payload.success ?? false;
};

/**
 * Append the sidebar card to the appropriate location in Google or Bing.
 *
 * Google: insert above the first search result in the center column.
 * Bing:   full-width card above AI-generated content (`#b_results`).
 * Fallback: fixed-position panel on the right.
 */
const appendSidebarToPage = (card: HTMLDivElement): void => {
  const site = identifySite(window.location.href);

  if (site === 'google') {
    // Make the card span the full content width
    card.style.maxWidth = '100%';
    card.style.width = '100%';
    card.style.boxSizing = 'border-box';

    // Try inserting above the organic search results (#rso)
    const rso = document.getElementById('rso');
    if (rso) {
      rso.parentElement?.insertBefore(card, rso);
      return;
    }
    // Fallback: prepend into #center_col (the main results column)
    const centerCol = document.getElementById('center_col');
    if (centerCol) {
      centerCol.prepend(card);
      return;
    }
    // Fallback: prepend into #search
    const search = document.getElementById('search');
    if (search) {
      search.prepend(card);
      return;
    }
  }

  if (site === 'bing') {
    // Bing: place as a full-width card above the AI-generated results.
    // Make the card span the full content width.
    card.style.maxWidth = '100%';
    card.style.width = 'calc(100% - 5rem)';
    card.style.boxSizing = 'border-box';

    // Insert before #b_results (the AI-generated + organic results list)
    const bResults = document.getElementById('b_results');
    if (bResults) {
      bResults.parentElement?.insertBefore(card, bResults);
      return;
    }
    // Fallback: insert before #b_content main content area
    const bContent = document.getElementById('b_content');
    if (bContent) {
      bContent.prepend(card);
      return;
    }
  }

  // Fallback: fixed position
  Object.assign(card.style, {
    position: 'fixed',
    top: '80px',
    right: '20px',
    zIndex: '99999',
    width: '340px',
  });
  document.body.appendChild(card);
};

/**
 * Inject the media status indicator into the page.
 */
const injectStatusIndicator = (response: CheckMediaResponse, _mediaType: string): void => {
  // Remove existing indicator if present
  const existing = document.getElementById('media-connector-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.id = 'media-connector-indicator';

  // Base styles for the indicator
  Object.assign(indicator.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.2s',
    opacity: '0',
    transform: 'translateY(10px)',
  });

  if (response.payload.status === 'available' && response.payload.itemUrl) {
    indicator.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    indicator.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
      </svg>
      <span>Available on Server</span>
    `;
    indicator.addEventListener('click', () => {
      window.open(response.payload.itemUrl, '_blank');
    });
  } else if (response.payload.status === 'partial' && response.payload.itemUrl) {
    indicator.style.background = 'linear-gradient(135deg, #FF9800, #E65100)';
    indicator.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
      <span>${response.payload.details ?? 'Partially available'}</span>
    `;
    indicator.addEventListener('click', () => {
      window.open(response.payload.itemUrl, '_blank');
    });
  } else if (response.payload.status === 'unavailable') {
    indicator.style.background = 'linear-gradient(135deg, #7B2FBE, #4A0E78)';
    indicator.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      <span>Request with Jellyseerr</span>
    `;
    indicator.addEventListener('click', () => {
      handleRequestClick();
    });
  } else if (response.payload.status === 'unconfigured') {
    indicator.style.background = 'linear-gradient(135deg, #616161, #424242)';
    indicator.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
      </svg>
      <span>Configure Extension</span>
    `;
  } else {
    // Error or loading state - don't show
    return;
  }

  // Add close button
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  Object.assign(closeBtn.style, {
    marginLeft: '8px',
    fontSize: '18px',
    cursor: 'pointer',
    opacity: '0.7',
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    indicator.style.opacity = '0';
    indicator.style.transform = 'translateY(10px)';
    setTimeout(() => indicator.remove(), 200);
  });
  indicator.appendChild(closeBtn);

  document.body.appendChild(indicator);

  // Animate in
  requestAnimationFrame(() => {
    indicator.style.opacity = '1';
    indicator.style.transform = 'translateY(0)';
  });
};

/**
 * Handle click on the request button - sends request via Jellyseerr.
 */
const handleRequestClick = async (): Promise<void> => {
  const media = tryDetectMedia();
  if (!media) return;

  const title =
    media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

  const mediaType = media.type === 'movie' ? ('movie' as const) : ('series' as const);

  const response = await sendMessage<RequestMediaResponse>({
    type: 'REQUEST_MEDIA',
    payload: {
      title,
      year: media.year,
      tmdbId: media.tmdbId,
      imdbId: media.imdbId,
      mediaType,
    },
  });

  if (response?.payload.success) {
    alert(`Successfully requested "${title}" via Jellyseerr!`);
  } else {
    alert(`Failed to request "${title}": ${response?.payload.message || 'Unknown error'}`);
  }
};

init();
