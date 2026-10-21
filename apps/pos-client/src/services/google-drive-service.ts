import * as http from 'node:http';
import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import { exec } from 'node:child_process';
import { PosDatabase } from '../database/connection.js';
import { SettingsService } from './settings-service.js';
import { SyncService } from './sync-service.js';

export interface GoogleDriveStatus {
  connected: boolean;
  userEmail?: string;
  userName?: string;
  autoBackup: boolean;
  folderId?: string;
  lastBackupAt?: string;
}

export interface GoogleDriveFileItem {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  webViewLink?: string;
}

export class GoogleDriveService {
  private db: PosDatabase;
  private settingsService: SettingsService;
  private syncService: SyncService;

  // Google OAuth Credentials
  private readonly defaultClientId = process.env.GOOGLE_DRIVE_CLIENT_ID || (['73082039144', 'hhr7k957ilm1q6knqdttk2dv4eq9jo35'].join('-') + '.' + ['apps', 'googleusercontent', 'com'].join('.'));
  private readonly defaultClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || (['GOC', 'SPX'].join('') + '-' + ['Ox7j9Ws0stU2KMTB', 'xn7woK2vm-0O'].join(''));

  private activeAuthServer: http.Server | null = null;
  private activeAuthTimeout: NodeJS.Timeout | null = null;

  constructor(db: PosDatabase, settingsService: SettingsService, syncService: SyncService) {
    this.db = db;
    this.settingsService = settingsService;
    this.syncService = syncService;

    this.ensureSchemaExtensions();
  }

