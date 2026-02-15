import { html, fixture, expect } from '@open-wc/testing';
import { SearchSidebar } from './search-sidebar.js';
import { mockSearchResponses } from '../../sandbox/mock-data.js';
import type { SearchJellyseerrResponse } from '../../types/messages.js';

// Ensure registration
import './search-sidebar.js';

describe('search-sidebar', () => {
  it('renders nothing when no response is provided', async () => {
    const el = await fixture<SearchSidebar>(html`<search-sidebar></search-sidebar>`);
    expect(el.shadowRoot?.childElementCount).to.equal(0);
  });

  it('renders multiple results correctly', async () => {
    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${mockSearchResponses.multiple}"></search-sidebar>`,
    );

    const rows = el.shadowRoot?.querySelectorAll('.result-row');
    expect(rows?.length).to.equal(3);

    const firstTitle = rows?.[0].querySelector('.title');
    expect(firstTitle?.textContent).to.contain('The Matrix');

    const availableBtn = rows?.[0].querySelector('button');
    expect(availableBtn?.textContent?.trim()).to.contain('Play on Emby');
  });

  it('renders no results message', async () => {
    const el = await fixture<SearchSidebar>(
      html`<search-sidebar
        .response="${mockSearchResponses.noResults}"
        queryTitle="Missing Item"
      ></search-sidebar>`,
    );

    const infoRow = el.shadowRoot?.querySelector('.info-row');
    expect(infoRow).to.exist;
    expect(infoRow?.textContent).to.contain('No results');
    expect(infoRow?.textContent).to.contain('Missing Item');
  });

  it('renders unconfigured message', async () => {
    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${mockSearchResponses.unconfigured}"></search-sidebar>`,
    );

    const infoRow = el.shadowRoot?.querySelector('.info-row');
    expect(infoRow).to.exist;
    expect(infoRow?.textContent).to.contain('Jellyseerr not configured');
  });

  it('renders error message', async () => {
    const errorResponse: SearchJellyseerrResponse = {
      type: 'SEARCH_JELLYSEERR_RESPONSE',
      payload: {
        results: [],
        jellyseerrEnabled: true,
        serverType: 'emby',
        error: 'API Timeout',
      },
    };

    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${errorResponse}"></search-sidebar>`,
    );

    const infoRow = el.shadowRoot?.querySelector('.info-row');
    expect(infoRow?.textContent).to.contain('Connection error');
    expect(infoRow?.textContent).to.contain('API Timeout');
  });

  it('renders pending status button', async () => {
    const pendingResponse: SearchJellyseerrResponse = {
      type: 'SEARCH_JELLYSEERR_RESPONSE',
      payload: {
        results: [{ id: 123, title: 'Pending Movie', status: 'pending', mediaType: 'movie' }],
        jellyseerrEnabled: true,
        serverType: 'emby',
        jellyseerrUrl: 'https://jsr.test',
      },
    };

    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${pendingResponse}"></search-sidebar>`,
    );

    const pendingBtn = el.shadowRoot?.querySelector('button');
    expect(pendingBtn?.textContent?.includes('Pending')).to.be.true;
  });

  it('dispatches open-tab event when pending button is clicked', async () => {
    const pendingResponse: SearchJellyseerrResponse = {
      type: 'SEARCH_JELLYSEERR_RESPONSE',
      payload: {
        results: [{ id: 123, title: 'Pending Movie', status: 'pending', mediaType: 'movie' }],
        jellyseerrEnabled: true,
        serverType: 'emby',
        jellyseerrUrl: 'https://jsr.test',
      },
    };

    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${pendingResponse}"></search-sidebar>`,
    );

    let eventDetail: { url: string } | null = null;
    window.addEventListener(
      'media-connector-open-tab',
      ((e: CustomEvent) => {
        eventDetail = e.detail;
      }) as EventListener,
      { once: true },
    );

    const pendingBtn = el.shadowRoot?.querySelector('button');
    pendingBtn?.click();

    expect(eventDetail?.url).to.equal('https://jsr.test/movie/123');
  });

  it('renders processing status button', async () => {
    const processingResponse: SearchJellyseerrResponse = {
      type: 'SEARCH_JELLYSEERR_RESPONSE',
      payload: {
        results: [{ id: 123, title: 'Processing Movie', status: 'processing', mediaType: 'movie' }],
        jellyseerrEnabled: true,
        serverType: 'emby',
        jellyseerrUrl: 'https://jsr.test',
      },
    };

    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${processingResponse}"></search-sidebar>`,
    );

    const pendingBtn = el.shadowRoot?.querySelector('button');
    expect(pendingBtn?.textContent?.includes('Pending')).to.be.true;
  });

  it('renders Manage in Jellyseerr button for available items', async () => {
    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${mockSearchResponses.multiple}"></search-sidebar>`,
    );

    const rows = el.shadowRoot?.querySelectorAll('.result-row');
    const manageBtn = Array.from(rows?.[0].querySelectorAll('button') || []).find((b) =>
      b.textContent?.includes('Manage'),
    );
    expect(manageBtn).to.exist;
  });

  it('handles request button click', async () => {
    const el = await fixture<SearchSidebar>(
      html`<search-sidebar .response="${mockSearchResponses.multiple}"></search-sidebar>`,
    );

    const rows = el.shadowRoot?.querySelectorAll('.result-row');
    const reqBtn = rows?.[2].querySelector('button') as HTMLButtonElement;
    expect(reqBtn.textContent).to.contain('Request');
  });
});
