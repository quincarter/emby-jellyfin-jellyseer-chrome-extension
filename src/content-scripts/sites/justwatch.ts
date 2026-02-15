import {
  COMBINED_SVG,
  EMBY_SVG,
  JELLYFIN_SVG,
  sendMessage,
  createInfoRow,
  buildResultRow,
  injectSkeletonKeyframes,
  requestFromSidebar,
} from '../common-ui.js';
import { tryDetectMedia } from '../index.js';
import { getJustWatchPageType } from '../content-script-helpers.js';
import type { SearchJellyseerrResponse, GetConfigResponse } from '../../types/messages.js';

const JUSTWATCH_CARD_ID = 'media-connector-justwatch-card';
const JUSTWATCH_SKELETON_ID = 'media-connector-justwatch-skeleton';
const JUSTWATCH_SEARCH_BADGE_CLASS = 'media-connector-jw-search-badge';

/**
 * Unified JustWatch SPA handler.
 */
export const initJustWatchSPA = (): void => {
  let lastUrl = window.location.href;
  let currentPageType: 'detail' | 'search' | 'other' = getJustWatchPageType(lastUrl);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

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

  let detailInjected = false;
  let detailDetecting = false;
  let searchProcessing = false;
  let searchServerLabel = 'Emby';
  let searchServerType = 'emby';

  const detectDetail = async (): Promise<void> => {
    if (detailDetecting || detailInjected) return;
    detailDetecting = true;

    try {
      const media = tryDetectMedia();
      if (!media) return;

      const title =
        media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;
      const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

      const configRes = await sendMessage<GetConfigResponse>({ type: 'GET_CONFIG' });
      const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

      pauseObserver();
      showJustWatchSkeleton(serverLabel);
      resumeObserver();

      const response = await sendMessage<SearchJellyseerrResponse>({
        type: 'SEARCH_JELLYSEERR',
        payload: { query: title, mediaType, year: media.year },
      });

      pauseObserver();
      removeJustWatchSkeleton();

      if (!response) {
        resumeObserver();
        return;
      }

      injectJustWatchCard(response, title);
      resumeObserver();
      detailInjected = true;
    } finally {
      detailDetecting = false;
    }
  };

  const processSearchRows = async (): Promise<void> => {
    if (searchProcessing) return;
    searchProcessing = true;

    try {
      const configRes = await sendMessage<GetConfigResponse>({ type: 'GET_CONFIG' });
      searchServerLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
      searchServerType = configRes?.payload.serverType ?? 'emby';

      const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');
      for (const row of rows) {
        if (
          row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) ||
          row.dataset.mcProcessing === 'true'
        )
          continue;
        pauseObserver();
        await processJustWatchSearchRow(row, searchServerLabel, searchServerType);
        resumeObserver();
      }
    } finally {
      searchProcessing = false;
    }
  };

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

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (newPageType !== currentPageType) {
        currentPageType = newPageType;
        cleanupAll();
      }

      if (newPageType === 'detail') {
        detailInjected = false;
        cleanupAll();
        detectDetail();
      } else if (newPageType === 'search') {
        processSearchRows();
      }
      return;
    }

    if (currentPageType === 'detail') {
      if (detailInjected) {
        if (!document.getElementById(JUSTWATCH_CARD_ID)) {
          detailInjected = false;
          detectDetail();
        }
        return;
      }
      const buybox =
        document.querySelector('.buybox-container') ?? document.getElementById('buybox-anchor');
      if (buybox) detectDetail();
    } else if (currentPageType === 'search') {
      const rows = document.querySelectorAll<HTMLElement>('.title-list-row__row');
      for (const row of rows) {
        if (
          !row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`) &&
          row.dataset.mcProcessing !== 'true'
        ) {
          processSearchRows();
          break;
        }
      }
    }
  };

  if (currentPageType === 'detail') {
    detectDetail();
  } else if (currentPageType === 'search') {
    processSearchRows();
  }

  observer.observe(document.body, { childList: true, subtree: true });
  observerConnected = true;
};

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

const removeJustWatchSkeleton = (): void => {
  document.getElementById(JUSTWATCH_SKELETON_ID)?.remove();
};

const injectJustWatchCard = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(JUSTWATCH_CARD_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

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

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  });

  const iconHtml = COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"');

  header.innerHTML = `
    <div style="width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>
    <div>
      <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
      <div style="font-size:11px;color:#a89cc0;margin-top:2px;">Powered by Jellyseerr · ${serverLabel}</div>
    </div>
  `;
  card.appendChild(header);

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

const appendCardToJustWatchPage = (card: HTMLElement): void => {
  const buyboxContainer = document.querySelector<HTMLElement>('.buybox-container');
  if (buyboxContainer) {
    buyboxContainer.parentElement?.insertBefore(card, buyboxContainer);
    return;
  }

  const buyboxAnchor = document.getElementById('buybox-anchor');
  if (buyboxAnchor) {
    buyboxAnchor.parentElement?.insertBefore(card, buyboxAnchor);
    return;
  }

  const titleContent = document.querySelector<HTMLElement>('.title-detail__content');
  if (titleContent) {
    titleContent.prepend(card);
    return;
  }

  const heroDetails = document.querySelector<HTMLElement>('.title-detail-hero__details');
  if (heroDetails) {
    heroDetails.after(card);
    return;
  }

  const main =
    document.querySelector<HTMLElement>('#__layout') ??
    document.querySelector<HTMLElement>('main') ??
    document.body;
  main.prepend(card);
};

const parseJustWatchSearchRow = (
  row: HTMLElement,
): { title: string; year?: number; mediaType: 'movie' | 'tv' } | undefined => {
  const link = row.querySelector<HTMLAnchorElement>('.title-list-row__column-header');
  if (!link) return undefined;

  const href = link.getAttribute('href') ?? '';
  const isMovie = /\/movie\//.test(href);
  const isTvShow = /\/tv-show\//.test(href);
  if (!isMovie && !isTvShow) return undefined;

  const rawTitle = link.textContent?.trim();
  if (!rawTitle) return undefined;

  const yearMatch = rawTitle.match(/\s*\((\d{4})\)\s*$/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  const title = rawTitle.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  if (!title) return undefined;

  return { title, year, mediaType: isMovie ? 'movie' : 'tv' };
};

const processJustWatchSearchRow = async (
  row: HTMLElement,
  serverLabel: string,
  serverType: string,
): Promise<void> => {
  if (row.querySelector(`.${JUSTWATCH_SEARCH_BADGE_CLASS}`)) return;
  if (row.dataset.mcProcessing === 'true') return;

  row.dataset.mcProcessing = 'true';

  const parsed = parseJustWatchSearchRow(row);
  if (!parsed) return;

  const { title, year, mediaType } = parsed;
  const titleLink = row.querySelector<HTMLAnchorElement>('.title-list-row__column-header');
  if (!titleLink) return;

  const isJellyfin = serverType === 'jellyfin';
  const serverIcon = isJellyfin ? JELLYFIN_SVG : EMBY_SVG;
  const serverBg = isJellyfin ? '#00A4DC' : '#52B54B';
  const serverBgHover = isJellyfin ? '#0088B8' : '#43A047';

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

  const response = await sendMessage<SearchJellyseerrResponse>({
    type: 'SEARCH_JELLYSEERR',
    payload: { query: title, mediaType, year },
  });

  placeholder.remove();

  if (!response) return;

  const { results, jellyseerrEnabled, error, jellyseerrUrl } = response.payload;
  if (!jellyseerrEnabled || error || results.length === 0) return;

  const item = results[0];
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
        sendMessage({ type: 'OPEN_TAB', payload: { url } });
      });
    }
  } else {
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

  titleLink.insertAdjacentElement('afterend', btn);
};

/**
 * Attempt to inject a JustWatch card based on a CheckMediaResponse.
 * Used for direct match flow.
 */
export const tryInjectJustWatchCard = (
  response: import('../../types/messages.js').CheckMediaResponse,
): void => {
  if (document.getElementById(JUSTWATCH_CARD_ID)) return;

  const status = response.payload.status;
  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const itemUrl = response.payload.itemUrl;

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
  });

  const headerHtml = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="width:32px;height:32px;flex-shrink:0;">${COMBINED_SVG.replace(/width="48" height="48"/, 'width="32" height="32"')}</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:#d0bcff;">I've got this!</div>
        <div style="font-size:11px;color:#a89cc0;margin-top:2px;">${serverLabel} Status</div>
      </div>
    </div>
  `;

  let contentHtml = '';
  if (status === 'available' || status === 'partial') {
    const label = status === 'partial' ? 'Available (Partial)' : 'Available';
    contentHtml = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:24px;">✅</div>
        <div>
          <div style="font-weight:600;">${label} on ${serverLabel}</div>
          <a href="${itemUrl}" target="_blank" style="color:#d0bcff;text-decoration:underline;font-size:13px;">Play now</a>
        </div>
      </div>
    `;
  } else if (status === 'unavailable') {
    contentHtml = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:24px;">🚀</div>
        <div>
          <div style="font-weight:600;">Not on ${serverLabel} yet</div>
          <div style="font-size:13px;color:#a89cc0;">Request via Jellyseerr</div>
        </div>
      </div>
    `;
  }

  card.innerHTML = headerHtml + contentHtml;
  appendCardToJustWatchPage(card);
};

/**
 * Inject a status badge into JustWatch poster elements.
 */
export const injectJustWatchBadge = (
  poster: HTMLElement,
  response: import('../../types/messages.js').CheckMediaResponse,
): void => {
  if (poster.querySelector('.media-connector-badge')) return;

  const status = response.payload.status;
  const badge = document.createElement('div');
  badge.className = 'media-connector-badge';

  const colors = {
    available: '#52B54B',
    partial: '#FFA500',
    unavailable: '#7B2FBE',
  };

  const color = colors[status as keyof typeof colors] ?? '#9E9E9E';

  badge.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: ${color};
    border: 2px solid white;
    z-index: 10;
    box-shadow: 0 0 4px rgba(0,0,0,0.5);
  `;

  const target = poster.querySelector('.poster-container') || poster;
  target.appendChild(badge);
};
