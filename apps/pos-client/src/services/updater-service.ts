import * as https from 'node:https';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

export interface PosUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
  assetSize: number;
  publishedAt: string;
  source?: 'platform' | 'github' | 'cached';
}

export type UpdateProgressCallback = (percent: number, downloadedMB: string, totalMB: string) => void;

const GITHUB_REPO_OWNER = 'hadisalah07';
const GITHUB_REPO_NAME = 'QuazLink_Platform';
const POS_ASSET_NAME = 'QuazLink-POS-Setup.exe';
export const CURRENT_VERSION = '1.1.0';

export class PosUpdaterService {
  private currentVersion: string = CURRENT_VERSION;
  private platformUrl: string = process.env.QUAZLINK_PLATFORM_URL || 'http://localhost:3000';
  private isDownloading: boolean = false;
  private cachedUpdate: PosUpdateCheckResult | null = null;
  private downloadProgress = { percent: 0, downloadedMB: '0', totalMB: '0' };

  constructor(currentVersion?: string, platformUrl?: string) {
    if (currentVersion) {
      this.currentVersion = currentVersion;
    }
    if (platformUrl) {
      this.platformUrl = platformUrl.replace(/\/$/, '');
    }
  }

  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  public setPlatformUrl(url: string): void {
    if (url) {
      this.platformUrl = url.replace(/\/$/, '');
    }
  }

  public getPlatformUrl(): string {
    return this.platformUrl;
  }

  public getDownloadStatus() {
    return {
      isDownloading: this.isDownloading,
      ...this.downloadProgress,
    };
  }

  /**
   * Compares two semantic version strings (e.g. '1.1.0' vs '1.0.0').
   * Returns true if latest is strictly newer than current.
   */
  public isNewerVersion(latestTag: string, currentVersion: string): boolean {
    const cleanLatest = (latestTag || '').replace(/^pos-v|^v/i, '').trim();
    const cleanCurrent = (currentVersion || '').replace(/^pos-v|^v/i, '').trim();

    if (!cleanLatest || !cleanCurrent) return false;
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

  /**
   * Primary check: queries QuazLink Platform API (/api/pos/updates).
   * Fallback: queries GitHub Releases API.
   */
  public async checkForUpdates(): Promise<PosUpdateCheckResult> {
    // 1. Try Platform API endpoint first
    try {
      const platformResult = await this.checkPlatformForUpdates();
      if (platformResult) {
        this.cachedUpdate = platformResult;
        return platformResult;
      }
    } catch (err: any) {
      console.warn('⚠️ [PosUpdater] Platform update check skipped/failed:', err?.message || err);
    }

    // 2. Fallback to GitHub Releases API
    try {
      const githubResult = await this.checkGitHubForUpdates();
      this.cachedUpdate = githubResult;
      return githubResult;
    } catch (err: any) {
      console.warn('⚠️ [PosUpdater] GitHub update check skipped/failed:', err?.message || err);
    }

    // 3. Fallback: No updates or offline
    const fallback: PosUpdateCheckResult = {
      hasUpdate: false,
      currentVersion: this.currentVersion,
      latestVersion: this.currentVersion,
      releaseName: `QuazLink POS v${this.currentVersion}`,
      releaseNotes: 'النظام محدث أو خادم التحديثات غير متاح مؤقتاً.',
      downloadUrl: '',
      assetSize: 0,
      publishedAt: new Date().toISOString(),
      source: 'cached',
    };
    this.cachedUpdate = fallback;
    return fallback;
  }

  /**
   * Queries the official QuazLink Platform web endpoint
   */
  public async checkPlatformForUpdates(): Promise<PosUpdateCheckResult | null> {
    return new Promise((resolve, reject) => {
      const checkUrl = `${this.platformUrl}/api/pos/updates?currentVersion=${encodeURIComponent(this.currentVersion)}`;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(checkUrl);
      } catch (e) {
        return reject(e);
      }

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.get(
        checkUrl,
        {
          headers: {
            'User-Agent': 'QuazLink-POS-Client-Updater',
            Accept: 'application/json',
          },
          timeout: 5000,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) {
              return reject(new Error(`Platform returned HTTP status ${res.statusCode}`));
            }
            try {
              const data = JSON.parse(rawData);
              if (!data || !data.latestVersion) {
                return reject(new Error('Invalid JSON response from platform updater'));
              }

              let downloadUrl = data.downloadUrl || '';
              if (downloadUrl.startsWith('/')) {
                downloadUrl = `${this.platformUrl}${downloadUrl}`;
              }

              const hasUpdate = this.isNewerVersion(data.latestVersion, this.currentVersion);

              resolve({
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion: data.latestVersion,
                releaseName: data.releaseName || `QuazLink POS v${data.latestVersion}`,
                releaseNotes: data.releaseNotes || 'تحسينات جديدة على النظام من منصة QuazLink.',
                downloadUrl,
                assetSize: data.assetSize || 0,
                publishedAt: data.publishedAt || new Date().toISOString(),
                source: 'platform',
              });
            } catch (e: any) {
              reject(e);
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Platform update check timed out after 5 seconds'));
      });
    });
  }

