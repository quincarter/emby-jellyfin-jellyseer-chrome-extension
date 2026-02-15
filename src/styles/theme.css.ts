import { css } from 'lit';
import type { CSSResultOrNative } from 'lit';

/**
 * Global CSS custom properties for the extension theme.
 * Import and spread into component styles for consistent theming.
 */
export const themeStyles: CSSResultOrNative[] = [
  css`
    :host {
      /* Purple gradient palette */
      --color-primary: #7b2fbe;
      --color-primary-light: #9b59d0;
      --color-primary-dark: #5a1f8e;
      --color-primary-gradient: linear-gradient(135deg, #7b2fbe 0%, #4a0e78 100%);

      /* Server brand colors */
      --color-emby: #52b54b;
      --color-jellyfin: #00a4dc;
      --color-jellyseerr: #7b2fbe;

      /* Status colors */
      --color-success: #4caf50;
      --color-warning: #ff9800;
      --color-error: #f44336;
      --color-info: #2196f3;

      /* Neutrals */
      --color-bg-primary: #1a1a2e;
      --color-bg-secondary: #16213e;
      --color-bg-surface: #0f3460;
      --color-bg-input: #1e2747;
      --color-text-primary: #e0e0e0;
      --color-text-secondary: #a0a0b0;
      --color-text-muted: #6c6c80;
      --color-border: #2a2a4a;

      /* Spacing */
      --space-xs: 4px;
      --space-sm: 8px;
      --space-md: 16px;
      --space-lg: 24px;
      --space-xl: 32px;

      /* Border radius */
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-round: 50%;

      /* Shadows */
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
      --shadow-lg: 0 10px 20px rgba(0, 0, 0, 0.5);

      /* Transitions */
      --transition-fast: 150ms ease;
      --transition-normal: 250ms ease;
    }
  `,
];
