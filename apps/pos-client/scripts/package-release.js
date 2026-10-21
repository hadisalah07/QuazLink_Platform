const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const webDownloads = path.resolve(root, '..', 'web', 'public', 'downloads');
const releaseDir = path.resolve(root, 'dist', 'release');
const legacyReleaseDir = path.resolve(root, 'dist', 'release-legacy');

if (!fs.existsSync(webDownloads)) {
  fs.mkdirSync(webDownloads, { recursive: true });
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '1.2.8';

console.log(`Copying modern Win 10/11 release (v${version})...`);
const setupModern = path.join(releaseDir, 'QuazLink-POS-Setup.exe');
const portableModern = path.join(releaseDir, 'QuazLink-POS-Portable.exe');

fs.copyFileSync(setupModern, path.join(webDownloads, `QuazLink-POS-Setup-v${version}.exe`));
fs.copyFileSync(setupModern, path.join(webDownloads, 'QuazLink-POS-Setup.exe'));
fs.copyFileSync(portableModern, path.join(webDownloads, 'QuazLink-POS-Portable.exe'));

console.log('Zipping modern portable...');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${portableModern}' -DestinationPath '${path.join(webDownloads, `QuazLink-POS-Portable-v${version}.zip`)}' -Force"`);
fs.copyFileSync(path.join(webDownloads, `QuazLink-POS-Portable-v${version}.zip`), path.join(webDownloads, 'QuazLink-POS-Portable.zip'));

console.log(`Copying legacy Win 7 release (v${version})...`);
const setupLegacy = path.join(legacyReleaseDir, 'QuazLink-POS-Legacy-Win7-Setup.exe');
const portableLegacy = path.join(legacyReleaseDir, 'QuazLink-POS-Legacy-Win7-Portable.exe');

fs.copyFileSync(setupLegacy, path.join(webDownloads, `QuazLink-POS-Legacy-Win7-Setup-v${version}.exe`));
fs.copyFileSync(setupLegacy, path.join(webDownloads, 'QuazLink-POS-Legacy-Win7-Setup.exe'));
fs.copyFileSync(portableLegacy, path.join(webDownloads, 'QuazLink-POS-Legacy-Win7-Portable.exe'));

console.log('Zipping legacy portable...');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${portableLegacy}' -DestinationPath '${path.join(webDownloads, `QuazLink-POS-Legacy-Win7-Portable-v${version}.zip`)}' -Force"`);
fs.copyFileSync(path.join(webDownloads, `QuazLink-POS-Legacy-Win7-Portable-v${version}.zip`), path.join(webDownloads, 'QuazLink-POS-Legacy-Win7-Portable.zip'));

console.log('✅ ALL DOWNLOAD ARTIFACTS PACKAGED SUCCESSFULLY!');