  /**
   * Queries GitHub Releases API for public release artifacts
   */
  public async checkGitHubForUpdates(): Promise<PosUpdateCheckResult> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
        headers: {
          'User-Agent': 'QuazLink-POS-Client-Updater',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      const req = https.get(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`GitHub API returned status ${res.statusCode}`));
          }

          try {
            const releases: any[] = JSON.parse(rawData);
            if (!Array.isArray(releases) || releases.length === 0) {
              return resolve({
                hasUpdate: false,
                currentVersion: this.currentVersion,
                latestVersion: this.currentVersion,
                releaseName: 'QuazLink POS v' + this.currentVersion,
                releaseNotes: 'النظام محدث لأحدث إصدار.',
                downloadUrl: '',
                assetSize: 0,
                publishedAt: new Date().toISOString(),
                source: 'github',
              });
            }

            // Find latest release containing POS setup asset or matching tag
            let targetRelease = releases.find((r) => {
              const tag = (r.tag_name || '').toLowerCase();
              return tag.startsWith('pos-') || r.assets?.some((a: any) => a.name === POS_ASSET_NAME);
            });

            if (!targetRelease) {
              targetRelease = releases[0];
            }

            const assets: any[] = targetRelease.assets || [];
            const posAsset =
              assets.find((a: any) => a.name === POS_ASSET_NAME) ||
              assets.find((a: any) => a.name.endsWith('.exe'));

            const rawTag = targetRelease.tag_name || '1.0.0';
            const cleanLatestVer = rawTag.replace(/^pos-v|^v/i, '');
            const hasUpdate = this.isNewerVersion(cleanLatestVer, this.currentVersion);

            const result: PosUpdateCheckResult = {
              hasUpdate,
              currentVersion: this.currentVersion,
              latestVersion: cleanLatestVer,
              releaseName: targetRelease.name || `QuazLink POS v${cleanLatestVer}`,
              releaseNotes: targetRelease.body || 'تحسينات عامة على استقرار النظام وإصلاحات برمجية.',
              downloadUrl: posAsset ? posAsset.browser_download_url : '',
              assetSize: posAsset ? posAsset.size : 0,
              publishedAt: targetRelease.published_at || new Date().toISOString(),
              source: 'github',
            };

            resolve(result);
          } catch (e: any) {
            reject(new Error(`Failed to parse GitHub releases data: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(8000, () => {
        req.destroy(new Error('GitHub update check timed out after 8 seconds'));
      });
    });
  }

  /**
   * Downloads and executes the installer update.
   */
  public async downloadAndApplyUpdate(
    downloadUrl?: string,
    onProgress?: UpdateProgressCallback,
    onBeforeExit?: () => Promise<void> | void
  ): Promise<string> {
    if (this.isDownloading) {
      throw new Error('عملية تحميل التحديث جارية بالفعل في الخلفية.');
    }

    const url = downloadUrl || this.cachedUpdate?.downloadUrl;
    if (!url) {
      throw new Error('لم يتم العثور على رابط تحميل متاح للتحديث.');
    }

    this.isDownloading = true;
    this.downloadProgress = { percent: 0, downloadedMB: '0', totalMB: '0' };

    try {
      const tempDir = path.join(os.tmpdir(), 'quazlink-pos-update');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const installerPath = path.join(tempDir, POS_ASSET_NAME);
      if (fs.existsSync(installerPath)) {
        try {
          fs.unlinkSync(installerPath);
        } catch {}
      }

      await this.downloadWithRedirects(url, installerPath, (percent, dlMB, totMB) => {
        this.downloadProgress = { percent, downloadedMB: dlMB, totalMB: totMB };
        onProgress?.(percent, dlMB, totMB);
      });

      this.isDownloading = false;

      // Launch installer
      if (process.platform === 'win32') {
        setTimeout(async () => {
          if (onBeforeExit) {
            try {
              await onBeforeExit();
            } catch {}
          }

          console.log(`🚀 [PosUpdater] Spawning update installer: ${installerPath}`);
          const child = spawn(installerPath, [], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();

          // Exit current POS process so the installer can replace files cleanly
          setTimeout(() => process.exit(0), 1000);
        }, 1500);
      }

      return installerPath;
    } catch (err: any) {
      this.isDownloading = false;
      throw err;
    }
  }

  private downloadWithRedirects(
    urlStr: string,
    destPath: string,
    onProgress?: UpdateProgressCallback,
    redirectCount = 0
  ): Promise<void> {
    if (redirectCount > 8) {
      return Promise.reject(new Error('Too many HTTP redirects during download.'));
    }

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: {
            'User-Agent': 'QuazLink-POS-Client-Updater',
            Accept: '*/*',
          },
        },
        (res) => {
          // Handle HTTP 301, 302, 303, 307, 308 redirects
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
            const redirectLocation = res.headers.location;
            if (!redirectLocation) {
              return reject(new Error(`Redirect response missing location header (Status: ${res.statusCode})`));
            }
            res.resume();
            const nextUrl = new URL(redirectLocation, urlStr).toString();
            return resolve(this.downloadWithRedirects(nextUrl, destPath, onProgress, redirectCount + 1));
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Failed to download installer (HTTP ${res.statusCode})`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : 'Unknown';
          let downloadedBytes = 0;

          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            const downloadedMB = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            onProgress?.(percent, downloadedMB, totalMB);
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve());
          });

          fileStream.on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
        }
      );

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });

      req.setTimeout(60000, () => {
        req.destroy(new Error('Download connection timed out'));
      });
    });
  }
}
