/**
 * QuazLink Retail POS & ERP - Phase 2 Hardware & Thermal Printer Rasterization Tests
 */

import { PrinterService } from '../printer/printer-service.js';
import { ReceiptData } from '../printer/types.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runPrinterTests() {
  console.log('====================================================');
  console.log('🖨️  Running QuazLink Thermal Printer Engine Tests...');
  console.log('====================================================\n');

  const sampleReceipt: ReceiptData = {
    storeName: 'AL-ASHOR COMPUTER & ELECTRONICS',
    storePhone: '01009876543',
    storeAddress: '14 Al-Horreya St, Mansoura, Egypt',
    taxNumber: '450-891-203',
    invoiceNumber: 'INV-B01-POS01-20261005-0042',
    dateStr: '2026-10-05 23:45',
    cashierName: 'Ahmed Salah',
    currency: 'EGP',
    items: [
      {
        name: 'HP Omen 16 Gaming Laptop',
        quantity: 1,
        unitPrice: 42000,
        totalPrice: 42000,
        serialNumber: '5CD2341ABC', // Serial / IMEI printed clearly
      },
      {
        name: 'Logitech G502 Hero Mouse',
        quantity: 2,
        unitPrice: 1200,
        totalPrice: 2400,
      },
      {
        name: 'Kingston 1TB NVMe Gen4',
        quantity: 1,
        unitPrice: 3200,
        totalPrice: 3200,
        serialNumber: 'KNG-NVME-8831',
      },
    ],
    subtotal: 47600,
    discountAmount: 600,
    taxVat14: 6580,
    finalAmount: 53580,
    paidAmount: 54000,
    remainingAmount: 0,
    footerText: 'Goods returnable within 14 days with original serial & invoice.',
  };

  // --- Test 1: 80mm Printer (576px Standard Width) ---
  console.log('--- TEST 1: 80mm High-Speed Rasterization (576px) ---');
  const printer80 = new PrinterService({ width: '80mm', openCashDrawer: true, cutPaper: true });
  const result80 = await printer80.printReceipt(sampleReceipt);

  console.log(`Raster Dimension: ${result80.width}x${result80.height} dots`);
  console.log(`Command Buffer Size: ${result80.escposCommands.length} bytes`);
  console.log(`Rendering Speed: ${result80.durationMs} ms`);

  assert(result80.width === 576, '80mm width is strictly 576 dots');
  assert(result80.height > 200, 'Receipt height rendered dynamically based on items');
  assert(result80.durationMs < 100, `Execution speed under 100ms benchmark (Actual: ${result80.durationMs}ms)`);

  // Verify ESC/POS Commands
  const cmds = result80.escposCommands;
  // 1. Drawer Kick (1B 70 00 19 FA)
  assert(cmds[0] === 0x1b && cmds[1] === 0x70 && cmds[2] === 0x00, 'Cash drawer kick pulse present (ESC p)');
  // 2. Initialize (1B 40)
  assert(cmds[5] === 0x1b && cmds[6] === 0x40, 'Printer initialize command present (ESC @)');
  // 3. Raster Bit Image (1D 76 30 00)
  assert(cmds[7] === 0x1d && cmds[8] === 0x76 && cmds[9] === 0x30, 'ESC/POS Raster Bit Image present (GS v 0)');

  // --- Test 2: 58mm Printer (384px Compact Width) ---
  console.log('\n--- TEST 2: 58mm Compact Rasterization (384px) ---');
  const printer58 = new PrinterService({ width: '58mm', openCashDrawer: false, cutPaper: true });
  const result58 = await printer58.printReceipt(sampleReceipt);

  console.log(`Raster Dimension: ${result58.width}x${result58.height} dots`);
  console.log(`Command Buffer Size: ${result58.escposCommands.length} bytes`);
  console.log(`Rendering Speed: ${result58.durationMs} ms`);

  assert(result58.width === 384, '58mm width is strictly 384 dots');
  assert(result58.durationMs < 100, `58mm execution speed under 100ms (Actual: ${result58.durationMs}ms)`);

  // Verify BMP Image Generation
  assert(result80.rasterBytes.slice(0, 2).toString() === 'BM', 'BMP image file header valid');

  console.log('\n====================================================');
  console.log('🎉 ALL THERMAL PRINTER RASTER TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runPrinterTests().catch((err) => {
  console.error('Fatal printer test error:', err);
  process.exit(1);
});
