import { css } from "lit";
import type { CSSResultOrNative } from "lit";

/**
 * Shared typography styles for components that render text.
 * Import and spread into component styles.
 */
export const typographyStyles: CSSResultOrNative[] = [
  css`
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 0;
      font-weight: 600;
      color: var(--color-text-primary);
      line-height: 1.3;
    }

    h1 {
      font-size: 1.5rem;
    }
    h2 {
      font-size: 1.25rem;
    }
    h3 {
      font-size: 1.1rem;
    }
    h4 {
      font-size: 1rem;
    }

    p {
      margin: 0 0 var(--space-sm) 0;
      color: var(--color-text-secondary);
      line-height: 1.5;
      font-size: 0.875rem;
    }

    a {
      color: var(--color-primary-light);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    a:hover {
      color: var(--color-primary);
      text-decoration: underline;
    }

    .label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
    }

    .caption {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
  `,
];
