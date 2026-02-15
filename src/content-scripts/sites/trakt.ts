import { EMBY_SVG, JELLYFIN_SVG, sendMessage, handleRequestClick } from '../common-ui.js';
import { tryDetectMedia, buildPayload } from '../index.js';
import type { CheckMediaResponse } from '../../types/messages.js';

/**
 * Trakt-specific init.
 */
export const initTrakt = (): void => {
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
        tryInjectTraktRow(response);
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
      const rowExists = document.getElementById('media-connector-trakt-row');
      if (!wtwExists || !legacyExists || !rowExists) {
        tryInjectTraktLegacyButton(cachedResponse);
        tryInjectTraktItem(cachedResponse);
        tryInjectTraktRow(cachedResponse);
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
};

/**
 * Modern Trakt UI: Attempt to inject the server item into "Where to Watch" list.
 */
export const tryInjectTraktItem = (response: CheckMediaResponse): void => {
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
    return;
  }

  // Apply item-level styles (no border/ring — matches native items)
  item.setAttribute(
    'style',
    `
    width: 6rem;
    height: 6rem;
    scroll-snap-align: start;
    flex-shrink: 0;
    background-color: var(--color-card-background);
    border-radius: 12px;
  `.replace(/\n/g, ''),
  );

  // Prepend as the first item in the list
  listContainer.prepend(item);
};

/**
 * Inject a "Play on Emby/Jellyfin" button into Trakt's legacy action-buttons area.
 */
export const tryInjectTraktLegacyButton = (response: CheckMediaResponse): void => {
  const TRAKT_ACTION_BTN_ID = 'media-connector-trakt-action-btn';
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
 * Modern Trakt UI: Inject a row into the sidebar info section.
 */
export const tryInjectTraktRow = (response: CheckMediaResponse): void => {
  const TRAKT_SIDEBAR_ROW_ID = 'media-connector-trakt-row';
  if (document.getElementById(TRAKT_SIDEBAR_ROW_ID)) return;

  const sidebar = document.querySelector('.sidebar-info');
  if (!sidebar) return;

  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const logoSvg = serverType === 'jellyfin' ? JELLYFIN_SVG : EMBY_SVG;
  const status = response.payload.status;

  const row = document.createElement('div');
  row.id = TRAKT_SIDEBAR_ROW_ID;
  row.className = 'info-row';
  row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 8px;';

  const iconHtml = logoSvg
    .replace(/width="48"/, 'width="18"')
    .replace(/height="48"/, 'height="18"');

  let content = `<div style="display:flex;align-items:center;">${iconHtml}</div>`;

  if (status === 'available' || status === 'partial') {
    const label = status === 'partial' ? `${serverLabel} (Partial)` : serverLabel;
    content += `<div style="font-weight: 600;">Available on <a href="${response.payload.itemUrl}" target="_blank" style="color: #ed1c24;">${label}</a></div>`;
  } else if (status === 'unavailable') {
    content += `<div style="font-weight: 600;">Request with <a href="#" class="media-connector-request" style="color: #ed1c24;">Jellyseerr</a></div>`;
  } else {
    return;
  }

  row.innerHTML = content;

  const requestLink = row.querySelector('.media-connector-request');
  if (requestLink) {
    requestLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleRequestClick();
    });
  }

  sidebar.appendChild(row);
};

/**
 * Inject a small status badge into Trakt grid items (search results/lists).
 */
export const injectTraktBadge = (gridItem: HTMLElement, response: CheckMediaResponse): void => {
  if (gridItem.querySelector('.media-connector-badge')) return;

  const status = response.payload.status;
  const badge = document.createElement('div');
  badge.className = 'media-connector-badge';

  const colors = {
    available: '#52B54B',
    partial: '#FFA500',
    unavailable: '#7B2FBE',
    pending: '#9E9E9E',
  };

  const color = colors[status as keyof typeof colors] ?? '#9E9E9E';

  badge.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: ${color};
    border: 1px solid rgba(255,255,255,0.4);
    z-index: 10;
  `;

  const poster = gridItem.querySelector('.poster, .titles');
  if (poster) {
    poster.appendChild(badge);
  }
};
