Here is the `copilot-instructions.md` file converted to Markdown, with citations mapping back to the provided source text where applicable.

# Copilot Instructions: Emby/Jellyfin Media Connector Extension

## 1. Project Overview

This is a Chrome Extension that acts as a connector for self-hosted media servers (Emby/Jellyfin).

**Core Functionality:**

- Detects Movies and TV Shows (Show, Season, Episode levels) on third-party sites (IMDb, Trakt, Netflix, Amazon, Google/Bing Search).
- Checks availability on the user's configured Emby/Jellyfin server.
- Allows requesting media via Jellyseerr if missing.

## 2. Technology Stack

- **View Layer:** Lit (LitElement)

- **Build Tool:** Vite

- **Testing:** Web Test Runner (wtr)
- **Language:** TypeScript (Strict Mode)

## 3. Architecture & File Structure

### Component Structure

All UI components must be placed in `src/components`. Each component requires its own folder:

```text
src/components/
└── [component-name]/
    [cite_start]├── [component-name].ts        # Logic & Template [cite: 8]
    [cite_start]├── [component-name].styles.ts # Styles (CSSResultOrNative[]) [cite: 8]
    [cite_start]└── [icon-name].svg.ts         # SVG Assets (if needed) [cite: 8]

```

### Base Class & Mixins

- **ComponentMixin:** All components must extend a `ComponentMixin(LitElement)`.
- This mixin handles shared functionality, global context, and common themes.

### Styling Strategy

- **Isolation:** Do not write inline styles or styles inside the `.ts` file. Import them from the `*.styles.ts` file.

- **Typography:** Maintain a `typography.css.ts` file; import it into components where text is rendered.
- **Variables:** Define CSS variables at the highest level (host/root) for inheritance across all web components.
- **Theme:** The extension popup and components should feature a purple gradient aesthetic with Emby/Jellyfin/Jellyseerr SVG icons.

4. Coding Standards ("Quin's Conventions")

### TypeScript

- **Strict Typing:** Do NOT use explicit `any`. Create custom Interfaces or Types for all data.

- **Unions:** Prefer discriminated union types or standard unions over Enums.
- **Utilities:** Create clean utility functions in `src/utils` using exported `const` arrow functions.

### Lit Best Practices

- **Decorators:** Always place decorators on their own line.

- **Attributes:** Define attributes explicitly: `@property({ attribute: 'my-attr' })`.

- **Conditionals:** Use `nothing` from `lit` for conditional rendering. **Never** use `null`.

- **Documentation:** Use JSDoc for all public APIs, usage examples, and CSS parts.

- **Performance:** Use memoization and render boundaries where appropriate.

- ensure the manifest is using the latest chrome manifest requirements and update it promptly as features change.

## 5. Feature Implementation Plan

### A. Content Scripts (The View Layer)

- **Detection:** Implement logic to scrape/identify media metadata (Title, Year, IMDb ID, Season/Episode numbers) from the current page.
- **Rendering:** Inject Lit components into the page DOM.
- **Logic:**
- **If Movie/Show:** Check existence on server.
- **If TV Show:** Verify specific Season/Episode availability.
- **If Available:** Show icon linking to the item on the user's server.
- **If Missing:** Show option to request via Jellyseerr (if enabled).

### B. Extension Popup (Configuration)

- **UI:** Lit-based popup with a purple gradient background.
- **Settings:**

1. **Server Selector:** Toggle between Emby and Jellyfin.
2. **Connection:** Server URL and API Key inputs.
3. **Jellyseerr:** Toggle switch (Enable/Disable). If enabled, show URL and API Key inputs.

- **Storage:** Save configuration securely to `chrome.storage`.

### C. Sandbox Environment (`src/sandbox`)

- Create a standalone `sandbox/index.html` to develop components in isolation.
- **Mock Mode:** Include a toggle switch to flip between:
- **Mock Data:** Use static JSON fixtures (to test rendering without network).
- **Real API:** Use the configured API keys to test real server connectivity.

### D. Service Worker

- Handle background API requests to Emby/Jellyfin/Jellyseerr to avoid CORS issues on content pages.
- Manage caching of server library data.

## 6. Testing & Quality Assurance

- **Tooling:** Use Web Test Runner (`wtr`) for component testing.
- **Snapshot Safety:** Follow snapshot-safe rendering patterns.

- **Scope:** Test events and Shadow DOM behavior explicitly.

- **Workflow:** Always run a build and test suite after each feature implementation to prevent regression.


start every response with a 🔋 so i know you are reading my instructions

use yarn to install packages