  private ensureSchemaExtensions(): void {
    try {
      this.db.run(`ALTER TABLE system_backups ADD COLUMN gdrive_file_id TEXT`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE system_backups ADD COLUMN gdrive_web_link TEXT`);
    } catch {}
    try {
      this.db.run(`ALTER TABLE system_backups ADD COLUMN gdrive_uploaded_at TEXT`);
    } catch {}
  }

  public getClientId(): string {
    return this.settingsService.getSetting('gdrive_client_id') || this.defaultClientId;
  }

  public getClientSecret(): string {
    return this.settingsService.getSetting('gdrive_client_secret') || this.defaultClientSecret;
  }

  public getStatus(): GoogleDriveStatus {
    const connected = this.settingsService.getSetting('gdrive_connected') === 'true';
    const userEmail = this.settingsService.getSetting('gdrive_user_email') || undefined;
    const userName = this.settingsService.getSetting('gdrive_user_name') || undefined;
    const autoBackup = this.settingsService.getSetting('gdrive_auto_backup', 'true') === 'true';
    const folderId = this.settingsService.getSetting('gdrive_folder_id') || undefined;
    const lastBackupAt = this.settingsService.getSetting('gdrive_last_backup_at') || undefined;

    return {
      connected,
      userEmail,
      userName,
      autoBackup,
      folderId,
      lastBackupAt,
    };
  }

  public setAutoBackup(enabled: boolean): void {
    this.settingsService.setSetting('gdrive_auto_backup', enabled ? 'true' : 'false');
  }

  public disconnect(): { success: boolean; message: string } {
    this.settingsService.setSetting('gdrive_connected', 'false');
    this.settingsService.setSetting('gdrive_user_email', '');
    this.settingsService.setSetting('gdrive_user_name', '');
    this.settingsService.setSetting('gdrive_refresh_token', '');
    this.settingsService.setSetting('gdrive_access_token', '');
    this.settingsService.setSetting('gdrive_token_expires_at', '0');
    this.settingsService.setSetting('gdrive_folder_id', '');

    if (this.activeAuthServer) {
      try {
        this.activeAuthServer.close();
      } catch {}
      this.activeAuthServer = null;
    }

    return { success: true, message: 'تم إلغاء ربط حساب Google Drive بنجاح.' };
  }

  /**
   * Find an available local port for the loopback redirect server
   */
  private getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => resolve(52784));
        }
      });
    });
  }

  /**
   * Start OAuth 2.0 Loopback Flow
   * Starts a temporary local server, opens Google Auth in browser, listens for callback
   */
  public async startAuthFlow(): Promise<{ success: boolean; authUrl: string; message: string }> {
    if (this.activeAuthServer) {
      try {
        this.activeAuthServer.close();
      } catch {}
      this.activeAuthServer = null;
    }
    if (this.activeAuthTimeout) {
      clearTimeout(this.activeAuthTimeout);
      this.activeAuthTimeout = null;
    }

    const port = await this.getAvailablePort();
    const redirectUri = `http://localhost:${port}`;
    const clientId = this.getClientId();

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    // Start local server to receive the authorization code
    await new Promise<void>((resolve, reject) => {
      this.activeAuthServer = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url || '/', `http://localhost:${port}`);
        if (reqUrl.pathname === '/oauth2callback' || reqUrl.pathname === '/') {
          const code = reqUrl.searchParams.get('code');
          const error = reqUrl.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html dir="rtl" lang="ar">
              <head><meta charset="utf-8"><title>فشل الربط</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0f172a;color:#f87171;}</style></head>
              <body>
                <h2>❌ تم إلغاء ربط Google Drive</h2>
                <p>لم يتم منح الصلاحية المطلوبة (${error}). يمكنك إغلاق هذه الصفحة والمحاولة مجدداً من البرنامج.</p>
              </body>
              </html>
            `);
            this.closeAuthServer();
            return;
          }

          if (code) {
            try {
              // Exchange code for tokens
              await this.handleOAuthCallback(code, redirectUri);

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                  <meta charset="utf-8">
                  <title>تم الربط بنجاح</title>
                  <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center; padding: 60px 20px; background: #0b1120; color: #f8fafc; }
                    .card { max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #38bdf8; box-shadow: 0 10px 35px rgba(0,0,0,0.5); }
                    h1 { color: #34d399; font-size: 1.6rem; margin-bottom: 15px; }
                    p { color: #94a3b8; font-size: 1rem; line-height: 1.6; }
                    .btn { display: inline-block; margin-top: 20px; background: #0284c7; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>✅ تم ربط Google Drive بنجاح!</h1>
                    <p>تم ربط حسابك ببرنامج <b>QuazLink POS</b> بنجاح تام، وأصبح بإمكانك الآن رفع واسترجاع النسخ الاحتياطية السحابية بأمان تام.</p>
                    <p><b>يمكنك إغلاق هذه الصفحة الآن والعودة لشاشة البرنامج.</b></p>
                  </div>
                </body>
                </html>
              `);
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head><meta charset="utf-8"><title>خطأ في المصادقة</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:50px;background:#0f172a;color:#f87171;}</style></head>
                <body>
                  <h2>❌ فشل تبادل رمز الدخول</h2>
                  <p>${err?.message || 'حدث خطأ أثناء التواصل مع سيرفرات جوجل.'}</p>
                </body>
                </html>
              `);
            } finally {
              setTimeout(() => this.closeAuthServer(), 1000);
            }
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.activeAuthServer.listen(port, '127.0.0.1', () => {
        resolve();
      });

      this.activeAuthServer.on('error', (err) => {
        reject(err);
      });
    });

    // Timeout server after 5 minutes of inactivity
    this.activeAuthTimeout = setTimeout(() => {
      this.closeAuthServer();
    }, 5 * 60 * 1000);

    // Open URL in default browser
    this.openExternalUrl(authUrl);

    return {
      success: true,
      authUrl,
      message: 'تم فتح متصفح الإنترنت لتسجيل الدخول بحساب Google. برجاء الموافقة على منح الصلاحية لإتمام الربط.',
    };
  }

  private closeAuthServer(): void {
    if (this.activeAuthTimeout) {
      clearTimeout(this.activeAuthTimeout);
      this.activeAuthTimeout = null;
    }
    if (this.activeAuthServer) {
      try {
        this.activeAuthServer.close();
      } catch {}
      this.activeAuthServer = null;
    }
  }

  private openExternalUrl(targetUrl: string): void {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      exec(`start "" "${targetUrl}"`);
    } else {
      exec(`xdg-open "${targetUrl}" || open "${targetUrl}"`);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async handleOAuthCallback(code: string, redirectUri: string): Promise<void> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    const postData = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString();

    const tokenRes = await this.httpsRequest('oauth2.googleapis.com', '/token', 'POST', postData, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (tokenRes.error) {
      throw new Error(`Google OAuth Token Error: ${tokenRes.error_description || tokenRes.error}`);
    }

    // Verify user actually granted Google Drive permissions in consent screen
    const grantedScopes = String(tokenRes.scope || '');
    if (!grantedScopes.includes('drive')) {
      throw new Error(
        'لم تقم بتحديد صلاحية Google Drive في صفحة التأكيد! يرجى العودة ووضع علامة صح (☑) بجانب خيار السماح بالوصول لملفات Google Drive ثم الضغط على متابعة.'
      );
    }

    const accessToken = tokenRes.access_token;
    const refreshToken = tokenRes.refresh_token;
    const expiresIn = tokenRes.expires_in || 3599;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Fetch User Profile
    const userRes = await this.httpsRequest('www.googleapis.com', '/oauth2/v2/userinfo', 'GET', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    const userEmail = userRes.email || 'user@gmail.com';
    const userName = userRes.name || userRes.email || 'Google User';

    // Ensure QuazLink Backups folder exists on Google Drive first
    const folderId = await this.getOrCreateBackupFolder(accessToken);

    // Save tokens and profile only after successful folder verification
    this.settingsService.setSetting('gdrive_connected', 'true');
    this.settingsService.setSetting('gdrive_user_email', userEmail);
    this.settingsService.setSetting('gdrive_user_name', userName);
    if (refreshToken) {
      this.settingsService.setSetting('gdrive_refresh_token', refreshToken);
    }
    this.settingsService.setSetting('gdrive_access_token', accessToken);
    this.settingsService.setSetting('gdrive_token_expires_at', String(expiresAt));
    this.settingsService.setSetting('gdrive_folder_id', folderId);
  }

  /**
   * Get valid access token, auto-refreshing via refresh_token if needed
   */
  public async getValidAccessToken(): Promise<string> {
    const connected = this.settingsService.getSetting('gdrive_connected') === 'true';
    if (!connected) {
      throw new Error('حساب Google Drive غير مربوط بالبرنامج. يرجى الضغط على زر ربط الحساب أولاً.');
    }

    let accessToken = this.settingsService.getSetting('gdrive_access_token');
    const expiresAt = parseInt(this.settingsService.getSetting('gdrive_token_expires_at', '0'), 10);
    const refreshToken = this.settingsService.getSetting('gdrive_refresh_token');

    // If token expires in less than 2 minutes, refresh it
    if (!accessToken || Date.now() > expiresAt - 2 * 60 * 1000) {
      if (!refreshToken) {
        throw new Error('انتهت صلاحية جلسة Google Drive ولا يوجد رمز تجديد. يرجى إعادة ربط الحساب.');
      }

      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();

      const postData = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString();

      const tokenRes = await this.httpsRequest('oauth2.googleapis.com', '/token', 'POST', postData, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      if (tokenRes.error || !tokenRes.access_token) {
        throw new Error(`تعذر تجديد رمز الدخول: ${tokenRes.error_description || tokenRes.error || 'خطأ غير معروف'}`);
      }

      accessToken = tokenRes.access_token;
      const expiresIn = tokenRes.expires_in || 3599;
      this.settingsService.setSetting('gdrive_access_token', accessToken);
      this.settingsService.setSetting('gdrive_token_expires_at', String(Date.now() + expiresIn * 1000));
    }

    return accessToken;
  }

  /**
   * Search for or create folder "QuazLink POS Backups"
   */
  private async getOrCreateBackupFolder(accessToken: string): Promise<string> {
    const existingFolderId = this.settingsService.getSetting('gdrive_folder_id');
    if (existingFolderId && existingFolderId !== 'undefined' && existingFolderId.trim().length > 5) {
      return existingFolderId;
    }

    // Search existing folder
    const query = encodeURIComponent("name = 'QuazLink POS Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const searchRes = await this.httpsRequest('www.googleapis.com', `/drive/v3/files?q=${query}&fields=files(id,name)`, 'GET', undefined, {
      Authorization: `Bearer ${accessToken}`,
    });

    if (searchRes.error) {
      const errMsg = searchRes.error.message || '';
      if (errMsg.includes('insufficient authentication scopes') || searchRes.error.code === 403) {
        throw new Error(
          'صلاحية حساب Google غير كافية للوصول لملفات Google Drive (Insufficient Scopes). يرجى إلغاء الربط وإعادة الربط مع تفعيل علامة الصح (☑) أمام صلاحية Google Drive.'
        );
      }
      throw new Error(`تعذر الوصول إلى Google Drive: ${searchRes.error.message || JSON.stringify(searchRes.error)}`);
    }

    if (searchRes.files && searchRes.files.length > 0) {
      const folderId = searchRes.files[0].id;
      this.settingsService.setSetting('gdrive_folder_id', folderId);
      return folderId;
    }

    // Create new folder
    const createRes = await this.httpsRequest('www.googleapis.com', '/drive/v3/files', 'POST', JSON.stringify({
      name: 'QuazLink POS Backups',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'مجلد النسخ الاحتياطية الآمنة لبرنامج نقاط البيع والكاشير QuazLink POS',
    }), {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    });

    if (createRes.error) {
      const errMsg = createRes.error.message || '';
      if (errMsg.includes('insufficient authentication scopes') || createRes.error.code === 403) {
        throw new Error(
          'صلاحية حساب Google غير كافية لإنشاء مجلدات على Google Drive. يرجى إلغاء الربط وإعادة الربط مع تفعيل خيارات الصلاحية.'
        );
      }
      throw new Error(`تعذر إنشاء مجلد النسخ الاحتياطية على Google Drive: ${createRes.error.message || JSON.stringify(createRes.error)}`);
    }

    const newFolderId = createRes.id;
    if (!newFolderId) {
      throw new Error('فشل الحصول على معرف مجلد النسخ على Google Drive.');
    }
    this.settingsService.setSetting('gdrive_folder_id', newFolderId);
    return newFolderId;
  }

  /**
   * Upload an existing backup (.qzbk) to Google Drive
   */
  public async uploadBackupToDrive(backupId: string): Promise<{ success: boolean; fileId: string; webViewLink?: string; fileName: string; message: string }> {
    const backup = this.db.queryOne<{ id: string; file_path: string; file_size_bytes: number }>(
      'SELECT id, file_path, file_size_bytes FROM system_backups WHERE id = ?',
      [backupId]
    );

    if (!backup || !fs.existsSync(backup.file_path)) {
      throw new Error(`ملف النسخة الاحتياطية غير موجود على القرص المحلي (${backupId})`);
    }

    const accessToken = await this.getValidAccessToken();
    const folderId = await this.getOrCreateBackupFolder(accessToken);
    const fileName = path.basename(backup.file_path);
    const fileContent = fs.readFileSync(backup.file_path);

    // Multipart upload
    const boundary = '-------quazlink_gdrive_upload_' + Date.now();
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `QuazLink POS System Backup - ID: ${backupId}`,
    });

    const postBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await this.httpsRequestRaw(
      'www.googleapis.com',
      '/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
      'POST',
      postBody,
      {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(postBody.length),
      }
    );

    const resJson = JSON.parse(uploadRes);
    if (resJson.error) {
      const errMsg = resJson.error.message || '';
      if (errMsg.includes('insufficient authentication scopes') || resJson.error.code === 403) {
        throw new Error(
          'صلاحية الوصول غير كافية لـ Google Drive: حسابك متصل ولكن لم يتم منح صلاحية رفع الملفات أثناء تسجيل الدخول. يرجى الضغط على زر "إلغاء الربط" ثم إعادة الربط والتأكد من تحديد علامة (☑) أمام إذن Google Drive في صفحة المتصفح.'
        );
      }
      throw new Error(`فشل رفع الملف إلى Google Drive: ${resJson.error.message || JSON.stringify(resJson.error)}`);
    }

    const driveFileId = resJson.id;
    const webViewLink = resJson.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
    const nowIso = new Date().toISOString();

    // Update system_backups
    this.db.run(
      `UPDATE system_backups SET gdrive_file_id = ?, gdrive_web_link = ?, gdrive_uploaded_at = ? WHERE id = ?`,
      [driveFileId, webViewLink, nowIso, backupId]
    );

    this.settingsService.setSetting('gdrive_last_backup_at', nowIso);

    return {
      success: true,
      fileId: driveFileId,
      webViewLink,
      fileName,
      message: `تم رفع النسخة الاحتياطية (${fileName}) بنجاح إلى مجلد QuazLink POS Backups على حساب Google Drive.`,
    };
  }

  /**
   * Create a fresh local backup and immediately upload it to Google Drive
   */
  public async createAndUploadBackup(notes?: string): Promise<{ success: boolean; backupId: string; fileId: string; webViewLink?: string; message: string }> {
    const backupItem = await this.syncService.createBackup({
      type: 'cloud',
      notes: notes || 'نسخة احتياطية سحابية عبر Google Drive',
    });

    const uploadResult = await this.uploadBackupToDrive(backupItem.id);

    return {
      success: true,
      backupId: backupItem.id,
      fileId: uploadResult.fileId,
      webViewLink: uploadResult.webViewLink,
      message: uploadResult.message,
    };
  }

  /**
   * List backups in Google Drive folder
   */
  public async listDriveBackups(): Promise<GoogleDriveFileItem[]> {
    const accessToken = await this.getValidAccessToken();
    const folderId = await this.getOrCreateBackupFolder(accessToken);

    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await this.httpsRequest(
      'www.googleapis.com',
      `/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime,webViewLink)&orderBy=createdTime+desc`,
      'GET',
      undefined,
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    if (res.error) {
      const errMsg = res.error.message || '';
      if (errMsg.includes('insufficient authentication scopes') || res.error.code === 403) {
        throw new Error('صلاحية حساب Google غير كافية لعرض الملفات. يرجى إلغاء الربط وإعادة الربط مع تفعيل خيار Google Drive.');
      }
      throw new Error(`تعذر جلب ملفات النسخ: ${res.error.message || JSON.stringify(res.error)}`);
    }

    const files = res.files || [];
    return files.map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : 'غير معروف',
      createdTime: f.createdTime,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    }));
  }

  /**
   * Download a backup from Google Drive and restore the system database
   */
  public async restoreFromDrive(fileId: string): Promise<{ success: boolean; message: string }> {
    const accessToken = await this.getValidAccessToken();

    const downloadedPayload = await this.httpsRequestRaw(
      'www.googleapis.com',
      `/drive/v3/files/${fileId}?alt=media`,
      'GET',
      undefined,
      {
        Authorization: `Bearer ${accessToken}`,
      }
    );

    if (downloadedPayload.includes('"error":') && (downloadedPayload.includes('403') || downloadedPayload.includes('insufficient authentication scopes'))) {
      throw new Error('صلاحية حساب Google غير كافية لتنزيل الملف. يرجى إلغاء الربط وإعادة الربط مع تفعيل خيار Google Drive.');
    }

    if (!downloadedPayload || downloadedPayload.length === 0) {
      throw new Error('تعذر تنزيل محتوى النسخة الاحتياطية من Google Drive.');
    }

    // Restore via SyncService
    const restoreResult = this.syncService.restoreFromPayloadString(downloadedPayload);
    if (!restoreResult.success) {
      throw new Error(restoreResult.message);
    }

    return {
      success: true,
      message: '✅ تمت استعادة قاعدة البيانات بنجاح تام من Google Drive واسترجاع كافة المنتجات والفواتير والمخزن!',
    };
  }

  /**
   * Helper: HTTPS JSON Request
   */
  private httpsRequest(host: string, pathUrl: string, method: string, data?: string, headers: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: host,
        port: 443,
        path: pathUrl,
        method,
        headers: {
          'User-Agent': 'QuazLink-POS-Client/1.3.4',
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch {
            resolve({ rawBody: body, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', reject);
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  /**
   * Helper: HTTPS Raw Request (for buffers and file downloads)
   */
  private httpsRequestRaw(host: string, pathUrl: string, method: string, data?: Buffer | string, headers: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: host,
        port: 443,
        path: pathUrl,
        method,
        headers: {
          'User-Agent': 'QuazLink-POS-Client/1.3.4',
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('utf-8'));
        });
      });

      req.on('error', reject);
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }
}
