import { html } from "lit";

/**
 * Emby logo SVG icon.
 * @param size - Icon size in pixels (default: 24)
 */
export const embyIcon = (size = 24) => html`
  <svg
    width="${size}"
    height="${size}"
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Emby"
  >
    <path
      d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z"
      fill="#52B54B"
    />
    <path d="M152 130l208 126-208 126V130z" fill="#FFFFFF" />
  </svg>
`;
