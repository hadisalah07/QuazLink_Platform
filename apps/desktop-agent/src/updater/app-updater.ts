import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
  assetSize: number;
}

export type ProgressCallback = (percent: number, downloadedMB: string, totalMB: string) => void;
export type LogCallback = (message: string, type?: 'highlight' | 'success' | 'warn' | 'red') => void;

const GITHUB_REPO_OWNER = 'hadisalah07';
const GITHUB_REPO_NAME = 'QuazLink_Platform';
const ALLOWED_ASSET_NAME = 'QuazLink-Runner-Setup.exe';

/**
 * Validates whether a target download URL belongs strictly to the verified GitHub release endpoints.
 */
function isAllowedDownloadUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;

    // Direct GitHub release download path
    if (
      parsed.hostname === 'github.com' &&
      parsed.pathname.startsWith(`/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/`)
    ) {
      return true;
    }

    // GitHub AWS S3/Azure objects redirect CDN for releases
    if (parsed.hostname === 'objects.githubusercontent.com') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Compares two semantic version strings (e.g. 'v26.9.6' vs '26.9.5').
 * Returns true if latest is strictly newer than current.
 */
export function isNewerVersion(latestTag: string, currentVersion: string): boolean {
  const cleanLatest = latestTag.replace(/^v/i, '').trim();
  const cleanCurrent = currentVersion.replace(/^v/i, '').trim();

  if (cleanLatest === cleanCurrent) return false;

  const latestParts = cleanLatest.split('.').map((n) => parseInt(n, 10) || 0);
  const currentParts = cleanCurrent.split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < len; i++) {
    const l = latestParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export class AppUpdater {
  private cachedLatestRelease: UpdateCheckResult | null = null;
  private isDownloading = false;

  /**
   * Checks GitHub Releases API for the latest published version.
   */
  public async checkForUpdates(currentVersion: string, logger?: LogCallback): Promise<UpdateCheckResult> {
    logger?.(`[UPDATE] Checking for updates against GitHub Releases...`, 'highlight');

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
        headers: {
          'User-Agent': 'QuazLink-Desktop-Runner-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      const req = https.get(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            const err = new Error(`GitHub API returned status ${res.statusCode}`);
            logger?.(`[UPDATE] ⚠️ Update check failed: ${err.message}`, 'warn');
            return reject(err);
          }

          try {
            const release = JSON.parse(rawData);
            const latestTag = release.tag_name || '';
            const assets: any[] = release.assets || [];

            // Locate official installer asset
            const asset = assets.find((a) => a.name === ALLOWED_ASSET_NAME) || assets.find((a) => a.name.endsWith('.exe'));

            if (!asset) {
              const err = new Error(`Installer asset ${ALLOWED_ASSET_NAME} not found in release ${latestTag}`);
              logger?.(`[UPDATE] ⚠️ ${err.message}`, 'warn');
              return reject(err);
            }

            const hasUpdate = isNewerVersion(latestTag, currentVersion);

            const result: UpdateCheckResult = {
              hasUpdate,
              currentVersion,
              latestVersion: latestTag,
              releaseName: release.name || latestTag,
              releaseNotes: release.body || '',
              downloadUrl: asset.browser_download_url,
              assetSize: asset.size || 0,
            };

            this.cachedLatestRelease = result;

            if (hasUpdate) {
              logger?.(`[UPDATE] 🚀 New version available: ${latestTag} (Current: v${currentVersion})`, 'success');
            } else {
              logger?.(`[UPDATE] ✅ Runner is up to date (v${currentVersion}).`, 'success');
            }

            resolve(result);
          } catch (e: any) {
            logger?.(`[UPDATE] ❌ Error parsing release data: ${e.message}`, 'red');
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        logger?.(`[UPDATE] ❌ Network error checking updates: ${err.message}`, 'red');
        reject(err);
      });

      req.setTimeout(15000, () => {
        req.destroy(new Error('Update check request timed out after 15s.'));
      });
    });
  }

  /**
   * Securely streams and downloads the update installer, following redirects,
   * validating file size, launching the installer, and gracefully terminating the runner.
   */
  public async downloadAndInstall(
    targetUrl?: string,
    onProgress?: ProgressCallback,
    logger?: LogCallback,
    onBeforeQuit?: () => Promise<void> | void
  ): Promise<void> {
    if (this.isDownloading) {
      throw new Error('An update download is already in progress.');
    }

    const downloadUrl = targetUrl || this.cachedLatestRelease?.downloadUrl;
    if (!downloadUrl) {
      throw new Error('No valid download URL available. Please check for updates first.');
    }

    // Strict security URL check
    if (!isAllowedDownloadUrl(downloadUrl)) {
      throw new Error(`Security Violation: Download URL '${downloadUrl}' is not permitted.`);
    }

    this.isDownloading = true;

    try {
      const updateDir = path.join(os.tmpdir(), 'quazlink-update');
      if (!fs.existsSync(updateDir)) {
        fs.mkdirSync(updateDir, { recursive: true });
      }

      const installerPath = path.join(updateDir, ALLOWED_ASSET_NAME);
      // Clean up previous temp installer if present
      if (fs.existsSync(installerPath)) {
        try {
          fs.unlinkSync(installerPath);
        } catch {}
      }

      logger?.(`[UPDATE] Starting download of ${ALLOWED_ASSET_NAME}...`, 'highlight');

      await this.downloadWithRedirects(downloadUrl, installerPath, onProgress, 0);

      // Verify integrity (minimum expected size ~20MB)
      const stats = fs.statSync(installerPath);
      if (stats.size < 20 * 1024 * 1024) {
        throw new Error(`Downloaded installer size (${(stats.size / 1024 / 1024).toFixed(1)}MB) is invalid.`);
      }

      logger?.(`[UPDATE] ✅ Download verified (${(stats.size / 1024 / 1024).toFixed(1)}MB). Preparing installer...`, 'success');

      if (onBeforeQuit) {
        logger?.(`[UPDATE] Closing services and releasing locks...`, 'highlight');
        await onBeforeQuit();
      }

      logger?.(`[UPDATE] 🚀 Launching installer and restarting runner...`, 'success');

      // Small delay to ensure all file writes and sockets flush cleanly
      await new Promise((r) => setTimeout(r, 600));

      const child = spawn(installerPath, [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Gracefully exit current process so NSIS installer can overwrite binaries
      process.exit(0);
    } catch (err: any) {
      this.isDownloading = false;
      logger?.(`[UPDATE] ❌ Update failed: ${err.message}`, 'red');
      throw err;
    }
  }

  private downloadWithRedirects(
    url: string,
    destination: string,
    onProgress?: ProgressCallback,
    redirectCount = 0
  ): Promise<void> {
    if (redirectCount > 6) {
      return Promise.reject(new Error('Too many HTTP redirects during download.'));
    }

    if (!isAllowedDownloadUrl(url)) {
      return Promise.reject(new Error(`Security Violation: Redirect to unauthorized host '${url}'`));
    }

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = https.get(
        parsedUrl,
        {
          headers: {
            'User-Agent': 'QuazLink-Desktop-Runner-Updater',
          },
        },
        (res) => {
          // Handle HTTP 301, 302, 307, 308 redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = res.headers.location;
            this.downloadWithRedirects(redirectUrl, destination, onProgress, redirectCount + 1)
              .then(resolve)
              .catch(reject);
            return;
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP error ${res.statusCode} while downloading installer.`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          const file = fs.createWriteStream(destination);

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
              const downMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
              const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
              onProgress(pct, downMB, totalMB);
            }
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close(() => resolve());
          });

          file.on('error', (err) => {
            fs.unlink(destination, () => {});
            reject(err);
          });
        }
      );

      req.on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });

      req.setTimeout(60000, () => {
        req.destroy(new Error('Download connection timed out.'));
      });
    });
  }
}
