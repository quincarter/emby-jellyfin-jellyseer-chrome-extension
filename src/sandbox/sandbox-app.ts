import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Effect } from 'effect';
import { sandboxAppStyles } from './sandbox-app.styles.js';
import { mockScenarios } from './mock-data.js';
import { checkMediaAvailabilityEffect, testServerConnectionEffect } from '../utils/api-client.js';
import { loadConfigEffect } from '../utils/storage.js';
import type { ExtensionConfig, DetectedMedia, MediaAvailability } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';
import '../components/media-status-badge/media-status-badge.js';
import '../components/popup-view/popup-view.js';

/**
 * Sandbox application for developing and testing components in isolation.
 * Supports both mock data and real API data modes.
 *
 * @example
 * ```html
 * <sandbox-app></sandbox-app>
 * ```
 */
@customElement('sandbox-app')
export class SandboxApp extends LitElement {
  static styles = sandboxAppStyles;

  @state()
  private _useRealData = false;

  @state()
  private _config: ExtensionConfig = DEFAULT_CONFIG;

  @state()
  private _searchTitle = '';

  @state()
  private _searchYear = '';

  @state()
  private _searchImdbId = '';

  @state()
  private _realResult: MediaAvailability | undefined;

  @state()
  private _connectionTestResult: string | undefined;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._config = await Effect.runPromise(loadConfigEffect);
  }

  render() {
    return html`
      <div class="sandbox-container">
        ${this._renderHeader()}
        ${this._useRealData ? this._renderRealDataSection() : this._renderMockSection()}
        ${this._renderPopupPreview()}
      </div>
    `;
  }

  private _renderHeader() {
    return html`
      <div class="sandbox-header">
        <div>
          <h1>Media Server Connector - Sandbox</h1>
          <p>Develop and test components in isolation</p>
        </div>
        <div class="mode-toggle">
          <label>Mock Data</label>
          <label class="toggle-switch">
            <input
              type="checkbox"
              .checked="${this._useRealData}"
              @change="${(e: Event) => {
                this._useRealData = (e.target as HTMLInputElement).checked;
              }}"
            />
            <span class="toggle-slider"></span>
          </label>
          <label>Real API</label>
        </div>
      </div>
    `;
  }

  private _renderMockSection() {
    return html`
      <div class="section">
        <h2>Media Status Badge - All States</h2>
        <div class="scenario-grid">
          ${mockScenarios.map((scenario) => this._renderScenarioCard(scenario))}
        </div>
      </div>
    `;
  }

  private _renderScenarioCard(scenario: (typeof mockScenarios)[number]) {
    const title =
      scenario.media.type === 'season' || scenario.media.type === 'episode'
        ? scenario.media.seriesTitle
        : scenario.media.title;

    const meta = this._buildMetaText(scenario.media);

    const availability = scenario.availability;
    const itemUrl =
      availability.status === 'available' || availability.status === 'partial'
        ? `${availability.serverUrl}/web/index.html#!/item?id=${availability.item.Id}`
        : '';
    const details = availability.status === 'partial' ? availability.details : '';
    const errorMessage = availability.status === 'error' ? availability.message : '';

    return html`
      <div class="scenario-card">
        <h3>${scenario.label}</h3>
        <div class="scenario-meta">${meta}</div>
        <div class="scenario-badge">
          <media-status-badge
            status="${availability.status}"
            item-url="${itemUrl}"
            media-title="${title}"
            details="${details}"
            error-message="${errorMessage}"
          ></media-status-badge>
        </div>
      </div>
    `;
  }

  private _buildMetaText(media: DetectedMedia): string {
    switch (media.type) {
      case 'movie':
        return `Movie • ${media.title}${media.year ? ` (${media.year})` : ''}${media.imdbId ? ` • ${media.imdbId}` : ''}`;
      case 'series':
        return `Series • ${media.title}${media.year ? ` (${media.year})` : ''}`;
      case 'season':
        return `Season ${media.seasonNumber} • ${media.seriesTitle}`;
      case 'episode':
        return `S${media.seasonNumber}E${media.episodeNumber} • ${media.seriesTitle}`;
    }
  }

  private _renderRealDataSection() {
    return html`
      <div class="section">
        <h2>Real API Testing</h2>
        <div class="real-data-section">
          <div class="form-group">
            <label>Search Title</label>
            <input
              type="text"
              placeholder="e.g., The Matrix"
              .value="${this._searchTitle}"
              @input="${(e: Event) => {
                this._searchTitle = (e.target as HTMLInputElement).value;
              }}"
            />
          </div>
          <div class="form-group">
            <label>Year (optional)</label>
            <input
              type="text"
              placeholder="e.g., 1999"
              .value="${this._searchYear}"
              @input="${(e: Event) => {
                this._searchYear = (e.target as HTMLInputElement).value;
              }}"
            />
          </div>
          <div class="form-group">
            <label>IMDb ID (optional)</label>
            <input
              type="text"
              placeholder="e.g., tt0133093"
              .value="${this._searchImdbId}"
              @input="${(e: Event) => {
                this._searchImdbId = (e.target as HTMLInputElement).value;
              }}"
            />
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="btn btn-primary" @click="${this._handleRealSearch}">
              Check Availability
            </button>
            <button class="btn btn-primary" @click="${this._handleTestConnection}">
              Test Connection
            </button>
          </div>

          ${this._connectionTestResult
            ? html`<div class="result-display">${this._connectionTestResult}</div>`
            : nothing}
          ${this._realResult
            ? html`
                <div style="margin-top: 16px;">
                  <media-status-badge
                    status="${this._realResult.status}"
                    item-url="${this._realResult.status === 'available' ||
                    this._realResult.status === 'partial'
                      ? `${this._realResult.serverUrl}/web/index.html#!/item?id=${this._realResult.item.Id}`
                      : ''}"
                    media-title="${this._searchTitle}"
                    details="${this._realResult.status === 'partial'
                      ? this._realResult.details
                      : ''}"
                    error-message="${this._realResult.status === 'error'
                      ? this._realResult.message
                      : ''}"
                  ></media-status-badge>
                </div>
                <div class="result-display">${JSON.stringify(this._realResult, undefined, 2)}</div>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  private async _handleRealSearch(): Promise<void> {
    this._realResult = { status: 'loading' };

    const media: DetectedMedia = {
      type: 'movie',
      title: this._searchTitle,
      year: this._searchYear ? parseInt(this._searchYear, 10) : undefined,
      imdbId: this._searchImdbId || undefined,
    };

    this._realResult = await Effect.runPromise(checkMediaAvailabilityEffect(this._config, media));
  }

  private async _handleTestConnection(): Promise<void> {
    this._connectionTestResult = 'Testing connection...';
    try {
      const ok = await Effect.runPromise(testServerConnectionEffect(this._config));
      this._connectionTestResult = ok
        ? 'Connection successful!'
        : 'Connection failed. Check your settings.';
    } catch (e) {
      this._connectionTestResult = `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
    }
  }

  private _renderPopupPreview() {
    return html`
      <div class="section">
        <h2>Popup Preview</h2>
        <div class="popup-preview">
          <div class="popup-frame">
            <popup-view></popup-view>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sandbox-app': SandboxApp;
  }
}
