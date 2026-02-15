import { css } from 'lit';
import type { CSSResultOrNative } from 'lit';
import { themeStyles } from '../styles/theme.css.js';
import { typographyStyles } from '../styles/typography.css.js';

/**
 * Styles for the sandbox-app component.
 */
export const sandboxAppStyles: CSSResultOrNative[] = [
  ...themeStyles,
  ...typographyStyles,
  css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }

    .sandbox-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: var(--space-lg);
    }

    /* Header */
    .sandbox-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: var(--space-lg);
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-lg);
    }

    .sandbox-header h1 {
      font-size: 1.5rem;
      color: #fff;
    }

    .sandbox-header p {
      color: var(--color-text-secondary);
    }

    /* Mode toggle */
    .mode-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      background: var(--color-bg-secondary);
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--radius-md);
    }

    .mode-toggle label {
      font-size: 0.85rem;
      color: var(--color-text-secondary);
      cursor: pointer;
    }

    .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
    }

    .toggle-switch input {
      display: none;
    }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: var(--color-primary-dark);
      border-radius: 12px;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: var(--radius-round);
      transition: transform var(--transition-fast);
    }

    .toggle-switch input:checked + .toggle-slider {
      background: var(--color-success);
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    /* Sections */
    .section {
      margin-bottom: var(--space-xl);
    }

    .section h2 {
      font-size: 1.1rem;
      margin-bottom: var(--space-md);
      color: var(--color-primary-light);
    }

    /* Card grid */
    .scenario-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-md);
    }

    .scenario-card {
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-md);
    }

    .scenario-card h3 {
      font-size: 0.9rem;
      margin-bottom: var(--space-xs);
    }

    .scenario-meta {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-bottom: var(--space-sm);
    }

    .scenario-badge {
      margin-top: var(--space-sm);
    }

    /* Popup preview */
    .popup-preview {
      display: flex;
      justify-content: center;
    }

    .popup-frame {
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    /* Real data section */
    .real-data-section {
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-md);
    }

    .real-data-section .form-group {
      margin-bottom: var(--space-sm);
    }

    .real-data-section label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-xs);
    }

    .real-data-section input {
      width: 100%;
      padding: var(--space-sm);
      background: var(--color-bg-input);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      color: var(--color-text-primary);
      font-size: 0.85rem;
      outline: none;
      box-sizing: border-box;
    }

    .real-data-section input:focus {
      border-color: var(--color-primary);
    }

    .btn {
      padding: var(--space-sm) var(--space-md);
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-primary {
      background: var(--color-primary);
      color: #fff;
    }

    .btn-primary:hover {
      background: var(--color-primary-light);
    }

    .result-display {
      margin-top: var(--space-md);
      padding: var(--space-sm);
      background: rgba(0, 0, 0, 0.3);
      border-radius: var(--radius-sm);
      font-family: monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }
  `,
];
