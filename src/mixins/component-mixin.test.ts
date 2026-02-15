import { html, fixture, expect } from '@open-wc/testing';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ComponentMixin } from './component-mixin.js';

// Create a test component using the mixin
@customElement('test-mixin-element')
class TestMixinElement extends ComponentMixin(LitElement) {
  render() {
    return html`
      <p class="server-type">${this.serverType}</p>
      <p class="server-url">${this.config.server.serverUrl}</p>
    `;
  }

  // Expose protected methods for testing
  public testBuildItemUrl(itemId: string, serverId?: string): string {
    return this.buildItemUrl(itemId, serverId);
  }

  public testEmitEvent<D>(name: string, detail: D): void {
    return this.emitEvent(name, detail);
  }
}

describe('ComponentMixin', () => {
  it('has default server type of emby', async () => {
    const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

    expect(el.serverType).to.equal('emby');
    const typeText = el.shadowRoot?.querySelector('.server-type');
    expect(typeText?.textContent).to.equal('emby');
  });

  it('reflects server-type attribute', async () => {
    const el = await fixture<TestMixinElement>(
      html`<test-mixin-element server-type="jellyfin"></test-mixin-element>`,
    );

    expect(el.serverType).to.equal('jellyfin');
    expect(el.getAttribute('server-type')).to.equal('jellyfin');
  });

  it('provides default config', async () => {
    const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

    expect(el.config.server.serverType).to.equal('emby');
    expect(el.config.server.serverUrl).to.equal('');
    expect(el.config.server.apiKey).to.equal('');
    expect(el.config.jellyseerr.enabled).to.be.false;
  });

  it('accepts config property', async () => {
    const config = {
      server: {
        serverType: 'jellyfin' as const,
        serverUrl: 'https://jf.test.com',
        localServerUrl: '',
        apiKey: 'test-key',
      },
      jellyseerr: {
        enabled: true,
        serverUrl: 'https://js.test.com',
        localServerUrl: '',
        apiKey: 'js-key',
      },
    };

    const el = await fixture<TestMixinElement>(
      html`<test-mixin-element .config=${config}></test-mixin-element>`,
    );

    expect(el.config.server.serverUrl).to.equal('https://jf.test.com');
    const urlText = el.shadowRoot?.querySelector('.server-url');
    expect(urlText?.textContent).to.equal('https://jf.test.com');
  });

  describe('buildItemUrl', () => {
    it('builds Emby URL format', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      el.config = {
        server: {
          serverType: 'emby',
          serverUrl: 'https://emby.test.com',
          localServerUrl: '',
          apiKey: 'key',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      const url = el.testBuildItemUrl('item-123');
      expect(url).to.equal('https://emby.test.com/web/index.html#!/item?id=item-123');
    });

    it('builds Emby URL with serverId', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      el.config = {
        server: {
          serverType: 'emby',
          serverUrl: 'https://emby.test.com',
          localServerUrl: '',
          apiKey: 'key',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      const url = el.testBuildItemUrl('item-123', 'server-1');
      expect(url).to.contain('&serverId=server-1');
    });

    it('builds Jellyfin URL format', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      el.config = {
        server: {
          serverType: 'jellyfin',
          serverUrl: 'https://jf.test.com',
          localServerUrl: '',
          apiKey: 'key',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      const url = el.testBuildItemUrl('item-456');
      expect(url).to.equal('https://jf.test.com/web/#/details?id=item-456');
    });

    it('strips trailing slash from server URL', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      el.config = {
        server: {
          serverType: 'emby',
          serverUrl: 'https://emby.test.com/',
          localServerUrl: '',
          apiKey: 'key',
        },
        jellyseerr: {
          enabled: false,
          serverUrl: '',
          localServerUrl: '',
          apiKey: '',
        },
      };

      const url = el.testBuildItemUrl('item-789');
      expect(url).not.to.contain('//web');
    });
  });

  describe('emitEvent', () => {
    it('dispatches custom events', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      let eventDetail: unknown = undefined;
      el.addEventListener('test-event', ((e: CustomEvent) => {
        eventDetail = e.detail;
      }) as EventListener);

      el.testEmitEvent('test-event', { message: 'hello' });

      expect(eventDetail).to.deep.equal({ message: 'hello' });
    });

    it('dispatches events that bubble and are composed', async () => {
      const el = await fixture<TestMixinElement>(html`<test-mixin-element></test-mixin-element>`);

      let event: CustomEvent | undefined;
      el.addEventListener('my-event', ((e: CustomEvent) => {
        event = e;
      }) as EventListener);

      el.testEmitEvent('my-event', { value: 42 });

      expect(event).to.exist;
      expect(event!.bubbles).to.be.true;
      expect(event!.composed).to.be.true;
    });
  });
});

declare global {
  interface HTMLElementTagNameMap {
    'test-mixin-element': TestMixinElement;
  }
}
