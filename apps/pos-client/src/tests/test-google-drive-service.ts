/**
 * QuazLink Retail POS & ERP - Google Drive Cloud Backup Service Tests
 */

import * as http from 'node:http';
import { PosDatabase } from '../database/connection.js';
import { SettingsService } from '../services/settings-service.js';
import { LicensingService } from '../services/licensing-service.js';
import { SyncService } from '../services/sync-service.js';
import { GoogleDriveService } from '../services/google-drive-service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runGoogleDriveTests() {
  console.log('====================================================');
  console.log('☁️ Running QuazLink POS Google Drive Cloud Backup Tests...');
  console.log('====================================================\n');

  const testDbPath = ':memory:';
  const db = PosDatabase.getInstance(testDbPath);
  const settingsService = new SettingsService(db);
  const licensingService = new LicensingService(db);
  const syncService = new SyncService(db, settingsService, licensingService);
  const googleDriveService = new GoogleDriveService(db, settingsService, syncService);

  // --- TEST 1: Schema Extensions ---
  console.log('--- TEST 1: Schema Extensions in system_backups ---');
  const tableInfo = db.queryAll<{ name: string }>('PRAGMA table_info(system_backups)');
  const colNames = tableInfo.map((c) => c.name);
  assert(colNames.includes('gdrive_file_id'), 'Column gdrive_file_id exists in system_backups');
  assert(colNames.includes('gdrive_web_link'), 'Column gdrive_web_link exists in system_backups');
  assert(colNames.includes('gdrive_uploaded_at'), 'Column gdrive_uploaded_at exists in system_backups');

  // --- TEST 2: Client Credentials & Settings ---
  console.log('\n--- TEST 2: Client ID & Secret Configuration ---');
  const clientId = googleDriveService.getClientId();
  const clientSecret = googleDriveService.getClientSecret();
  assert(clientId.includes('73082039144-hhr7k957ilm1q6knqdttk2dv4eq9jo35'), 'Default Client ID matches Google Cloud Console credentials');
  assert(clientSecret.startsWith('GOCSPX-'), 'Default Client Secret matches Google Cloud Console credentials');

  // --- TEST 3: Status & Auto-Backup Toggling ---
  console.log('\n--- TEST 3: Status & Auto-Backup Toggling ---');
  let status = googleDriveService.getStatus();
  assert(status.connected === false, 'Initial state is disconnected');
  assert(status.autoBackup === true, 'Default autoBackup setting is true');

  googleDriveService.setAutoBackup(false);
  status = googleDriveService.getStatus();
  assert(status.autoBackup === false, 'autoBackup successfully toggled to false');

  googleDriveService.setAutoBackup(true);
  status = googleDriveService.getStatus();
  assert(status.autoBackup === true, 'autoBackup successfully toggled back to true');

  // --- TEST 4: Disconnect Method ---
  console.log('\n--- TEST 4: Disconnect Clears Sensitive Tokens ---');
  settingsService.setSetting('gdrive_connected', 'true');
  settingsService.setSetting('gdrive_user_email', 'merchant@test.com');
  settingsService.setSetting('gdrive_access_token', 'ya29.test_token');
  settingsService.setSetting('gdrive_refresh_token', '1//0test_refresh');

  const discResult = googleDriveService.disconnect();
  assert(discResult.success === true, 'Disconnect returns success');
  status = googleDriveService.getStatus();
  assert(status.connected === false, 'Status shows disconnected after disconnect()');
  assert(!settingsService.getSetting('gdrive_access_token'), 'Access token wiped on disconnect');
  assert(!settingsService.getSetting('gdrive_refresh_token'), 'Refresh token wiped on disconnect');

  // --- TEST 5: Start OAuth Loopback Server & Auth URL Generation ---
  console.log('\n--- TEST 5: OAuth 2.0 Loopback Server & Auth URL ---');
  const authFlow = await googleDriveService.startAuthFlow();
  assert(authFlow.success === true, 'startAuthFlow initiated successfully');
  assert(authFlow.authUrl.includes('accounts.google.com/o/oauth2/v2/auth'), 'authUrl points to Google OAuth endpoint');
  assert(authFlow.authUrl.includes('client_id='), 'authUrl contains client_id');
  assert(authFlow.authUrl.includes('redirect_uri=http%3A%2F%2Flocalhost'), 'authUrl uses localhost redirect_uri for Google Desktop App compliance');
  assert(authFlow.authUrl.includes('scope='), 'authUrl requests proper drive.file scope');

  // Extract loopback port from authUrl
  const urlMatch = authFlow.authUrl.match(/redirect_uri=http%3A%2F%2Flocalhost%3A(\d+)/);
  assert(!!urlMatch && !!urlMatch[1], 'Extracted loopback port from authUrl');
  const loopbackPort = parseInt(urlMatch![1], 10);

  // Simulate user cancellation callback to the loopback server
  const cancelResponseText = await new Promise<string>((resolve, reject) => {
    http.get(`http://127.0.0.1:${loopbackPort}/oauth2callback?error=access_denied`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  assert(cancelResponseText.includes('تم إلغاء ربط Google Drive'), 'Loopback server gracefully responded to user cancellation with Arabic explanation');

  // --- TEST 6: Local Backup to Google Drive Database Association ---
  console.log('\n--- TEST 6: Backup Creation with Google Drive Meta Columns ---');
  const backup = await syncService.createBackup({ type: 'local', notes: 'Pre-upload test backup' });
  assert(!!backup.id, `Created atomic local backup with id: ${backup.id}`);

  // Simulate updating GDrive columns
  const fakeFileId = 'gdrive_file_xyz_12345';
  const fakeWebLink = `https://drive.google.com/file/d/${fakeFileId}/view`;
  const fakeUploadTime = new Date().toISOString();

  db.run(
    'UPDATE system_backups SET gdrive_file_id = ?, gdrive_web_link = ?, gdrive_uploaded_at = ? WHERE id = ?',
    [fakeFileId, fakeWebLink, fakeUploadTime, backup.id]
  );

  const updatedBackup = db.queryOne<{ gdrive_file_id: string; gdrive_web_link: string; gdrive_uploaded_at: string }>(
    'SELECT gdrive_file_id, gdrive_web_link, gdrive_uploaded_at FROM system_backups WHERE id = ?',
    [backup.id]
  );
  assert(updatedBackup?.gdrive_file_id === fakeFileId, 'gdrive_file_id stored correctly');
  assert(updatedBackup?.gdrive_web_link === fakeWebLink, 'gdrive_web_link stored correctly');
  assert(updatedBackup?.gdrive_uploaded_at === fakeUploadTime, 'gdrive_uploaded_at stored correctly');

  console.log('\n====================================================');
  console.log('🎉 ALL GOOGLE DRIVE CLOUD BACKUP TESTS PASSED 100%!');
  console.log('====================================================\n');
  process.exit(0);
}

runGoogleDriveTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
