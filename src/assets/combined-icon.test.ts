import { html, fixture, expect } from '@open-wc/testing';
import { combinedIcon } from './combined-icon.svg.js';

describe('combinedIcon', () => {
  it('renders an SVG with the default size', async () => {
    const el = await fixture(html`<div>${combinedIcon()}</div>`);
    const svg = el.querySelector('svg');
    expect(svg).to.exist;
    expect(svg?.getAttribute('width')).to.equal('24');
    expect(svg?.getAttribute('height')).to.equal('24');
  });

  it('renders an SVG with a custom size', async () => {
    const el = await fixture(html`<div>${combinedIcon(48)}</div>`);
    const svg = el.querySelector('svg');
    expect(svg).to.exist;
    expect(svg?.getAttribute('width')).to.equal('48');
    expect(svg?.getAttribute('height')).to.equal('48');
  });

  it('has multiple path and gradient definitions', async () => {
    const el = await fixture(html`<div>${combinedIcon()}</div>`);
    const svg = el.querySelector('svg');
    expect(svg?.querySelectorAll('path').length).to.be.greaterThan(5);
    expect(svg?.querySelectorAll('linearGradient').length).to.be.greaterThan(5);
  });
});
