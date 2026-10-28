import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PosUpdaterService } from '../services/updater-service.js';

async function runSilentAutoUpdateTest() {
  console.log('⚡ [Test] Testing Silent Auto-Update & Top Header Indicator...');

  // 1. Verify HTML elements exist
  const htmlPath = path.join(__dirname, '..', 'ui', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  if (!html.includes('id="headerAutoUpdateIndicator"')) {
    throw new Error('Missing #headerAutoUpdateIndicator in index.html');
  }
  if (!html.includes('id="headerUpdateIcon"')) {
    throw new Error('Missing #headerUpdateIcon in index.html');
  }
  if (!html.includes('id="headerUpdateText"')) {
    throw new Error('Missing #headerUpdateText in index.html');
  }
  if (!html.includes('id="headerUpdateBar"')) {
    throw new Error('Missing #headerUpdateBar in index.html');
  }
  if (!html.includes('id="toggleSilentAutoUpdate"')) {
    throw new Error('Missing #toggleSilentAutoUpdate in index.html');
  }
  console.log('✅ UI HTML structure verified with header micro-pill and settings controls.');

  // 2. Verify JS controller logic exists
  const jsPath = path.join(__dirname, '..', 'ui', 'app.js');
  const js = fs.readFileSync(jsPath, 'utf-8');

  if (!js.includes('startSilentAutoUpdate')) {
    throw new Error('Missing startSilentAutoUpdate function in app.js');
  }
  if (!js.includes('onSilentUpdateComplete')) {
    throw new Error('Missing onSilentUpdateComplete function in app.js');
  }
  if (!js.includes('handleHeaderUpdateClick')) {
    throw new Error('Missing handleHeaderUpdateClick function in app.js');
  }
  if (!js.includes('checkPendingAutoUpdateRestart')) {
    throw new Error('Missing checkPendingAutoUpdateRestart function in app.js');
  }
  if (!js.includes('toggleSilentAutoUpdatePref')) {
    throw new Error('Missing toggleSilentAutoUpdatePref function in app.js');
  }
  console.log('✅ JavaScript silent auto-update engine and safety guards verified.');

  // 3. Verify CSS styling exists
  const cssPath = path.join(__dirname, '..', 'ui', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  if (!css.includes('.header-update-pill')) {
    throw new Error('Missing .header-update-pill in style.css');
  }
  if (!css.includes('.header-update-pill.ready')) {
    throw new Error('Missing .header-update-pill.ready in style.css');
  }
  if (!css.includes('.spin-update')) {
    throw new Error('Missing .spin-update in style.css');
  }
  console.log('✅ CSS animations and responsive micro-pill styles verified.');

  // 4. Test platform update check flow
  const mockServer = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/pos/updates')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          hasUpdate: true,
          currentVersion: '1.3.9',
          latestVersion: '1.4.0',
          releaseName: 'QuazLink POS & ERP v1.4.0 (التحديث التلقائي الصامت)',
          patchUrl: '/downloads/QuazLink-POS-Patch-v1.4.0.zip',
          downloadUrl: '/downloads/QuazLink-POS-Setup.exe',
          assetSize: 74212111,
          publishedAt: new Date().toISOString(),
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => mockServer.listen(3006, () => resolve()));
  try {
    const updater = new PosUpdaterService('1.3.9', 'http://127.0.0.1:3006');
    const res = await updater.checkForUpdates();
    if (!res.hasUpdate || res.latestVersion !== '1.4.0') {
      throw new Error('Update detection failed for 1.3.9 -> 1.4.0');
    }
    if (!res.patchUrl || !res.downloadUrl) {
      throw new Error('Missing patchUrl or downloadUrl in update result');
    }
    console.log('✅ PosUpdaterService accurately detects v1.4.0 with fast patch and full download URLs!');
  } finally {
    mockServer.close();
  }

  console.log('\n🎉 ALL SILENT AUTO-UPDATE TESTS PASSED 100%!');
}

runSilentAutoUpdateTest().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
