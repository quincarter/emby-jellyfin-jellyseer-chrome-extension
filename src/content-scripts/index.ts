import { detectMedia, identifySite } from './detect-media.js';
import { buildCheckPayload } from './helpers.js';
import type {
  CheckMediaResponse,
  GetConfigResponse,
  RequestMediaResponse,
  SearchJellyseerrResponse,
  JellyseerrResultItem,
} from '../types/messages.js';

/** Raw Emby SVG string for injection into non-Lit DOM. */
const EMBY_SVG = `<svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Emby"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z" fill="#52B54B"/><path d="M152 130l208 126-208 126V130z" fill="#FFFFFF"/></svg>`;

/** Raw Jellyfin SVG string for injection into non-Lit DOM. */
const JELLYFIN_SVG = `<svg width="48" height="48" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Jellyfin"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z" fill="#00A4DC"/><path d="M256 96c-88.4 0-160 71.6-160 160s71.6 160 160 160 160-71.6 160-160S344.4 96 256 96zm0 272c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z" fill="#FFFFFF" opacity="0.6"/><path d="M256 176c-44.2 0-80 35.8-80 80s35.8 80 80 80 80-35.8 80-80-35.8-80-80-80zm0 112c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z" fill="#FFFFFF"/></svg>`;

/**
 * Content script entry point.
 * Detects media on the current page and injects the status indicator.
 * For SPA sites like Trakt (Svelte), uses a persistent MutationObserver
 * to survive framework re-renders and SPA navigations.
 */
