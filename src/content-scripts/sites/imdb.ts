import {
  COMBINED_SVG,
  sendMessage,
  createInfoRow,
  buildResultRow,
  injectSkeletonKeyframes,
} from '../common-ui.js';
import { tryDetectMedia } from '../index.js';
import type {
  SearchJellyseerrResponse,
  GetConfigResponse,
  CheckMediaResponse,
} from '../../types/messages.js';

const IMDB_SKELETON_ID = 'media-connector-imdb-skeleton';
const IMDB_CARD_ID = 'media-connector-imdb-card';

/**
 * IMDb-specific init.
 * Detects media, queries Jellyseerr, and injects a media connector card
 * below the hero section.
 */
export const initImdb = async (): Promise<void> => {
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
 */
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

const removeImdbSkeleton = (): void => {
  document.getElementById(IMDB_SKELETON_ID)?.remove();
};

const injectImdbCard = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(IMDB_CARD_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

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

const appendCardToImdbPage = (card: HTMLElement): void => {
  const heroSection = document.querySelector<HTMLElement>('[data-testid="hero-parent"]');
  if (heroSection) {
    const blurWrapper = heroSection.closest('section.ipc-page-background--baseAlt');
    if (blurWrapper) {
      blurWrapper.after(card);
    } else {
      heroSection.after(card);
    }
    return;
  }

  const heroTitle = document.querySelector<HTMLElement>('[data-testid="hero__pageTitle"]');
  const heroContainer = heroTitle?.closest('section.ipc-page-background--baseAlt');
  if (heroContainer) {
    heroContainer.after(card);
    return;
  }

  const main = document.querySelector<HTMLElement>('main[role="main"]');
  if (main) {
    main.prepend(card);
  }
};

/**
 * Attempt to inject the IMDb card based on a CheckMediaResponse.
 * This is used for the simplified flow where we have a direct match.
 */
export const tryInjectImdbCard = (response: CheckMediaResponse): void => {
  if (document.getElementById(IMDB_CARD_ID)) return;

  const status = response.payload.status;
  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const itemUrl = response.payload.itemUrl;

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
          <div style="font-size:13px;color:#a89cc0;">You can request this via Jellyseerr.</div>
        </div>
      </div>
    `;
  }

  card.innerHTML = headerHtml + contentHtml;
  appendCardToImdbPage(card);
};

/**
 * Inject a status badge into IMDb poster elements.
 */
export const injectImdbBadge = (poster: HTMLElement, response: CheckMediaResponse): void => {
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

  const target = poster.querySelector('.ipc-media') || poster;
  target.appendChild(badge);
};
