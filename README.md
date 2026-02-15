[![Web Test Runner](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml)
[![Vitest](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml)
[![Playwright E2E](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml)
[![Lint](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml)
[![Build](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml)

[![Vitest Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/vitest/vitest.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml)
[![WTR Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/wtr/wtr.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml)
[![E2E Pass Rate](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/quincarter/emby-chrome-extension/gh-badges/e2e/e2e.json)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml)

# Emby/Jellyfin Media Connector

A Chrome Extension that connects to self-hosted Emby/Jellyfin media servers, detecting movies and TV shows on third-party sites and checking availability on your server.

## Features

- Detects media on IMDb, Trakt, Netflix, Amazon, Google/Bing Search
- Checks availability on your Emby or Jellyfin server
- Request missing media via Jellyseerr integration

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
