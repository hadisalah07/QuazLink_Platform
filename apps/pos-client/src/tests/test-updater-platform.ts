import * as http from 'node:http';
import { PosUpdaterService } from '../services/updater-service.js';

async function runUpdaterTest() {
  console.log('🔄 Testing PosUpdaterService Platform Integration...');

  // 1. Start a mock QuazLink Platform server on port 3005
  const mockPlatform = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/pos/updates')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          hasUpdate: true,
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          minRequiredVersion: '1.0.0',
          releaseName: 'QuazLink POS & ERP v1.1.0 (إصدار الاستقرار والأداء)',
          releaseNotes: '• حل مشكلة إتمام المعاملات وحفظ الفواتير\n• إضافة نظام فحص وتطبيق التحديثات التلقائية المباشرة',
          downloadUrl: '/downloads/QuazLink-POS-Setup.exe',
          portableUrl: '/downloads/QuazLink-POS-Portable.zip',
          assetSize: 74114571,
          publishedAt: new Date().toISOString(),
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => mockPlatform.listen(3005, () => resolve()));
  console.log('✅ Mock QuazLink Platform listening on port 3005');

  try {
    // 2. Test Client on 1.0.0 detecting 1.1.0 update from Platform
    const clientUpdater = new PosUpdaterService('1.0.0', 'http://127.0.0.1:3005');
    const updateResult = await clientUpdater.checkForUpdates();

    console.log('Update Check Result:', {
      hasUpdate: updateResult.hasUpdate,
      currentVersion: updateResult.currentVersion,
      latestVersion: updateResult.latestVersion,
      releaseName: updateResult.releaseName,
      downloadUrl: updateResult.downloadUrl,
      source: updateResult.source,
    });

    if (!updateResult.hasUpdate) throw new Error('hasUpdate should be true for 1.0.0 -> 1.1.0');
    if (updateResult.latestVersion !== '1.1.0') throw new Error('latestVersion should be 1.1.0');
    if (updateResult.source !== 'platform') throw new Error('source should be platform');
    if (!updateResult.downloadUrl.includes('http://127.0.0.1:3005/downloads/QuazLink-POS-Setup.exe')) {
      throw new Error(`downloadUrl should be fully qualified: ${updateResult.downloadUrl}`);
    }

    console.log('✅ Client on v1.0.0 successfully detected v1.1.0 update from Platform with full URL!');

    // 3. Test Client already on 1.1.0
    const updatedClient = new PosUpdaterService('1.1.0', 'http://127.0.0.1:3005');
    const noUpdateResult = await updatedClient.checkForUpdates();
    console.log('Updated Client Check:', {
      hasUpdate: noUpdateResult.hasUpdate,
      currentVersion: noUpdateResult.currentVersion,
      latestVersion: noUpdateResult.latestVersion,
    });

    if (noUpdateResult.hasUpdate) throw new Error('hasUpdate should be false for 1.1.0 -> 1.1.0');
    console.log('✅ Client on v1.1.0 accurately detects system is up to date!');

  } finally {
    mockPlatform.close();
  }

  console.log('\n🎉 ALL UPDATER PLATFORM INTEGRATION TESTS PASSED 100%!');
}

runUpdaterTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
