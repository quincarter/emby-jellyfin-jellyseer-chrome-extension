import { html } from "lit";

/**
 * Jellyfin logo SVG icon.
 * @param size - Icon size in pixels (default: 24)
 */
export const jellyfinIcon = (size = 24) => html`
  <svg
    width="${size}"
    height="${size}"
    viewBox="0 0 512 512"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Jellyfin"
  >
    <path
      d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z"
      fill="#00A4DC"
    />
    <path
      d="M256 96c-88.4 0-160 71.6-160 160s71.6 160 160 160 160-71.6 160-160S344.4 96 256 96zm0 272c-61.9 0-112-50.1-112-112s50.1-112 112-112 112 50.1 112 112-50.1 112-112 112z"
      fill="#FFFFFF"
      opacity="0.6"
    />
    <path
      d="M256 176c-44.2 0-80 35.8-80 80s35.8 80 80 80 80-35.8 80-80-35.8-80-80-80zm0 112c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z"
      fill="#FFFFFF"
    />
  </svg>
`;
