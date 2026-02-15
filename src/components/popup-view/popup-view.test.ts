import { html, fixture, expect } from '@open-wc/testing';
import { PopupView } from './popup-view.js';

// Ensure registration
import './popup-view.js';

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

  it('renders footer with version', async () => {
    const el = await fixture<PopupView>(html`<popup-view></popup-view>`);

    const footer = el.shadowRoot?.querySelector('.footer p');
    expect(footer?.textContent).to.contain('v0.1.0');
  });
});
