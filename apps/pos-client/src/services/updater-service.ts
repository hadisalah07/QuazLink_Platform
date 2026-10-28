import * as https from 'node:https';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, exec } from 'node:child_process';
import { URL } from 'node:url';

export interface PosUpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string;
  patchUrl?: string;
  patchSize?: number;
  assetSize: number;
  publishedAt: string;
  source?: 'platform' | 'github' | 'cached';
}

export type UpdateProgressCallback = (percent: number, downloadedMB: string, totalMB: string) => void;

const GITHUB_REPO_OWNER = 'hadisalah07';
const GITHUB_REPO_NAME = 'QuazLink_Platform';
const POS_ASSET_NAME = 'QuazLink-POS-Setup.exe';
export const CURRENT_VERSION = '1.4.0';

export class PosUpdaterService {
  private currentVersion: string = CURRENT_VERSION;
  private platformUrl: string = process.env.QUAZLINK_PLATFORM_URL || 'https://app.quazlink.site';
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
  public async checkForUpdates(telemetryParams?: Record<string, string>): Promise<PosUpdateCheckResult> {
    // 1. Try Platform API endpoint first
    try {
      const platformResult = await this.checkPlatformForUpdates(telemetryParams);
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
  public async checkPlatformForUpdates(telemetryParams?: Record<string, string>): Promise<PosUpdateCheckResult | null> {
    return new Promise((resolve, reject) => {
      let checkUrl = `${this.platformUrl}/api/pos/updates?currentVersion=${encodeURIComponent(this.currentVersion)}`;
      if (telemetryParams) {
        for (const [k, v] of Object.entries(telemetryParams)) {
          if (v !== undefined && v !== null) {
            checkUrl += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
          }
        }
      }

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
          timeout: 6000,
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

              let patchUrl = data.patchUrl || '';
              if (patchUrl && patchUrl.startsWith('/')) {
                patchUrl = `${this.platformUrl}${patchUrl}`;
              }

              const hasUpdate = this.isNewerVersion(data.latestVersion, this.currentVersion);

              resolve({
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion: data.latestVersion,
                releaseName: data.releaseName || `QuazLink POS v${data.latestVersion}`,
                releaseNotes: data.releaseNotes || 'تحسينات جديدة على النظام من منصة QuazLink.',
                downloadUrl,
                patchUrl: patchUrl || undefined,
                patchSize: data.patchSize || 0,
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
   * Sends standalone POS machine telemetry & specs directly to QuazLink Platform
   */
  public async sendTelemetryBeacon(telemetry: Record<string, any>): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const beaconUrl = `${this.platformUrl}/api/pos/telemetry`;
        const parsedUrl = new URL(beaconUrl);
        const postData = JSON.stringify(telemetry);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.request(
          beaconUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
              'User-Agent': 'QuazLink-POS-Client-Telemetry',
            },
            timeout: 7000,
          },
          (res) => {
            res.resume(); // Discard body
            resolve(res.statusCode === 200 || res.statusCode === 201);
          }
        );

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.write(postData);
        req.end();
      } catch {
        resolve(false);
      }
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

          console.log(`🚀 [PosUpdater] Spawning update installer with auto-relaunch: ${installerPath}`);
          const currentExe = process.execPath;
          const setupBase = path.basename(installerPath, path.extname(installerPath));
          const versionTag = this.cachedUpdate?.latestVersion ? `v${this.cachedUpdate.latestVersion}` : `v${this.currentVersion}`;

          // 1. Launch Visual Luxury Splash Progress Window so customer never faces a blank screen
          try {
            const splashAsset = path.join(__dirname, '..', 'assets', 'update-splash.ps1');
            const fallbackSplash = path.join(tempDir, 'update-splash.ps1');

            let finalSplashPath = '';
            if (fs.existsSync(splashAsset)) {
              finalSplashPath = splashAsset;
            } else if (fs.existsSync(fallbackSplash)) {
              finalSplashPath = fallbackSplash;
            }

            if (finalSplashPath) {
              const splash = spawn('powershell.exe', [
                '-ExecutionPolicy', 'Bypass',
                '-NoProfile',
                '-File', finalSplashPath,
                '-SetupProcessName', setupBase,
                '-TargetExe', currentExe || '',
                '-Version', versionTag
              ], {
                detached: true,
                stdio: 'ignore',
              });
              splash.unref();
            }
          } catch (e) {
            console.warn('⚠️ [PosUpdater] Could not launch visual splash:', e);
          }

          // 2. Run installer in silent mode with auto-relaunch
          const child = spawn(installerPath, ['/S', '--force-run'], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();

          // 3. Dual-layer watchdog: Guarantees application relaunches even if Windows session policies suppress NSIS ExecShell
          try {
            if (currentExe && fs.existsSync(currentExe)) {
              const fallbackCmd = `Start-Sleep -Seconds 5; Wait-Process -Name "${setupBase}" -Timeout 90 -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; if (-not (Get-Process -Name "QuazLink POS*" -ErrorAction SilentlyContinue)) { Start-Process -FilePath "${currentExe}" }`;
              const watchdog = spawn('powershell.exe', ['-WindowStyle', 'Hidden', '-NoProfile', '-Command', fallbackCmd], {
                detached: true,
                stdio: 'ignore',
              });
              watchdog.unref();
            }
          } catch (e) {
            console.warn('[PosUpdater] Watchdog setup skipped:', e);
          }

          // Exit current POS process so the installer can replace files cleanly
          setTimeout(() => process.exit(0), 1000);
        }, 1200);
      }

      return installerPath;
    } catch (err: any) {
      this.isDownloading = false;
      throw err;
    }
  }

