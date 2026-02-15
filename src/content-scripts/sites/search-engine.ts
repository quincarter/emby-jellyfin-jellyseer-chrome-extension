import {
  COMBINED_SVG,
  sendMessage,
  createInfoRow,
  buildResultRow,
  injectSkeletonKeyframes,
} from '../common-ui.js';
import { tryDetectMedia, identifySite } from '../index.js';
import type { SearchJellyseerrResponse, GetConfigResponse } from '../../types/messages.js';

const SIDEBAR_ID = 'media-connector-sidebar';
const SKELETON_ID = 'media-connector-skeleton';

export const initSearchEngineSidebar = async (): Promise<void> => {
  const media = tryDetectMedia();
  if (!media) return;

  const title =
    media.type === 'season' || media.type === 'episode' ? media.seriesTitle : media.title;
  const mediaType = media.type === 'movie' ? ('movie' as const) : ('tv' as const);

  const configRes = await sendMessage<GetConfigResponse>({
    type: 'GET_CONFIG',
  });
  const serverLabel = configRes?.payload.serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

  showSkeleton(serverLabel);

  const response = await sendMessage<SearchJellyseerrResponse>({
    type: 'SEARCH_JELLYSEERR',
    payload: { query: title, mediaType, year: media.year },
  });

  removeSkeleton();

  if (!response) return;

  injectSidebar(response, title);
};

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

  appendSidebarToPage(skeleton as HTMLDivElement);
};

const removeSkeleton = (): void => {
  document.getElementById(SKELETON_ID)?.remove();
};

const injectSidebar = (response: SearchJellyseerrResponse, queryTitle: string): void => {
  if (document.getElementById(SIDEBAR_ID)) return;

  const { results, jellyseerrEnabled, serverType, jellyseerrUrl, error } = response.payload;
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';

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

const appendSidebarToPage = (card: HTMLDivElement): void => {
  const site = identifySite(window.location.href);

  if (site === 'google') {
    card.style.maxWidth = '100%';
    card.style.width = '100%';
    card.style.boxSizing = 'border-box';
    const rso = document.getElementById('rso');
    if (rso) {
      rso.parentElement?.insertBefore(card, rso);
      return;
    }
    const centerCol = document.getElementById('center_col');
    if (centerCol) {
      centerCol.prepend(card);
      return;
    }
    const search = document.getElementById('search');
    if (search) {
      search.prepend(card);
      return;
    }
  }

  if (site === 'bing') {
    card.style.maxWidth = '100%';
    card.style.width = 'calc(100% - 5rem)';
    card.style.boxSizing = 'border-box';
    const bResults = document.getElementById('b_results');
    if (bResults) {
      bResults.parentElement?.insertBefore(card, bResults);
      return;
    }
    const bContent = document.getElementById('b_content');
    if (bContent) {
      bContent.prepend(card);
      return;
    }
  }

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
 * Attempt to inject a search engine card based on a CheckMediaResponse.
 * This is used for the simplified flow where we have a direct match.
 */
export const tryInjectSearchEngineCard = (
  response: import('../../types/messages.js').CheckMediaResponse,
): void => {
  const SEARCH_CARD_ID = 'media-connector-search-card';
  if (document.getElementById(SEARCH_CARD_ID)) return;

  const status = response.payload.status;
  const serverType = response.payload.serverType ?? 'emby';
  const serverLabel = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
  const itemUrl = response.payload.itemUrl;

  const card = document.createElement('div');
  card.id = SEARCH_CARD_ID;
  Object.assign(card.style, {
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    background: 'linear-gradient(145deg, #1a1130 0%, #120d20 100%)',
    border: '1px solid rgba(123, 47, 190, 0.35)',
    borderRadius: '16px',
    padding: '20px',
    color: '#e8e0f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
    marginBlock: '1rem',
    maxWidth: '360px',
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

  // Try to find a good sidebar spot
  const googleSidebar = document.getElementById('rhs');
  if (googleSidebar) {
    googleSidebar.prepend(card);
    return;
  }

  const bingSidebar = document.getElementById('b_context');
  if (bingSidebar) {
    bingSidebar.prepend(card);
    return;
  }

  // Fallback to absolute positioning if no sidebar
  Object.assign(card.style, {
    position: 'fixed',
    top: '100px',
    right: '20px',
    zIndex: '9999',
  });
  document.body.appendChild(card);
};
