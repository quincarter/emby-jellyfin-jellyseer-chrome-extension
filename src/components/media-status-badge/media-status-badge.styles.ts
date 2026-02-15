import { css } from 'lit';
import type { CSSResultOrNative } from 'lit';
import { themeStyles } from '../../styles/theme.css.js';

/**
 * Styles for the media-status-badge component.
 */
export const mediaStatusBadgeStyles: CSSResultOrNative[] = [
  ...themeStyles,
  css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      min-height: 44px;
      box-sizing: border-box;
      border-radius: var(--radius-md);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
      font-size: 0.8rem;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      transition:
        opacity var(--transition-fast),
        transform var(--transition-fast);
      text-decoration: none;
    }

    .badge:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }

    .badge--available {
      background: linear-gradient(135deg, #4caf50, #2e7d32);
    }

    .badge--partial {
      background: linear-gradient(135deg, #ff9800, #e65100);
    }

    .badge--unavailable {
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
    }

    .badge--loading {
      background: linear-gradient(135deg, #616161, #424242);
      pointer-events: none;
    }

    .badge--error {
      background: linear-gradient(135deg, #f44336, #b71c1c);
    }

    .badge--unconfigured {
      background: linear-gradient(135deg, #616161, #424242);
    }

    .badge-icon {
      display: flex;
      align-items: center;
    }

    .badge-text {
      white-space: nowrap;
    }

    /* Loading spinner */
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: var(--radius-round);
      animation: spin 0.8s linear infinite;
    }
  `,
];
