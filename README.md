[![Web Test Runner](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/wtr.yml)
[![Vitest](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/vitest.yml)
[![Playwright E2E](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/e2e.yml)
[![Lint](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/lint.yml)
[![Build](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml/badge.svg)](https://github.com/quincarter/emby-chrome-extension/actions/workflows/build.yml)

# Emby/Jellyfin Media Connector

A Chrome Extension that connects to self-hosted Emby/Jellyfin media servers, detecting movies and TV shows on third-party sites and checking availability on your server.

## Features

- Detects media on IMDb, Trakt, Netflix, Amazon, Google/Bing Search
- Checks availability on your Emby or Jellyfin server
- Request missing media via Jellyseerr integration

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
