import { html, fixture, expect } from "@open-wc/testing";
import { MediaStatusBadge } from "./media-status-badge.js";

// Ensure registration
import "./media-status-badge.js";

describe("media-status-badge", () => {
  it("renders in loading state by default", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge></media-status-badge>`,
    );

    const badge = el.shadowRoot?.querySelector(".badge--loading");
    expect(badge).to.exist;

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.equal("Checking...");
  });

  it("renders available state with link", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge
        status="available"
        item-url="https://emby.example.com/web/index.html#!/item?id=123"
        media-title="The Matrix"
      ></media-status-badge>`,
    );

    const link = el.shadowRoot?.querySelector(
      "a.badge--available",
    ) as HTMLAnchorElement;
    expect(link).to.exist;
    expect(link.href).to.contain("item?id=123");
    expect(link.target).to.equal("_blank");

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.equal("Available on Server");
  });

  it("renders unavailable state with request button", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge
        status="unavailable"
        media-title="Some Movie"
      ></media-status-badge>`,
    );

    const button = el.shadowRoot?.querySelector("button.badge--unavailable");
    expect(button).to.exist;

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.equal("Request with Jellyseerr");
  });

  it("fires request-media event when unavailable badge is clicked", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge
        status="unavailable"
        media-title="Test Movie"
      ></media-status-badge>`,
    );

    let eventDetail: unknown = undefined;
    el.addEventListener("request-media", ((e: CustomEvent) => {
      eventDetail = e.detail;
    }) as EventListener);

    const button = el.shadowRoot?.querySelector(
      "button.badge--unavailable",
    ) as HTMLButtonElement;
    button.click();

    expect(eventDetail).to.deep.equal({ title: "Test Movie" });
  });

  it("renders partial state with details", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge
        status="partial"
        item-url="https://emby.example.com/web/index.html#!/item?id=456"
        details="Season 3 not found, but series exists"
      ></media-status-badge>`,
    );

    const badge = el.shadowRoot?.querySelector(".badge--partial");
    expect(badge).to.exist;

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.equal("Season 3 not found, but series exists");
  });

  it("renders error state with message", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge
        status="error"
        error-message="Connection timeout"
      ></media-status-badge>`,
    );

    const badge = el.shadowRoot?.querySelector(".badge--error");
    expect(badge).to.exist;

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.contain("Connection timeout");
  });

  it("renders unconfigured state", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge status="unconfigured"></media-status-badge>`,
    );

    const badge = el.shadowRoot?.querySelector(".badge--unconfigured");
    expect(badge).to.exist;

    const text = el.shadowRoot?.querySelector(".badge-text");
    expect(text?.textContent).to.equal("Configure Extension");
  });

  it("reflects status attribute", async () => {
    const el = await fixture<MediaStatusBadge>(
      html`<media-status-badge status="available"></media-status-badge>`,
    );

    expect(el.getAttribute("status")).to.equal("available");
  });
});