const init = async (): Promise<void> => {
  const site = identifySite(window.location.href);
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

  // JustWatch: search results page gets per-row provider icons,
  // title detail pages get a full card in the buybox area
  if (site === 'justwatch') {
    if (window.location.pathname.includes('/search')) {
      initJustWatchSearch();
    } else {
      initJustWatch();
    }
    return;
  }

  // Non-SPA sites: detect once and inject
  const media = detectMedia();
  if (!media) return;

  const response = await sendMessage<CheckMediaResponse>({
    type: 'CHECK_MEDIA',
    payload: buildCheckPayload(media),
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
      const media = detectMedia();
      if (!media) return;

      const response = await sendMessage<CheckMediaResponse>({
        type: 'CHECK_MEDIA',
        payload: buildCheckPayload(media),
      });

      if (response) {
        cachedResponse = response;
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
 * Attempt to inject the server item into Trakt's "Where to Watch" list.
 * Called both on initial detection and whenever Svelte re-renders the section.
 * This is a synchronous injection — the persistent observer in initTrakt()
 * handles re-calling this when the element is removed.
 */
const tryInjectTraktItem = (response: CheckMediaResponse): void => {
  // Determine what kind of item to show
  const canLink =
    (response.payload.status === 'available' || response.payload.status === 'partial') &&
    response.payload.itemUrl;

  const canRequest = response.payload.status === 'unavailable';

  const isUnconfigured = response.payload.status === 'unconfigured';

  // If error or unexpected status, skip
  if (!canLink && !canRequest && !isUnconfigured) return;

  // Always try the legacy action-buttons injection (classic trakt.tv)
  tryInjectTraktLegacyButton(response);

  // If error or unexpected status, skip
  if (!canLink && !canRequest && !isUnconfigured) return;

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
          <p style="${labelStyle}">${labelText}</p>
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
  } else {
    labelText = `Set up ${serverLabel}`;
    item.innerHTML = `
      <div class="where-to-watch-item-content" style="${contentStyle} cursor: pointer; opacity: 0.6;">
        <div class="trakt-streaming-service-logo" style="${logoContainerStyle}">
          ${logoSvg}
        </div>
        <p style="${labelStyle}">${labelText}</p>
      </div>`;
  }

  // Apply item-level styles (no border/ring — matches native items)
  item.setAttribute('style', itemStyle);

  // Prepend as the first item in the list
  listContainer.prepend(item);
};

/**
 * Inject a "Play on Emby/Jellyfin" button into Trakt's legacy action-buttons area.
 * The button is inserted above the "Check In" button (.btn-checkin).
 * This targets the classic trakt.tv experience (not app.trakt.tv).
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

  if (!canLink && !canRequest && !isUnconfigured) return;

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
  } else {
    btn.href = '#';
    btn.style.opacity = '0.6';
    btn.innerHTML = `
      <div class="fa fa-fw" style="display:inline-flex;align-items:center;justify-content:center;width:1.28571429em;">${iconHtml}</div>
      <div class="text">
        <div class="main-info">Set up ${serverLabel}</div>
      </div>`;
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

  skeleton.innerHTML = `
    <!-- real header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      ${JELLYSEERR_LOGO}
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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
  const media = detectMedia();
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

  skeleton.innerHTML = `
    <!-- real header -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      ${JELLYSEERR_LOGO}
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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
  header.innerHTML = `
    ${JELLYSEERR_LOGO}
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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
 * JustWatch-specific init.
 * JustWatch is a Vue/Nuxt SPA, so we use a MutationObserver to handle
 * client-side navigations and Vue re-renders (similar to Trakt).
 *
 * The card is injected before the "buybox-container" — the "Watch Now" /
 * "Where to Watch" streaming offers section.
 */
const initJustWatch = (): void => {
  let lastUrl = window.location.href;
  let injected = false;
  let detecting = false;

  const detect = async (): Promise<void> => {
    if (detecting || injected) return;
    detecting = true;

    try {
      const media = detectMedia();
      if (!media) return;

      const title =
        media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

      const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

      console.log('[Media Connector] JustWatch detected media:', {
        title,
        mediaType,
        year: media.year,
      });

      // Fetch config for server label
      const configRes = await sendMessage<GetConfigResponse>({
        type: 'GET_CONFIG',
      });
      const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

      // Show skeleton while waiting for Jellyseerr
      showJustWatchSkeleton(serverLabel);

      const response = await sendMessage<SearchJellyseerrResponse>({
        type: 'SEARCH_JELLYSEERR',
        payload: { query: title, mediaType, year: media.year },
      });

      // Remove skeleton
      removeJustWatchSkeleton();

      if (!response) {
        console.log('[Media Connector] No response from service worker');
        return;
      }

      console.log('[Media Connector] Jellyseerr response:', response);
      injectJustWatchCard(response, title);
      injected = true;
    } finally {
      detecting = false;
    }
  };

  const onMutation = (): void => {
    const currentUrl = window.location.href;

    // SPA navigation — URL changed, reset and re-detect
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      injected = false;
      // Clean up old card/skeleton
      document.getElementById(JUSTWATCH_CARD_ID)?.remove();
      document.getElementById(JUSTWATCH_SKELETON_ID)?.remove();
      detect();
      return;
    }

    // If we already injected, make sure the card is still in the DOM
    if (injected) {
      if (!document.getElementById(JUSTWATCH_CARD_ID)) {
        injected = false;
        detect();
      }
      return;
    }

    // Haven't detected yet — wait for the buybox anchor to appear
    const buybox =
      document.querySelector('.buybox-container') ?? document.getElementById('buybox-anchor');
    if (buybox) {
      detect();
    }
  };

  // Try immediately, then observe for Vue renders
  detect();

  const observer = new MutationObserver(() => onMutation());
  observer.observe(document.body, { childList: true, subtree: true });
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

  skeleton.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      ${JELLYSEERR_LOGO}
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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
  header.innerHTML = `
    ${JELLYSEERR_LOGO}
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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
    buyboxContainer.parentElement?.insertBefore(card, buyboxContainer);
    return;
  }

  // Fallback: insert before the buybox anchor element
  const buyboxAnchor = document.getElementById('buybox-anchor');
  if (buyboxAnchor) {
    buyboxAnchor.parentElement?.insertBefore(card, buyboxAnchor);
    return;
  }

  // Fallback: insert into the title-detail content area
  const titleContent = document.querySelector<HTMLElement>('.title-detail__content');
  if (titleContent) {
    titleContent.prepend(card);
    return;
  }

  // Last resort: insert after the hero details section
  const heroDetails = document.querySelector<HTMLElement>('.title-detail-hero__details');
  if (heroDetails) {
    heroDetails.after(card);
    return;
  }

  // Absolute fallback: prepend to main content
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

  const { results, jellyseerrEnabled, error } = response.payload;
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
      cursor: 'default',
    });
    btn.innerHTML = `${iconHtml}<span>⏳ Request Pending</span>`;
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

/**
 * JustWatch search results page init.
 * Uses a MutationObserver to handle dynamically loaded results and SPA navigations.
 * For each search result row, injects a wide "Play on …" / "Request on …" button
 * below the title link.
 */
const initJustWatchSearch = (): void => {
  console.log('[Media Connector] JW Search: initializing search page handler');
  let lastUrl = window.location.href;
  let serverLabel = 'Emby';
  let serverType = 'emby';
  let processing = false;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const processAllRows = async (): Promise<void> => {
    // Guard against re-entry (our own DOM writes trigger the observer)
    if (processing) {
      console.log('[Media Connector] JW Search: skipping — already processing');
      return;
    }
    processing = true;

    try {
      // Fetch config once for server type
      const configRes = await sendMessage<GetConfigResponse>({
        type: 'GET_CONFIG',
      });
      serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
      serverType = configRes?.payload.serverType ?? 'emby';

      const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');

      console.log('[Media Connector] JW Search: found', rows.length, 'total rows');

      let skipped = 0;
      let queued = 0;
      for (const row of rows) {
        // Skip rows already processed or in-progress
        if (
          row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) ||
          row.dataset.mcProcessing === 'true'
        ) {
          skipped++;
          continue;
        }
        queued++;
        // Process each row sequentially to avoid overwhelming the API
        await processJustWatchSearchRow(row, serverLabel, serverType);
      }
      console.log('[Media Connector] JW Search: processed', queued, 'rows, skipped', skipped);
    } finally {
      processing = false;
    }
  };

  const scheduleProcessing = (): void => {
    // Debounce: wait 300ms after last mutation before processing
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processAllRows();
    }, 300);
  };

  const onMutation = (): void => {
    const currentUrl = window.location.href;

    // SPA navigation detected
    if (currentUrl !== lastUrl) {
      console.log('[Media Connector] JW Search: URL changed to', currentUrl);
      lastUrl = currentUrl;
      // If navigated away from search, stop observing
      if (!currentUrl.includes('/search')) return;
      scheduleProcessing();
      return;
    }

    // Only schedule if there are unprocessed rows
    const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');
    let hasNew = false;
    for (const row of rows) {
      if (
        !row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) &&
        row.dataset.mcProcessing !== 'true'
      ) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) {
      scheduleProcessing();
    }
  };

  // Initial processing
  processAllRows();

  // Observe for dynamically loaded rows (infinite scroll, pagination, SPA nav)
  const observer = new MutationObserver(() => onMutation());
  observer.observe(document.body, { childList: true, subtree: true });
};

const initSearchEngineSidebar = async (): Promise<void> => {
  const media = detectMedia();
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
/*  SVG icons (small, for sidebar use)                                */
/* ------------------------------------------------------------------ */

const JELLYSEERR_LOGO = `<svg width="24" height="24" viewBox="0 0 237 237" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="118.5" cy="118.5" r="118.5" fill="url(#jsr_g)"/><path d="M118.5 48c-38.9 0-70.5 31.6-70.5 70.5S79.6 189 118.5 189 189 157.4 189 118.5 157.4 48 118.5 48zm0 113c-23.5 0-42.5-19-42.5-42.5S95 76 118.5 76 161 95 161 118.5 142 161 118.5 161z" fill="#fff" opacity=".7"/><circle cx="118.5" cy="118.5" r="25" fill="#fff"/><defs><linearGradient id="jsr_g" x1="0" y1="0" x2="237" y2="237" gradientUnits="userSpaceOnUse"><stop stop-color="#7B2FBE"/><stop offset="1" stop-color="#4A148C"/></linearGradient></defs></svg>`;

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
  header.innerHTML = `
    ${JELLYSEERR_LOGO}
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">Media Server Connector</div>
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

  /* Server-type-based button colors: Emby = green, Jellyfin = purple */
  const isJellyfin = serverLabel === 'Jellyfin';
  const serverBtnBg = isJellyfin ? '#7B2FBE' : '#4CAF50';
  const serverBtnHover = isJellyfin ? '#5E1F9B' : '#388E3C';

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
    pendingBtn.style.cursor = 'default';
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
  const media = detectMedia();
  if (!media) return;

  const title =
    media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;

  const mediaType = media.type === 'movie' ? ('movie' as const) : ('series' as const);

  const response = await sendMessage<RequestMediaResponse>({
    type: 'REQUEST_MEDIA',
    payload: {
      title,
      year: media.year,
      imdbId: media.imdbId,
      tmdbId: media.tmdbId,
      mediaType,
    },
  });

  const indicator =
    document.getElementById('media-connector-indicator') ??
    document.getElementById('media-connector-wtw-item');
  if (!indicator) return;

  if (response?.payload.success) {
    const textEl = indicator.querySelector('p') ?? indicator.querySelector('span');
    if (textEl) textEl.textContent = 'Requested!';
  } else {
    const textEl = indicator.querySelector('p') ?? indicator.querySelector('span');
    if (textEl) textEl.textContent = response?.payload.message ?? 'Request failed';
  }
};

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
