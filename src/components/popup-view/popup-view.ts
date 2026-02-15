import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Effect } from 'effect';
import { ComponentMixin } from '../../mixins/component-mixin.js';
import { popupViewStyles } from './popup-view.styles.js';
import { loadConfigEffect, saveConfigEffect } from '../../utils/storage.js';
import { testServerConnectionEffect } from '../../utils/api-client.js';
import { testJellyseerrConnectionEffect } from '../../utils/jellyseerr-client.js';
import { probeServerUrlEffect, clearResolvedUrlCacheEffect } from '../../utils/url-resolver.js';
import { embyIcon } from '../../assets/emby-icon.svg.js';
import { jellyfinIcon } from '../../assets/jellyfin-icon.svg.js';
import { jellyseerrIcon } from '../../assets/jellyseerr-icon.svg.js';
import type { ServerType, ExtensionConfig } from '../../types/index.js';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';
type LocalUrlStatus = 'idle' | 'probing' | 'reachable' | 'unreachable';

/**
 * Extension popup view component.
 * Provides configuration UI for server connection and Jellyseerr integration.
 *
 * @example
 * ```html
 * <popup-view></popup-view>
 * ```
 *
 * @csspart header - The popup header section
 * @csspart settings - The settings form section
 */
@customElement('popup-view')
export class PopupView extends ComponentMixin(LitElement) {
  static styles = popupViewStyles;

  @state()
  private _serverUrl = '';

  @state()
  private _localServerUrl = '';

  @state()
  private _apiKey = '';

  @state()
  private _jellyseerrEnabled = false;

  @state()
  private _jellyseerrUrl = '';

  @state()
  private _jellyseerrLocalUrl = '';

  @state()
  private _jellyseerrApiKey = '';

  @state()
  private _connectionStatus: ConnectionStatus = 'idle';

  @state()
  private _localUrlStatus: LocalUrlStatus = 'idle';

  @state()
  private _jellyseerrLocalUrlStatus: LocalUrlStatus = 'idle';

  @state()
  private _jellyseerrStatus: ConnectionStatus = 'idle';

  @state()
  private _saveStatus: 'idle' | 'saved' | 'error' = 'idle';

  override connectedCallback(): void {
    super.connectedCallback();
    this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    const config = await Effect.runPromise(loadConfigEffect);
    this.config = config;
    this.serverType = config.server.serverType;
    this._serverUrl = config.server.serverUrl;
    this._localServerUrl = config.server.localServerUrl;
    this._apiKey = config.server.apiKey;
    this._jellyseerrEnabled = config.jellyseerr.enabled;
    this._jellyseerrUrl = config.jellyseerr.serverUrl;
    this._jellyseerrLocalUrl = config.jellyseerr.localServerUrl;
    this._jellyseerrApiKey = config.jellyseerr.apiKey;
  }

  private _buildConfig(): ExtensionConfig {
    return {
      server: {
        serverType: this.serverType,
        serverUrl: this._serverUrl,
        localServerUrl: this._localServerUrl,
        apiKey: this._apiKey,
      },
      jellyseerr: {
        enabled: this._jellyseerrEnabled,
        serverUrl: this._jellyseerrUrl,
        localServerUrl: this._jellyseerrLocalUrl,
        apiKey: this._jellyseerrApiKey,
      },
    };
  }

  private async _handleSave(): Promise<void> {
    try {
      const config = this._buildConfig();
      await Effect.runPromise(saveConfigEffect(config));
      this.config = config;
      // Clear URL resolution cache so the new URLs are re-evaluated
      Effect.runSync(clearResolvedUrlCacheEffect);

      // Request host permissions for the server and Jellyseerr URLs
      // so the service worker can use chrome.cookies and bypass CORS.
      await this._requestHostPermissions(config);

      this._saveStatus = 'saved';
      setTimeout(() => {
        this._saveStatus = 'idle';
      }, 2000);
    } catch {
      this._saveStatus = 'error';
    }
  }

