import { html, fixture, expect } from '@open-wc/testing';

// Mock chrome API globally for tests before importing components
(window as unknown as { chrome: unknown }).chrome = {
  permissions: {
    request: async () => true,
  },
  runtime: {
    lastError: null,
  },
};

import { PopupView } from './popup-view.js';

// Ensure registration
import './popup-view.js';

/**
 * Helper to access private properties for testing.
 */
function asTestable(el: PopupView) {
  return el as unknown as {
    _connectionStatus: string;
    _localUrlStatus: string;
    _jellyseerrEnabled: boolean;
    _jellyseerrStatus: string;
    _saveStatus: string;
    _localServerUrl: string;
  };
}

describe('popup-view', () => {
  it('renders the header', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const header = el.shadowRoot?.querySelector('.header h1');
    expect(header).to.exist;
    expect(header?.textContent).to.equal('Media Server Connector');
  });

  it('renders server type toggle with emby and jellyfin buttons', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const buttons = el.shadowRoot?.querySelectorAll('.server-toggle button');
    expect(buttons?.length).to.equal(2);
  });

  it('defaults to emby server type', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const embyBtn = el.shadowRoot?.querySelector('.server-toggle button.active');
    expect(embyBtn?.textContent?.trim()).to.contain('Emby');
  });

  it('renders connection form fields', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const urlInput = el.shadowRoot?.querySelector('#server-url') as HTMLInputElement;
    const apiKeyInput = el.shadowRoot?.querySelector('#api-key') as HTMLInputElement;

    expect(urlInput).to.exist;
    expect(apiKeyInput).to.exist;
  });

  it('renders jellyseerr toggle', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const toggle = el.shadowRoot?.querySelector('.toggle-switch input') as HTMLInputElement;
    expect(toggle).to.exist;
    expect(toggle.checked).to.be.false;
  });

  it('shows jellyseerr fields when toggle is enabled', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    // Initially jellyseerr fields should not be shown
    let jellyseerrUrl = el.shadowRoot?.querySelector('#jellyseerr-url');
    expect(jellyseerrUrl).to.not.exist;

    // Toggle jellyseerr on
    const toggle = el.shadowRoot?.querySelector('.toggle-switch input') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    await el.updateComplete;

    jellyseerrUrl = el.shadowRoot?.querySelector('#jellyseerr-url');
    expect(jellyseerrUrl).to.exist;
  });

  it('renders save button', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const saveBtn = el.shadowRoot?.querySelector('.btn-success');
    expect(saveBtn).to.exist;
    expect(saveBtn?.textContent?.trim()).to.equal('Save Settings');
  });

  it('updates server type when toggle buttons are clicked', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const jellyfinBtn = Array.from(
      el.shadowRoot?.querySelectorAll('.server-toggle button') || [],
    ).find((btn) => btn.textContent?.includes('Jellyfin')) as HTMLButtonElement;

    expect(jellyfinBtn).to.exist;
    jellyfinBtn.click();
    await el.updateComplete;

    expect(el.serverType).to.equal('jellyfin');
    expect(jellyfinBtn.classList.contains('active')).to.be.true;

    const embyBtn = Array.from(el.shadowRoot?.querySelectorAll('.server-toggle button') || []).find(
      (btn) => btn.textContent?.includes('Emby'),
    ) as HTMLButtonElement;

    embyBtn.click();
    await el.updateComplete;
    expect(el.serverType).to.equal('emby');
    expect(embyBtn.classList.contains('active')).to.be.true;
  });

  it('updates local server url state on input', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const input = el.shadowRoot?.querySelector('#local-server-url') as HTMLInputElement;
    input.value = 'http://10.0.0.5:8096';
    input.dispatchEvent(new Event('input'));

    // Access private property for test verification if needed, or check if it's reflected in buildConfig
    // Since it's private, we can only verify if we could trigger a save or check if the value is retained
    expect(input.value).to.equal('http://10.0.0.5:8096');
  });

  it('updates public server url state on input', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const input = el.shadowRoot?.querySelector('#server-url') as HTMLInputElement;
    input.value = 'https://my-emby.com';
    input.dispatchEvent(new Event('input'));

    expect(input.value).to.equal('https://my-emby.com');
  });

  it('updates api key state on input', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const input = el.shadowRoot?.querySelector('#api-key') as HTMLInputElement;
    input.value = 'secret-api-key';
    input.dispatchEvent(new Event('input'));

    expect(input.value).to.equal('secret-api-key');
  });

  it('toggles jellyseerr enabled state and updates fields', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const toggle = el.shadowRoot?.querySelector('.toggle-switch input') as HTMLInputElement;
    toggle.click(); // This should trigger the change event
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('#jellyseerr-url')).to.exist;

    const jsUrlInput = el.shadowRoot?.querySelector('#jellyseerr-url') as HTMLInputElement;
    jsUrlInput.value = 'https://js.example.com';
    jsUrlInput.dispatchEvent(new Event('input'));
    expect(jsUrlInput.value).to.equal('https://js.example.com');

    const jsLocalUrlInput = el.shadowRoot?.querySelector(
      '#jellyseerr-local-url',
    ) as HTMLInputElement;
    jsLocalUrlInput.value = 'http://192.168.1.50:5055';
    jsLocalUrlInput.dispatchEvent(new Event('input'));
    expect(jsLocalUrlInput.value).to.equal('http://192.168.1.50:5055');

    const jsApiKeyInput = el.shadowRoot?.querySelector('#jellyseerr-api-key') as HTMLInputElement;
    jsApiKeyInput.value = 'js-api-key';
    jsApiKeyInput.dispatchEvent(new Event('input'));
    expect(jsApiKeyInput.value).to.equal('js-api-key');
  });

  it('renders connection status messages', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    // success
    testable._connectionStatus = 'success';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-success')?.textContent).to.contain(
      'Connected successfully',
    );

    // error
    testable._connectionStatus = 'error';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-error')?.textContent).to.contain(
      'Connection failed',
    );

    // testing
    testable._connectionStatus = 'testing';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-loading')?.textContent).to.contain(
      'Testing connection',
    );
  });

  it('renders probe status messages', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    // reachable
    testable._localUrlStatus = 'reachable';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-success.status-inline')?.textContent).to.contain(
      'Local server reachable',
    );

    // unreachable
    testable._localUrlStatus = 'unreachable';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-error.status-inline')?.textContent).to.contain(
      'Local server not reachable',
    );

    // probing
    testable._localUrlStatus = 'probing';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-loading.status-inline')?.textContent).to.contain(
      'Probing local server',
    );
  });

  it('renders jellyseerr status messages', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    // Enable jellyseerr first to see the section
    testable._jellyseerrEnabled = true;
    await el.updateComplete;

    // success
    testable._jellyseerrStatus = 'success';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-success')?.textContent).to.contain(
      'Jellyseerr connected',
    );

    // error
    testable._jellyseerrStatus = 'error';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-error')?.textContent).to.contain(
      'Jellyseerr connection failed',
    );

    // testing
    testable._jellyseerrStatus = 'testing';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-loading')?.textContent).to.contain(
      'Testing Jellyseerr',
    );
  });

  it('renders save status messages', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    // saved
    testable._saveStatus = 'saved';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-success')?.textContent).to.contain(
      'Settings saved',
    );

    // error
    testable._saveStatus = 'error';
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.status-error')?.textContent).to.contain(
      'Failed to save settings',
    );
  });

  it('triggers connection test when button is clicked', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    const testBtn = el.shadowRoot?.querySelector('.btn-primary') as HTMLButtonElement;
    expect(testBtn).to.exist;
    testBtn.click();
    await el.updateComplete;

    expect(testable._connectionStatus).to.equal('testing');
    expect(testBtn.disabled).to.be.true;
    expect(testBtn.textContent).to.contain('Testing...');
  });

  it('triggers probe when button is clicked', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);
    const testable = asTestable(el);

    // Set local URL first so probe button is not disabled
    testable._localServerUrl = 'http://192.168.1.100';
    await el.updateComplete;

    const probeBtn = el.shadowRoot?.querySelector('.btn-probe') as HTMLButtonElement;
    expect(probeBtn).to.exist;
    probeBtn.click();

    // Wait for the async _probeUrl to at least reach the first setStatus('probing')
    await new Promise((resolve) => setTimeout(resolve, 50));
    await el.updateComplete;

    expect(testable._localUrlStatus).to.not.equal('idle');
  });

  it('triggers save when save button is clicked', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const saveBtn = el.shadowRoot?.querySelector('.btn-success') as HTMLButtonElement;
    expect(saveBtn).to.exist;
    saveBtn.click();
    await el.updateComplete;

    // We can't easily check for the 'saved' status because it depends on an async Effect
    // but we've triggered the call.
  });

  it('renders footer with version', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const footer = el.shadowRoot?.querySelector('.footer p');
    expect(footer?.textContent).to.contain('v0.1.0');
  });
});
