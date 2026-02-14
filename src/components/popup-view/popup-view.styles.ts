import { css } from "lit";
import type { CSSResultOrNative } from "lit";
import { themeStyles } from "../../styles/theme.css.js";
import { typographyStyles } from "../../styles/typography.css.js";

/**
 * Styles for the popup-view component.
 */
export const popupViewStyles: CSSResultOrNative[] = [
  ...themeStyles,
  ...typographyStyles,
  css`
    :host {
      display: block;
      width: 380px;
      min-height: 500px;
      background: var(--color-primary-gradient);
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
      color: var(--color-text-primary);
    }

    .popup-container {
      padding: var(--space-md);
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding-bottom: var(--space-md);
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
      margin-bottom: var(--space-md);
    }

    .header-icon {
      display: flex;
      align-items: center;
    }

    .header h1 {
      font-size: 1.1rem;
      color: #fff;
      font-weight: 700;
    }

    .header p {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.7);
      margin: 0;
    }

    /* Section */
    .section {
      background: rgba(0, 0, 0, 0.25);
      border-radius: var(--radius-md);
      padding: var(--space-md);
      margin-bottom: var(--space-md);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-sm);
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    /* Server type toggle */
    .server-toggle {
      display: flex;
      gap: 0;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .server-toggle button {
      flex: 1;
      padding: var(--space-sm) var(--space-md);
      border: none;
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs);
    }

    .server-toggle button.active {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .server-toggle button:hover:not(.active) {
      background: rgba(255, 255, 255, 0.1);
    }

    /* Form elements */
    .form-group {
      margin-bottom: var(--space-sm);
    }

    .form-group label {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: var(--space-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .form-group input {
      width: 100%;
      padding: var(--space-sm) var(--space-sm);
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 0.85rem;
      outline: none;
      transition: border-color var(--transition-fast);
      box-sizing: border-box;
    }

    .form-group input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    .form-group input:focus {
      border-color: rgba(255, 255, 255, 0.5);
    }

    .form-hint {
      display: block;
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.45);
      margin-top: 2px;
      line-height: 1.3;
    }

    /* Input with inline action button */
    .input-with-action {
      display: flex;
      gap: var(--space-xs);
      align-items: stretch;
    }

    .input-with-action input {
      flex: 1;
      min-width: 0;
      width: auto;
    }

    .btn-probe {
      width: 100%;
      margin-top: var(--space-xs);
      padding: 6px var(--space-md);
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: var(--radius-sm);
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-probe:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .btn-probe:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-inline {
      padding: var(--space-sm) var(--space-sm);
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: var(--radius-sm);
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .btn-inline:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.25);
    }

    .btn-inline:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .status-inline {
      margin-top: var(--space-xs);
      padding: 4px var(--space-sm);
      font-size: 0.72rem;
    }

    /* Toggle switch */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      background: rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      cursor: pointer;
      transition: background var(--transition-fast);
    }

    .toggle-slider::before {
      content: "";
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
      background: var(--color-jellyseerr);
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    /* Buttons */
    .btn {
      width: 100%;
      padding: var(--space-sm) var(--space-md);
      border: none;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-primary {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }

    .btn-primary:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .btn-success {
      background: var(--color-success);
      color: #fff;
    }

    .btn-success:hover {
      opacity: 0.9;
    }

    /* Status messages */
    .status {
      padding: var(--space-sm);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      margin-top: var(--space-sm);
      text-align: center;
    }

    .status-success {
      background: rgba(76, 175, 80, 0.2);
      color: var(--color-success);
    }

    .status-error {
      background: rgba(244, 67, 54, 0.2);
      color: var(--color-error);
    }

    .status-loading {
      background: rgba(33, 150, 243, 0.2);
      color: var(--color-info);
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: var(--space-sm);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .footer p {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.4);
    }
  `,
];