  /**
   * Request host permissions for configured server URLs.
   * This is needed for chrome.cookies access and CORS-free fetches in the service worker.
   */
  private async _requestHostPermissions(config: ExtensionConfig): Promise<void> {
    const origins: string[] = [];

    const addOrigin = (url: string): void => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        origins.push(`${parsed.origin}/*`);
      } catch {
        // invalid URL, skip
      }
    };

    addOrigin(config.server.serverUrl);
    if (config.server.localServerUrl) addOrigin(config.server.localServerUrl);
    if (config.jellyseerr.enabled) {
      addOrigin(config.jellyseerr.serverUrl);
      if (config.jellyseerr.localServerUrl) addOrigin(config.jellyseerr.localServerUrl);
    }

    if (origins.length > 0) {
      try {
        const granted = await chrome.permissions.request({ origins });
        console.log('[Media Connector] Host permissions granted:', granted, origins);
      } catch (e) {
        console.warn('[Media Connector] Host permission request failed:', e);
      }
    }
  }

  private _handleServerTypeChange(type: ServerType): void {
    this.serverType = type;
  }

  private async _handleTestConnection(): Promise<void> {
    this._connectionStatus = 'testing';
    try {
      const config = this._buildConfig();
      const ok = await Effect.runPromise(testServerConnectionEffect(config));
      this._connectionStatus = ok ? 'success' : 'error';
    } catch {
      this._connectionStatus = 'error';
    }
    setTimeout(() => {
      this._connectionStatus = 'idle';
    }, 3000);
  }

  /**
   * Probe whether the local server URL is reachable.
   * Requests host permission for the local URL origin if needed.
   */
  private async _handleProbeLocalUrl(): Promise<void> {
    if (!this._localServerUrl) return;
    await this._probeUrl(this._localServerUrl, '/System/Info/Public', (status) => {
      this._localUrlStatus = status;
    });
  }

  /**
   * Probe whether the Jellyseerr local URL is reachable.
   */
  private async _handleProbeJellyseerrLocalUrl(): Promise<void> {
    if (!this._jellyseerrLocalUrl) return;
    await this._probeUrl(this._jellyseerrLocalUrl, '/api/v1/status', (status) => {
      this._jellyseerrLocalUrlStatus = status;
    });
  }

  /**
   * Generic probe helper. Requests host permission then probes the URL.
   * @param url - The URL to probe
   * @param probePath - The health-check endpoint path
   * @param setStatus - Callback to update the relevant status state
   */
  private async _probeUrl(
    url: string,
    probePath: string,
    setStatus: (status: LocalUrlStatus) => void,
  ): Promise<void> {
    const permissionGranted = await this._requestHostPermission(url);
    if (!permissionGranted) {
      setStatus('unreachable');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    setStatus('probing');
    try {
      const reachable = await Effect.runPromise(probeServerUrlEffect(url, probePath));
      setStatus(reachable ? 'reachable' : 'unreachable');
    } catch {
      setStatus('unreachable');
    }
    setTimeout(() => setStatus('idle'), 3000);
  }

  /**
   * Request optional host permission for a given URL's origin.
   * Required for local/LAN addresses the extension doesn't have pre-granted access to.
   * @param url - The URL to request permission for
   * @returns Whether the permission was granted
   */
  private async _requestHostPermission(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/*`;

      // If chrome.permissions API isn't available (sandbox), skip
      if (typeof chrome === 'undefined' || typeof chrome.permissions === 'undefined') {
        return true;
      }

      const granted = await chrome.permissions.request({
        origins: [origin],
      });
      return granted;
    } catch {
      return false;
    }
  }

  private async _handleTestJellyseerr(): Promise<void> {
    this._jellyseerrStatus = 'testing';
    try {
      const config = this._buildConfig();
      const ok = await Effect.runPromise(testJellyseerrConnectionEffect(config));
      this._jellyseerrStatus = ok ? 'success' : 'error';
    } catch {
      this._jellyseerrStatus = 'error';
    }
    setTimeout(() => {
      this._jellyseerrStatus = 'idle';
    }, 3000);
  }

  private _onJellyseerrToggle(e: Event): void {
    const target = e.target as HTMLInputElement;
    this._jellyseerrEnabled = target.checked;
  }

  render() {
    return html`
      <div class="popup-container">
        ${this._renderHeader()} ${this._renderServerSection()} ${this._renderConnectionSection()}
        ${this._renderJellyseerrSection()} ${this._renderActions()} ${this._renderFooter()}
      </div>
    `;
  }

  private _renderHeader() {
    const icon = this.serverType === 'emby' ? embyIcon(28) : jellyfinIcon(28);
    return html`
      <div class="header" part="header">
        <div class="header-icon">${icon}</div>
        <div>
          <h1>Media Server Connector</h1>
          <p>Configure your server connection</p>
        </div>
      </div>
    `;
  }

  private _renderServerSection() {
    return html`
      <div class="section">
        <div class="section-title">Server Type</div>
        <div class="server-toggle">
          <button
            class="${this.serverType === 'emby' ? 'active' : ''}"
            @click="${() => this._handleServerTypeChange('emby')}"
          >
            ${embyIcon(16)} Emby
          </button>
          <button
            class="${this.serverType === 'jellyfin' ? 'active' : ''}"
            @click="${() => this._handleServerTypeChange('jellyfin')}"
          >
            ${jellyfinIcon(16)} Jellyfin
          </button>
        </div>
      </div>
    `;
  }

  private _renderConnectionSection() {
    return html`
      <div class="section" part="settings">
        <div class="section-title">Connection</div>
        <div class="form-group">
          <label for="local-server-url">Local / LAN URL (preferred)</label>
          <input
            id="local-server-url"
            type="url"
            placeholder="http://192.168.1.100:8096"
            .value="${this._localServerUrl}"
            @input="${(e: Event) => {
              this._localServerUrl = (e.target as HTMLInputElement).value;
            }}"
          />
          <span class="form-hint">
            Used when your device is on the same network as your server.
          </span>
          <button
            class="btn btn-probe"
            @click="${this._handleProbeLocalUrl}"
            ?disabled="${this._localUrlStatus === 'probing' || !this._localServerUrl}"
          >
            ${this._localUrlStatus === 'probing' ? 'Probing...' : 'Probe Local URL'}
          </button>
          ${this._renderProbeStatus(this._localUrlStatus)}
        </div>
        <div class="form-group">
          <label for="server-url">Public URL (fallback)</label>
          <input
            id="server-url"
            type="url"
            placeholder="https://your-server:8096"
            .value="${this._serverUrl}"
            @input="${(e: Event) => {
              this._serverUrl = (e.target as HTMLInputElement).value;
            }}"
          />
          <span class="form-hint">
            Used when the local URL is unreachable (e.g. away from home).
          </span>
        </div>
        <div class="form-group">
          <label for="api-key">API Key</label>
          <input
            id="api-key"
            type="password"
            placeholder="Enter your API key"
            .value="${this._apiKey}"
            @input="${(e: Event) => {
              this._apiKey = (e.target as HTMLInputElement).value;
            }}"
          />
        </div>
        <button
          class="btn btn-primary"
          @click="${this._handleTestConnection}"
          ?disabled="${this._connectionStatus === 'testing'}"
        >
          ${this._connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
        </button>
        ${this._renderConnectionStatus()}
      </div>
    `;
  }

  private _renderConnectionStatus() {
    if (this._connectionStatus === 'success') {
      return html`<div class="status status-success">Connected successfully!</div>`;
    }
    if (this._connectionStatus === 'error') {
      return html`<div class="status status-error">Connection failed. Check URL and API key.</div>`;
    }
    if (this._connectionStatus === 'testing') {
      return html`<div class="status status-loading">Testing connection...</div>`;
    }
    return nothing;
  }

  private _renderProbeStatus(status: LocalUrlStatus) {
    if (status === 'reachable') {
      return html`<div class="status status-success status-inline">Local server reachable!</div>`;
    }
    if (status === 'unreachable') {
      return html`<div class="status status-error status-inline">
        Local server not reachable — will use public URL.
      </div>`;
    }
    if (status === 'probing') {
      return html`<div class="status status-loading status-inline">Probing local server...</div>`;
    }
    return nothing;
  }

  private _renderJellyseerrSection() {
    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-title">${jellyseerrIcon(16)} Jellyseerr</div>
          <label class="toggle-switch">
            <input
              type="checkbox"
              .checked="${this._jellyseerrEnabled}"
              @change="${this._onJellyseerrToggle}"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        ${this._jellyseerrEnabled
          ? html`
              <div class="form-group">
                <label for="jellyseerr-local-url">Local / LAN URL (preferred)</label>
                <input
                  id="jellyseerr-local-url"
                  type="url"
                  placeholder="http://192.168.1.100:5055"
                  .value="${this._jellyseerrLocalUrl}"
                  @input="${(e: Event) => {
                    this._jellyseerrLocalUrl = (e.target as HTMLInputElement).value;
                  }}"
                />
                <span class="form-hint">
                  Used when your device is on the same network as Jellyseerr.
                </span>
                <button
                  class="btn btn-probe"
                  @click="${this._handleProbeJellyseerrLocalUrl}"
                  ?disabled="${this._jellyseerrLocalUrlStatus === 'probing' ||
                  !this._jellyseerrLocalUrl}"
                >
                  ${this._jellyseerrLocalUrlStatus === 'probing' ? 'Probing...' : 'Probe Local URL'}
                </button>
                ${this._renderProbeStatus(this._jellyseerrLocalUrlStatus)}
              </div>
              <div class="form-group">
                <label for="jellyseerr-url">Public URL (fallback)</label>
                <input
                  id="jellyseerr-url"
                  type="url"
                  placeholder="https://your-jellyseerr:5055"
                  .value="${this._jellyseerrUrl}"
                  @input="${(e: Event) => {
                    this._jellyseerrUrl = (e.target as HTMLInputElement).value;
                  }}"
                />
                <span class="form-hint">
                  Used when the local URL is unreachable (e.g. away from home).
                </span>
              </div>
              <div class="form-group">
                <label for="jellyseerr-api-key">API Key</label>
                <input
                  id="jellyseerr-api-key"
                  type="password"
                  placeholder="Enter Jellyseerr API key"
                  .value="${this._jellyseerrApiKey}"
                  @input="${(e: Event) => {
                    this._jellyseerrApiKey = (e.target as HTMLInputElement).value;
                  }}"
                />
              </div>
              <button
                class="btn btn-primary"
                @click="${this._handleTestJellyseerr}"
                ?disabled="${this._jellyseerrStatus === 'testing'}"
              >
                ${this._jellyseerrStatus === 'testing' ? 'Testing...' : 'Test Jellyseerr'}
              </button>
              ${this._renderJellyseerrStatus()}
            `
          : nothing}
      </div>
    `;
  }

  private _renderJellyseerrStatus() {
    if (this._jellyseerrStatus === 'success') {
      return html`<div class="status status-success">Jellyseerr connected!</div>`;
    }
    if (this._jellyseerrStatus === 'error') {
      return html`<div class="status status-error">Jellyseerr connection failed.</div>`;
    }
    if (this._jellyseerrStatus === 'testing') {
      return html`<div class="status status-loading">Testing Jellyseerr...</div>`;
    }
    return nothing;
  }

  private _renderActions() {
    return html`
      <button class="btn btn-success" @click="${this._handleSave}">Save Settings</button>
      ${this._saveStatus === 'saved'
        ? html`<div class="status status-success">Settings saved!</div>`
        : nothing}
      ${this._saveStatus === 'error'
        ? html`<div class="status status-error">Failed to save settings.</div>`
        : nothing}
    `;
  }

  private _renderFooter() {
    return html`
      <div class="footer">
        <p>Media Server Connector v0.1.0</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'popup-view': PopupView;
  }
}
