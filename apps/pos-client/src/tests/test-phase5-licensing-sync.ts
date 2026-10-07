/**
 * QuazLink Retail POS & ERP - Phase 5 Licensing, Cloud Sync, Backups & ETA E-Receipt Tests
 */

import * as fs from 'node:fs';
import { PosDatabase } from '../database/connection.js';
import { LicensingService } from '../services/licensing-service.js';
import { SettingsService } from '../services/settings-service.js';
import { SyncService } from '../services/sync-service.js';
import { EtaService } from '../services/eta-service.js';
import { InvoiceService } from '../services/invoice-service.js';
import { ProductService } from '../services/product-service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('🔐 Running QuazLink POS Phase 5 Security & Cloud Tests...');
  console.log('====================================================\n');

  // استخدام قاعدة بيانات اختبار مؤقتة ونظيفة
  const testDbPath = ':memory:';
  const db = PosDatabase.getInstance(testDbPath);
  const settingsService = new SettingsService(db);
  const licensingService = new LicensingService(db);
  const syncService = new SyncService(db, settingsService, licensingService);
  const etaService = new EtaService(db);
  const productService = new ProductService(db);
  const invoiceService = new InvoiceService(db);

  // --- TEST 1: Hardware ID & Fingerprinting ---
  console.log('--- TEST 1: Hardware ID & Machine Fingerprinting ---');
  const hwId1 = licensingService.getHardwareId();
  const hwId2 = licensingService.getHardwareId();

  console.log(`Computed Hardware ID: ${hwId1}`);
  assert(hwId1 === hwId2, 'Hardware ID is deterministic and cached');
  assert(/^QL-HW-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(hwId1), 'Hardware ID matches standard format QL-HW-XXXX-XXXX-XXXX-XXXX');

  // --- TEST 2: Dual Licensing System (Lifetime vs SaaS) ---
  console.log('\n--- TEST 2: Dual Cryptographic Licensing System ---');
  // 1. Trial Key
  const trialKey = licensingService.generateTrialKey(hwId1);
  const trialCheck = licensingService.verifyLicense(trialKey);
  assert(trialCheck.valid === true, 'Trial license key verified successfully');
  assert(trialCheck.payload.tier === 'trial', 'Trial payload tier is trial');

  // 2. Lifetime Offline Key
  const lifetimeKey = licensingService.generateLicenseKey('lifetime', hwId1, ['core_pos', 'shifts_zreport', 'serial_warranty', 'cloud_sync']);
  const lifetimeCheck = licensingService.verifyLicense(lifetimeKey);
  assert(lifetimeCheck.valid === true, 'Lifetime offline key verified successfully');
  assert(lifetimeCheck.payload.tier === 'lifetime', 'Lifetime payload tier is lifetime');
  assert(lifetimeCheck.payload.exp === null, 'Lifetime license has no expiration date');

  // 3. SaaS Subscription Key
  const saasKey = licensingService.generateLicenseKey('saas_subscription', hwId1, undefined, 30);
  const saasCheck = licensingService.verifyLicense(saasKey);
  assert(saasCheck.valid === true, 'SaaS subscription key verified successfully');
  assert(saasCheck.payload.tier === 'saas_subscription', 'SaaS payload tier is saas_subscription');
  assert(typeof saasCheck.payload.exp === 'string', 'SaaS subscription has expiration date');

  // 4. Hardware Mismatch Detection (Anti-Piracy)
  const fakeHwKey = licensingService.generateLicenseKey('lifetime', 'QL-HW-9999-8888-7777-6666');
  const fakeCheck = licensingService.verifyLicense(fakeHwKey);
  assert(fakeCheck.valid === false, 'License for different hardware ID correctly rejected');
  assert(fakeCheck.error?.includes('لجهاز آخر') === true, 'Error message clarifies hardware mismatch');

  // 5. Tamper Detection (Altered signature)
  const tamperedKey = lifetimeKey.slice(0, -3) + 'XYZ';
  const tamperCheck = licensingService.verifyLicense(tamperedKey);
  assert(tamperCheck.valid === false, 'Tampered license signature strictly rejected');

  // 6. License Activation
  const activationRes = licensingService.activateLicense(lifetimeKey);
  assert(activationRes.success === true, 'Lifetime license activated in business profile');
  const currentLicense = licensingService.getLicenseInfo();
  assert(currentLicense.tier === 'lifetime', 'Active license info reflects lifetime tier');
  assert(currentLicense.status === 'active', 'Active license status is active');

  // --- TEST 3: Credit Wallet (Margin Protection & Add-ons) ---
  console.log('\n--- TEST 3: Cloud Credit Wallet & Voucher Engine ---');
  const initialWallet = licensingService.getCreditWallet();
  console.log(`Initial Credits: AI=${initialWallet.aiTokens}, WA=${initialWallet.whatsappMessages}`);
  assert(initialWallet.aiTokens > 0, 'Default initial AI credits exist');
  assert(initialWallet.whatsappMessages > 0, 'Default initial WhatsApp credits exist');

  // 1. Credit Deduction
  const deductRes = licensingService.deductCredits('ai_tokens', 5);
  assert(deductRes.success === true, 'Successfully deducted 5 AI credits');
  assert(deductRes.remaining === initialWallet.aiTokens - 5, 'Remaining AI tokens accurately updated');

  // 2. Insufficient Credit Guard
  const overDeduct = licensingService.deductCredits('ai_tokens', 99999);
  assert(overDeduct.success === false, 'Deducting beyond available credits prevented');

  // 3. Voucher Generation & Redemption
  const voucherCode = licensingService.generateCreditVoucher('ai_tokens', 50);
  console.log(`Generated AI Credit Voucher: ${voucherCode}`);
  assert(voucherCode.startsWith('QLV-AI-50-'), 'Voucher code format matches QLV-AI-50-XXXX');

  const redeemRes = licensingService.redeemCreditVoucher(voucherCode);
  assert(redeemRes.success === true, 'Valid voucher redeemed successfully');
  assert(redeemRes.balance === initialWallet.aiTokens - 5 + 50, 'Balance updated accurately with voucher top-up');

  // 4. Invalid Voucher Detection
  const fakeVoucher = 'QLV-AI-50-BADCODE';
  const badRedeem = licensingService.redeemCreditVoucher(fakeVoucher);
  assert(badRedeem.success === false, 'Forged voucher rejected');

  // --- TEST 4: System Backups & Disaster Recovery ---
  console.log('\n--- TEST 4: Database Backup & Recovery Engine ---');
  // Seed sample product and invoice
  const prod = productService.createProduct({
    name: 'MacBook Pro M3 Max',
    buyPrice: 95000,
    sellPriceRetail: 120000,
    hasSerial: false,
    stockQuantity: 5,
  });

  const inv = invoiceService.createSaleInvoice({
    items: [{ productId: prod.id, quantity: 1, unitPrice: 120000 }],
    paidAmount: 120000,
  });

  // 1. Create Local Backup
  const backup = await syncService.createBackup({ type: 'local', notes: 'Phase 5 Test Backup' });
  console.log(`Created Backup File: ${backup.filePath} (Size: ${backup.fileSizeBytes} bytes)`);
  assert(fs.existsSync(backup.filePath), 'Backup file exists on disk');
  assert(backup.fileSizeBytes > 500, 'Backup file has valid size');
  assert(backup.checksumSha256.length === 64, 'SHA-256 checksum generated');

  // 2. List Backups
  const backupsList = syncService.listBackups();
  assert(backupsList.length >= 1, 'Backup listed in system_backups table');
  assert(backupsList[0].id === backup.id, 'Latest backup matches created ID');

  // 3. Test Database Restoration
  const payloadStr = syncService.getBackupPayload(backup.id);
  assert(payloadStr !== null, 'Backup payload retrieved from file');

  const restoreRes = syncService.restoreFromPayloadString(payloadStr!);
  if (!restoreRes.success) {
    console.error('❌ Restore failed detail:', restoreRes.message);
  }
  assert(restoreRes.success === true, 'Database restored successfully from backup JSON payload: ' + restoreRes.message);

  const restoredProd = productService.getProductById(prod.id);
  assert(restoredProd !== null && restoredProd.name === 'MacBook Pro M3 Max', 'Restored product intact in database');

  // --- TEST 5: Smart Cloud Sync Engine & Resilient Queue ---
  console.log('\n--- TEST 5: Cloud Sync Engine & Offline Resilient Queue ---');
  const pendingBefore = syncService.getPendingCounts();
  console.log(`Pending Unsynced Transactions: ${pendingBefore.invoices} invoices`);
  assert(pendingBefore.invoices >= 1, 'Pending unsynced invoice detected');

  // Trigger sync in mock/resilience mode
  const syncResult = await syncService.triggerSync({ force: true });
  console.log(`Sync Result: ${syncResult.message}`);
  assert(syncResult.success === true, 'Sync completed successfully');
  assert(syncResult.pushedInvoices >= 1, 'Pushed at least 1 pending invoice');

  const pendingAfter = syncService.getPendingCounts();
  assert(pendingAfter.invoices === 0, 'All invoices marked synced_to_cloud = 1');

  const syncStatus = await syncService.getSyncStatus();
  assert(syncStatus.recentLogs.length >= 1, 'Sync audit log entry recorded');

  // --- TEST 6: Egyptian Tax Authority (ETA) E-Receipt TLV QR Compliance ---
  console.log('\n--- TEST 6: ETA Egyptian Tax Authority E-Receipt Compliance ---');
  // Configure Business Tax Number
  db.run(
    `UPDATE business_profile
     SET business_name = 'شركة الوكيل لتجارة الكمبيوتر والتكنولوجيا',
         tax_number = '450-891-203',
         updated_at = datetime('now')
     WHERE id = (SELECT id FROM business_profile LIMIT 1)`
  );

  const tlvData = {
    sellerName: 'شركة الوكيل لتجارة الكمبيوتر والتكنولوجيا',
    taxNumber: '450-891-203',
    timestamp: '2026-10-07T12:30:00Z',
    totalWithVat: 136800.0,
    vatAmount: 16800.0,
  };

  // 1. Generate TLV Base64
  const tlvBase64 = etaService.generateTlvBase64(tlvData);
  console.log(`Generated TLV Base64: ${tlvBase64.slice(0, 40)}...`);
  assert(tlvBase64.length > 50, 'TLV Base64 string generated');

  // 2. Decode & Verify TLV Structure
  const decoded = etaService.decodeTlvBase64(tlvBase64);
  assert(decoded.sellerName === tlvData.sellerName, 'Tag 1 (Seller Name) matches exactly');
  assert(decoded.taxNumber === tlvData.taxNumber, 'Tag 2 (Tax Reg Number) matches exactly');
  assert(decoded.timestamp === tlvData.timestamp, 'Tag 3 (Timestamp) matches exactly');
  assert(decoded.totalWithVat === tlvData.totalWithVat, 'Tag 4 (Total with VAT) matches exactly');
  assert(decoded.vatAmount === tlvData.vatAmount, 'Tag 5 (VAT Amount) matches exactly');

  // 3. ETA UUID Generation
  const etaUuid = etaService.generateEtaUuid(inv.invoiceNumber, '450-891-203', tlvData.timestamp);
  console.log(`Generated ETA UUID: ${etaUuid}`);
  assert(etaUuid.startsWith('ETA-'), 'ETA UUID prefix valid');

  // 4. Verify & Sign Invoice
  const etaVerification = etaService.verifyAndSignInvoice(inv.id);
  assert(etaVerification.isValid === true, 'Invoice successfully verified for ETA compliance');
  assert(etaVerification.errors.length === 0, 'No compliance errors found');

  const updatedInv = invoiceService.getInvoiceById(inv.id);
  assert(updatedInv?.etaStatus === 'valid', 'Invoice eta_status updated to valid');
  assert(updatedInv?.etaUuid === etaVerification.etaUuid, 'Invoice eta_uuid stored in database');

  // 5. QR Code Boolean Matrix (29x29)
  const qrMatrix = etaService.generateQrMatrix(tlvBase64);
  assert(qrMatrix.length === 29 && qrMatrix[0].length === 29, 'QR Matrix size is standard 29x29 grid');
  // Top-Left Finder Pattern (7x7) corner check
  assert(qrMatrix[0][0] === true && qrMatrix[0][6] === true && qrMatrix[6][0] === true, 'Top-Left Finder pattern present');
  // Center module of Top-Left Finder Pattern
  assert(qrMatrix[3][3] === true, 'Center module of Finder pattern is black');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 5 LICENSING, SYNC & ETA TESTS PASSED 100%!');
  console.log('====================================================\n');

  // Cleanup test backup files
  try {
    if (fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }
  } catch (e) {}

  syncService.stopAutoSync();
}

runPhase5Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal Phase 5 test error:', err);
    process.exit(1);
  });
