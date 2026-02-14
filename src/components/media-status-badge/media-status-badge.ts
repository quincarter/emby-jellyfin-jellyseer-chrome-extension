import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ComponentMixin } from "../../mixins/component-mixin.js";
import { mediaStatusBadgeStyles } from "./media-status-badge.styles.js";
import type { MediaAvailability } from "../../types/index.js";

/**
 * A badge component that displays the availability status of media.
 * Used both in content scripts (via shadow DOM) and the sandbox.
 *
 * @example
 * ```html
 * <media-status-badge
 *   status="available"
 *   item-url="https://emby.example.com/web/index.html#!/item?id=123"
 *   media-title="The Matrix"
 * ></media-status-badge>
 * ```
 *
 * @fires request-media - When the user clicks the request button
 * @csspart badge - The badge container element
 */
@customElement("media-status-badge")
export class MediaStatusBadge extends ComponentMixin(LitElement) {
  static styles = mediaStatusBadgeStyles;

  /**
   * The availability status to display.
   */
  @property({ attribute: "status", reflect: true })
  status: MediaAvailability["status"] = "loading";

  /**
   * URL to navigate to when clicked (for available items).
   */
  @property({ attribute: "item-url" })
  itemUrl = "";

  /**
   * Title of the media for display or request purposes.
   */
  @property({ attribute: "media-title" })
  mediaTitle = "";

  /**
   * Additional details (e.g., for partial availability).
   */
  @property({ attribute: "details" })
  details = "";

  /**
   * Error message when status is 'error'.
   */
  @property({ attribute: "error-message" })
  errorMessage = "";

  render() {
    switch (this.status) {
      case "available":
        return this._renderAvailable();
      case "partial":
        return this._renderPartial();
      case "unavailable":
        return this._renderUnavailable();
      case "loading":
        return this._renderLoading();
      case "error":
        return this._renderError();
      case "unconfigured":
        return this._renderUnconfigured();
      default:
        return nothing;
    }
  }

  private _renderAvailable() {
    return html`
      <a
        class="badge badge--available"
        part="badge"
        href="${this.itemUrl}"
        target="_blank"
        rel="noopener noreferrer"
        title="Open ${this.mediaTitle} on your server"
      >
        <span class="badge-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
            />
          </svg>
        </span>
        <span class="badge-text">Available on Server</span>
      </a>
    `;
  }

  private _renderPartial() {
    return html`
      <a
        class="badge badge--partial"
        part="badge"
        href="${this.itemUrl}"
        target="_blank"
        rel="noopener noreferrer"
        title="${this.details}"
      >
        <span class="badge-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
        </span>
        <span class="badge-text">${this.details || "Partially Available"}</span>
      </a>
    `;
  }

  private _renderUnavailable() {
    return html`
      <button
        class="badge badge--unavailable"
        part="badge"
        @click="${this._handleRequest}"
        title="Request ${this.mediaTitle} via Jellyseerr"
      >
        <span class="badge-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </span>
        <span class="badge-text">Request with Jellyseerr</span>
      </button>
    `;
  }

  private _renderLoading() {
    return html`
      <div class="badge badge--loading" part="badge">
        <div class="spinner"></div>
        <span class="badge-text">Checking...</span>
      </div>
    `;
  }

  private _renderError() {
    return html`
      <div class="badge badge--error" part="badge" title="${this.errorMessage}">
        <span class="badge-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            />
          </svg>
        </span>
        <span class="badge-text">Error: ${this.errorMessage || "Unknown"}</span>
      </div>
    `;
  }

  private _renderUnconfigured() {
    return html`
      <div class="badge badge--unconfigured" part="badge">
        <span class="badge-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path
              d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"
            />
          </svg>
        </span>
        <span class="badge-text">Configure Extension</span>
      </div>
    `;
  }

  private _handleRequest(): void {
    this.emitEvent("request-media", { title: this.mediaTitle });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "media-status-badge": MediaStatusBadge;
  }
}
