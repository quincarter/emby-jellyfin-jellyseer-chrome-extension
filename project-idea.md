
This extension will be a connector for Emby and Jellyfin, a self hosted media server. I want the base functionality to recognize when you are on a movie or tv show page (like trakt.tv, imdb, netflix, amazon prime video, google and bing search pages when a movie is shown), show an emby/jellyfin icon to take the user to the item in their library on their configured server address. When on tv shows, we should recognize when the user is at the show level, season level, and episode level and verify if the episode exists in their db, if it is, take them to it at the desired level based on where they are located.

This should also connect to Jellyseer, a self hosted request platform to request the movie or tv show directly from the page they are on. This may popup in the extension panel or as a modal if we are able to do that. I want to support both and have it configurable as a setting.

The extension popup should consist of a few things - Emby/Jellyfin selection for server type. API Key entry, server url, and any configurable options they want to show. Also optionally configure Jellyseer in the same way as a toggle switch with API Key and server URL. Once that is configured, we will store that in extension storage safely. Make the popup pretty with Emby, Jellyfin, and Jellyseer icons (svg). With a purple gradient background.

Build a sandbox page with mock data so i can test the components without needing to be on the pages to render them. This should also have a toggle switch to be able to use real data from the configurable APIs.

Service worker should be implemented.

Tests should be implemented. Use web-test-runner (wtr) for the web components testing.

Keep files small.

Always run a build and test after each feature implementation to ensure things are not broken.