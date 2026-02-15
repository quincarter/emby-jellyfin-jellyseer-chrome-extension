[![Web Test Runner](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml)
[![Vitest](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml)
[![Playwright E2E](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml)
[![Lint](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml)
[![Build](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml)

[![Vitest Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/vitest/vitest.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml)
[![WTR Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/wtr/wtr.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml)
[![E2E Pass Rate](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/e2e/e2e.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml)

# I've got this! (Media Connector)

"I've got this!" is a powerful browser extension designed for self-hosted media enthusiasts. It seamlessly bridges the gap between popular media discovery sites and your personal Emby or Jellyfin server.

As you browse titles on IMDb, Trakt, Netflix, Amazon Prime Video, or JustWatch, the extension automatically detects the media and displays its availability status directly on the page. If a movie or show is missing from your collection, you can submit a request via Jellyseerr with a single click.

## Key Features

- **Real-time Detection:** Automatically identifies movies, series, seasons, and episodes on supported platforms.
- **Deep Integration:** Injects native-feeling UI elements (badges, sidebars, and buttons) into IMDb, Trakt, JustWatch, Netflix, and Amazon.
- **Search Engine Enhancement:** Adds a dedicated media status sidebar to Google and Bing search results.
- **One-Click Requests:** Integrated with Jellyseerr/Overseerr for instant media requests when content isn't found on your server.
- **Smart Deep Linking:** Jump directly from a discovery site to the playback page on your own Emby or Jellyfin instance.
- **Mobile Optimized:** Full support for Microsoft Edge on Android and iOS with touch-friendly controls.

### Screenshots

#### Configuration

<img width="434" height="653" alt="Screenshot 2026-02-14 at 8 32 41 PM" src="https://github.com/user-attachments/assets/51b7b2e7-9ab1-42dc-8128-a12a6dd85387" />
<img width="415" height="630" alt="Screenshot 2026-02-14 at 8 32 45 PM" src="https://github.com/user-attachments/assets/de9e28e5-eca7-4d0d-afc8-594d507c7c3e" />

#### Google/Bing Search

<img width="1840" height="1196" alt="Screenshot 2026-02-14 at 7 19 20 PM" src="https://github.com/user-attachments/assets/2112c21c-20c4-4e7f-bb43-f1511b174360" />
<img width="1840" height="1196" alt="Screenshot 2026-02-14 at 7 19 43 PM" src="https://github.com/user-attachments/assets/5ff73323-9aae-41ae-a912-91cd9e70a668" />
<img width="1260" height="648" alt="Screenshot 2026-02-14 at 8 31 17 PM" src="https://github.com/user-attachments/assets/8e8600c9-e6be-4fe5-bfa2-880b5ff2e764" />

#### IMDB

<img width="976" height="1196" alt="Screenshot 2026-02-14 at 7 19 02 PM" src="https://github.com/user-attachments/assets/bd663df4-cd9e-474b-a1c8-253c344a2d20" />

#### JustWatch

<img width="1047" height="621" alt="Screenshot 2026-02-14 at 8 34 30 PM" src="https://github.com/user-attachments/assets/38a1fa10-6189-45c0-bcdd-22b596c88f53" />

#### Trakt.tv

<img width="1840" height="1196" alt="Screenshot 2026-02-14 at 7 20 41 PM" src="https://github.com/user-attachments/assets/28f908dc-b934-482e-9cae-ec39cbfc22f8" />
<img width="1840" height="1196" alt="Screenshot 2026-02-14 at 8 32 05 PM" src="https://github.com/user-attachments/assets/233b3e16-d86c-4602-b51a-a62cc6661380" />

# Tech Stack

- Lit Element
- TypeScript
- Chromium Extension manifest v3
- Vite
- Vitest (for content scripts)
- Web Test Runner (for components)
- PlayWright for E2E

## Development

```bash
# Install dependencies
yarn install

# Start dev server
yarn dev

# Start sandbox dev server
yarn dev:sandbox

# Build the extension
yarn build:extension
```

## Testing

```bash
# Run all tests
yarn test

# Component tests (Web Test Runner + Playwright)
yarn test:wtr

# Unit tests (Vitest)
yarn test:unit

# Unit tests with coverage
yarn test:unit:coverage

# E2E tests (Playwright)
yarn test:e2e

# E2E tests with README report generation
yarn test:e2e:report

# Watch mode
yarn test:unit:watch
yarn test:watch
```

## Releasing & Publishing

This project uses [Changesets](https://github.com/changesets/changesets) to automate versioning and store publishing.

### Prerequisites

To allow the automated versioning to work, you must enable the following setting in your GitHub repository:

1.  Navigate to **Settings > Actions > General**.
2.  Scroll down to **Workflow permissions**.
3.  Check the box for **"Allow GitHub Actions to create and approve pull requests"**.
4.  Click **Save**.

### Release Workflow

To release a new version to the Chrome Web Store and Edge Add-ons, follow this workflow:

1.  **Create a Changeset:** Before pushing your feature branch, run the following command in your terminal:

    ```bash

    yarn changeset

    ```

    - Follow the interactive prompts to select the appropriate semver bump (major, minor, or patch).

    - Provide a concise summary of the changes for the changelog.

    - This will generate a new `.md` file in the `.changeset` directory. **Commit this file to your branch.**

2.  **Submit your PR:** Push your changes (including the changeset file) and open a Pull Request to `main`.

3.  **The Versioning PR:** Once your feature PR is merged into `main`, a GitHub Action will automatically detect the changeset and open a new PR titled **"Version Packages"**.

4.  **Merge the Versioning PR:** Merging the "Version Packages" PR into `main` will:
    - Automatically bump the `version` in `package.json` and `manifest.json`.

    - Update `CHANGELOG.md`.

    - Tag the repository with the new version.

    - **Trigger the Store Upload:** The `publish` workflow will run, building the extension and uploading it to both the Chrome Web Store and Microsoft Edge Add-ons store.

> [!IMPORTANT]

> Merging a feature PR directly into `main` **without** a changeset file will not trigger a store release. Always include a changeset if you want your changes to be published.
