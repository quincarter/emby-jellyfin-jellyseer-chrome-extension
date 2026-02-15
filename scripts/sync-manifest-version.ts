import fs from 'fs';
import path from 'path';

/**
 * Synchronizes the version from package.json to manifest.json.
 */
function syncVersion() {
  const packageJsonPath = path.resolve('package.json');
  const manifestJsonPath = path.resolve('manifest.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf-8'));

  if (manifestJson.version !== packageJson.version) {
    console.log(`Syncing manifest.json version: ${manifestJson.version} -> ${packageJson.version}`);
    manifestJson.version = packageJson.version;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');
  } else {
    console.log(`Versions are already in sync: ${packageJson.version}`);
  }
}

syncVersion();
