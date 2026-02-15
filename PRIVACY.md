# Privacy Policy for "I've got this!" (Media Connector)

Last Updated: February 15, 2026

"I've got this!" is committed to protecting your privacy. This policy explains how our browser extension handles information.

## 1. Information Collection and Use

The extension does not collect any personal information about you. All data used by the extension is provided by you and stays within your local browser environment or is sent directly to your self-hosted servers.

### User-Provided Data

- **Server URLs and API Keys:** You provide the URLs and API keys for your private Emby, Jellyfin, and Jellyseerr instances. This information is stored locally in your browser using `chrome.storage.local` and is used solely to facilitate communication with your servers.
- **Media Detection:** When you browse supported sites (like IMDb or Trakt), the extension reads the title and year of the media on the page. This data is used only to check availability on your connected media server.

## 2. Information Sharing

We **do not** share, sell, or trade any user data with third parties. No data is sent to our own servers or any external tracking services. Communications occur exclusively between your browser and your self-hosted media infrastructure.

## 3. Data Storage and Security

- All configuration data (URLs and API keys) is stored locally on your device.
- We use the `cookies` permission exclusively to clear existing session cookies for your specific Jellyseerr domain to prevent CSRF errors during requests. We do not read or store cookie content.

## 4. Changes to This Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 5. Contact Us

If you have any questions about this Privacy Policy, you can contact the developer via the GitHub repository issues page.