  /**
   * Fast In-Place Code/UI Update (التحديث السريع في ثانيتين)
   * Downloads lightweight patch bundle (~1.5MB) and extracts it directly into the app directory,
   * then relaunches the application in 2-3 seconds without full NSIS reinstall.
   */
  public async applyFastPatch(
    patchUrl?: string,
    onProgress?: UpdateProgressCallback,
    onBeforeExit?: () => Promise<void> | void
  ): Promise<boolean> {
    if (this.isDownloading) {
      throw new Error('عملية تحميل التحديث جارية بالفعل في الخلفية.');
    }

    const url = patchUrl || this.cachedUpdate?.patchUrl;
    if (!url) {
      throw new Error('لم يتم العثور على حزمة تحديث سريع (Fast Patch).');
    }

    this.isDownloading = true;
    this.downloadProgress = { percent: 0, downloadedMB: '0', totalMB: '0' };

    try {
      const tempDir = path.join(os.tmpdir(), 'quazlink-pos-update');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const patchZip = path.join(tempDir, 'quazlink-patch.zip');
      if (fs.existsSync(patchZip)) {
        try { fs.unlinkSync(patchZip); } catch {}
      }

      await this.downloadWithRedirects(url, patchZip, (percent, dlMB, totMB) => {
        this.downloadProgress = { percent, downloadedMB: dlMB, totalMB: totMB };
        onProgress?.(percent, dlMB, totMB);
      });

      this.isDownloading = false;

      // Determine target app root directory
      let targetAppDir = '';
      const resourcesPath = (process as any).resourcesPath;
      if (resourcesPath && typeof resourcesPath === 'string') {
        const candidate = path.join(resourcesPath, 'app');
        if (fs.existsSync(candidate)) {
          targetAppDir = candidate;
        }
      }
      if (!targetAppDir) {
        targetAppDir = path.resolve(__dirname, '..', '..');
      }

      console.log(`⚡ [PosUpdater] Fast patch downloaded, extracting to: ${targetAppDir}`);

      if (process.platform === 'win32') {
        if (onBeforeExit) {
          try { await onBeforeExit(); } catch {}
        }

        const currentExe = process.execPath;
        const currentPid = process.pid;
        const exeDir = path.dirname(currentExe);
        const scriptPath = path.join(tempDir, 'quazlink-fast-patch.ps1');

        const psScript = `
$ErrorActionPreference = "Continue"
$logPath = "$env:USERPROFILE\\.quazlink\\patch_updater.log"

function Write-PatchLog($msg) {
    $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    Add-Content -Path $logPath -Value "[$time] $msg" -ErrorAction SilentlyContinue
}

Write-PatchLog "=== Fast Patch Started (Target PID: ${currentPid}) ==="

# 1. Wait for the primary Electron process to exit
Write-PatchLog "Waiting for PID ${currentPid} to exit..."
Wait-Process -Id ${currentPid} -Timeout 15 -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

# 2. Terminate any lingering child worker processes holding resources
Get-Process -Name "QuazLink POS*" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Id -ne $PID) {
        Write-PatchLog "Stopping lingering process ID: $($_.Id)"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Milliseconds 400

# 3. Extract patch with retry mechanism (handles transient file locks)
$extracted = $false
for ($i = 1; $i -le 6; $i++) {
    Write-PatchLog "Extracting patch (attempt $i/6)..."
    try {
        Expand-Archive -Path "${patchZip}" -DestinationPath "${targetAppDir}" -Force -ErrorAction Stop
        $extracted = $true
        Write-PatchLog "Extraction successful on attempt $i."
        break
    } catch {
        Write-PatchLog "Attempt $i failed: $($_.Exception.Message)"
        Start-Sleep -Milliseconds 800
    }
}

if (-not $extracted) {
    Write-PatchLog "ERROR: Failed to extract patch after 6 attempts."
}

# 4. Relaunch the application
Start-Sleep -Milliseconds 500
if (Test-Path "${currentExe}") {
    Write-PatchLog "Relaunching: ${currentExe} in ${exeDir}"
    Start-Process -FilePath "${currentExe}" -WorkingDirectory "${exeDir}"
    Write-PatchLog "Application relaunch command dispatched."
} else {
    Write-PatchLog "ERROR: Cannot find executable at: ${currentExe}"
}

Write-PatchLog "=== Fast Patch Process Complete ==="
`;

        fs.writeFileSync(scriptPath, psScript, 'utf8');

        const wmicCmd = `wmic process call create "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \\"${scriptPath}\\""`;
        exec(wmicCmd, (err) => {
          if (err) {
            console.error('⚠️ [PosUpdater] WMIC process spawn failed, fallback to direct spawn:', err);
            const helper = spawn('powershell.exe', [
              '-ExecutionPolicy', 'Bypass',
              '-WindowStyle', 'Hidden',
              '-NoProfile',
              '-File', scriptPath,
            ], {
              detached: true,
              stdio: 'ignore',
            });
            helper.unref();
          }
          setTimeout(() => process.exit(0), 600);
        });
        return true;
      } else {
        throw new Error('Fast patch extraction is currently supported on Windows.');
      }
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
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
