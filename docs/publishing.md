# Releasing & Publishing

This project uses [Changesets](https://github.com/changesets/changesets) to automate versioning and store publishing.

## Prerequisites

To allow automated publishing to work, you must configure your GitHub repository and obtain API credentials for the stores.

### 1. GitHub Repository Permissions

1.  **Enable PR Permissions:**
    - Navigate to **Settings > Actions > General**.
    - Scroll down to **Workflow permissions**.
    - Check the box for **"Allow GitHub Actions to create and approve pull requests"**.
    - Click **Save**.

2.  **Add a Personal Access Token (Optional but Recommended):**
    - The default `GITHUB_TOKEN` cannot trigger other workflows (like tests/linting) on the automated release PR.
    - To fix this, create a [Personal Access Token (classic)](https://github.com/settings/tokens/new) with `repo` and `workflow` scopes.
    - Add it as a Repository Secret named **`CHANGESET_TOKEN`** (**Settings > Secrets and variables > Actions**).
    - If this secret is missing, the workflow will fall back to `GITHUB_TOKEN`, but CI checks won't fire on release PRs.

### 2. Store API Credentials (Secrets)

Add the following secrets to your repository (**Settings > Secrets and variables > Actions**):

#### Chrome Web Store (`CHROME_...`)

- `CHROME_EXTENSION_ID`: Found in your Developer Dashboard URL.
- `CHROME_CLIENT_ID` & `CHROME_CLIENT_SECRET`: Generated in the [Google Cloud Console](https://console.cloud.google.com/) (Enable Chrome Web Store API).
- `CHROME_REFRESH_TOKEN`: Generated using the [Google OAuth Playground](https://developers.google.com/oauthplayground/).
  - **Note:** Ensure your Google Cloud Project is set to **"In Production"** on the OAuth consent screen to get a permanent refresh token.

#### Microsoft Edge Add-ons (`EDGE_...`)

- `EDGE_PRODUCT_ID`: Found under **Extension management > Product identity** in the Edge Partner Center.
- `EDGE_CLIENT_ID` & `EDGE_CLIENT_SECRET`:
  1. Navigate to **Settings (gear) > Account settings > Overview > User management**.
  2. **Important:** You must be signed in with your **Microsoft Entra** (formerly Azure AD) account to see the correct tabs.
  3. Select the **"Microsoft Entra Applications"** tab at the top.
  4. Create a new app:
     - **Name:** `ive-got-this-publishing`
     - **Reply URL:** `https://localhost` (not used by the API, but required by the UI).
  5. **Assign Roles:** Ensure you give it the **Manager** role (essential for publishing).
  6. The **Client ID** is the Application ID; generate a **Secret** under the app settings.

---

## Release Workflow

To release a new version, follow these steps:

1.  **Create a Changeset:** Before pushing your feature branch, run:

    ```bash
    yarn changeset
    ```

    - Follow the prompts to select the semver bump (major, minor, or patch).
    - Provide a concise summary of the changes.
    - Commit the generated `.md` file in the `.changeset` directory to your branch.

2.  **Submit your PR:** Push your changes and open a Pull Request to `main`.

3.  **The Versioning PR:** Once merged, a GitHub Action will open a new PR titled **"Version Packages"**.

4.  **Merge the Versioning PR:** Merging this PR into `main` will:
    - Bump the `version` in `package.json` and `manifest.json`.
    - Update `CHANGELOG.md`.
    - Tag the repository.
    - **Trigger the Store Upload:** The `publish` workflow will run, building the extension and uploading it to both the Chrome Web Store and Microsoft Edge Add-ons store.
