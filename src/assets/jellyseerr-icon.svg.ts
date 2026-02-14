import { html } from "lit";

/**
 * Jellyseerr logo SVG icon.
 * @param size - Icon size in pixels (default: 24)
 */
export const jellyseerrIcon = (size = 24) => html`
  <svg
    width="${size}"
    height="${size}"
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Jellyseerr"
  >
    <path
      d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z"
      fill="#7B2FBE"
    />
    <path
      d="M256 128c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128zm0 208c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z"
      fill="#FFFFFF"
      opacity="0.8"
    />
    <circle cx="256" cy="256" r="40" fill="#FFFFFF" />
    <path
      d="M256 80l16 40h-32l16-40zm0 352l-16-40h32l-16 40zM80 256l40-16v32l-40-16zm352 0l-40 16v-32l40 16z"
      fill="#FFFFFF"
      opacity="0.6"
    />
  </svg>
`;
