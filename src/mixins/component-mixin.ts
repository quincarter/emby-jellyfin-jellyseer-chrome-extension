import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import type { ServerType, ExtensionConfig } from '../types/index.js';
import { DEFAULT_CONFIG } from '../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = Record<string, unknown>> = new (...args: any[]) => T;

/**
 * Shared interface for components using ComponentMixin.
 */
export declare class ComponentMixinInterface {
  config: ExtensionConfig;
  serverType: ServerType;
  protected buildItemUrl(itemId: string, serverId?: string): string;
  protected emitEvent<D>(name: string, detail: D): void;
}

/**
 * ComponentMixin provides shared functionality for all extension components.
 * Handles global context, config state, and common theme application.
 *
 * @example
 * ```ts
 * class MyComponent extends ComponentMixin(LitElement) {
 *   render() {
 *     return html`<p>Server: ${this.serverType}</p>`;
 *   }
 * }
 * ```
 */
export const ComponentMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  class MixedElement extends superClass {
    /**
     * The current extension configuration.
     */
    @property({ attribute: false })
    config: ExtensionConfig = DEFAULT_CONFIG;

    /**
     * Convenience accessor for the configured server type.
     */
    @property({ attribute: 'server-type', reflect: true })
    serverType: ServerType = 'emby';

    /**
     * Build the URL to view a media item on the configured server.
     * @param itemId - The server item ID
     * @param serverId - Optional server ID (required for Emby URLs)
     * @returns Full URL to the item on the media server
     */
    protected buildItemUrl(itemId: string, serverId?: string): string {
      const baseUrl = this.config.server.serverUrl.replace(/\/$/, '');
      if (this.config.server.serverType === 'jellyfin') {
        const serverIdParam = serverId ? `&serverId=${serverId}` : '';
        return `${baseUrl}/web/#/details?id=${itemId}${serverIdParam}`;
      }
      const serverIdParam = serverId ? `&serverId=${serverId}` : '';
      return `${baseUrl}/web/index.html#!/item?id=${itemId}${serverIdParam}`;
    }

    /**
     * Dispatch a typed custom event.
     * @param name - Event name
     * @param detail - Event detail payload
     */
    protected emitEvent<D>(name: string, detail: D): void {
      this.dispatchEvent(
        new CustomEvent(name, {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  return MixedElement as unknown as Constructor<ComponentMixinInterface> & T;
};
