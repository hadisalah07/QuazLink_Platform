/**
 * QuazLink Retail POS & ERP - Phase 1 Core Database & Logic Verification Test
 */

import { PosDatabase } from '../database/connection.js';
import { ProductService } from '../services/product-service.js';
import { ContactService } from '../services/contact-service.js';
import { InvoiceService } from '../services/invoice-service.js';
import { InvoiceNumberService } from '../services/invoice-number.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 Running QuazLink POS Client Phase 1 Test Suite...');
  console.log('====================================================\n');

  // 1. إنشاء قاعدة بيانات SQLite في الذاكرة للاختبار
  const db = PosDatabase.createInMemory();
  const productService = new ProductService(db);
  const contactService = new ContactService(db);
  const invoiceService = new InvoiceService(db);
  const numberService = new InvoiceNumberService(db);

  // --- Test 1: Composite Invoice Numbering ---
  console.log('--- TEST 1: Composite Invoice Numbering ---');
  const invNum1 = numberService.generateNextInvoiceNumber({ branchCode: 'B01', posTerminalId: 'POS01' });
  const invNum2 = numberService.generateNextInvoiceNumber({ branchCode: 'B01', posTerminalId: 'POS01' });
  console.log(`Generated: ${invNum1}`);
  console.log(`Generated: ${invNum2}`);

  assert(invNum1.startsWith('INV-B01-POS01-') && invNum1.endsWith('-0001'), 'First invoice sequence ends with 0001');
  assert(invNum2.startsWith('INV-B01-POS01-') && invNum2.endsWith('-0002'), 'Second invoice sequence ends with 0002');

  // --- Test 2: Product & Serial Lifecycle Management ---
  console.log('\n--- TEST 2: Products & Serial / IMEI Management ---');

  // صنف عادي (كابل شاحن)
  const cable = productService.createProduct({
    name: 'كابل شاحن Type-C سريع',
    barcode: '62210001',
    sku: 'CAB-001',
    buyPrice: 35,
    sellPriceRetail: 70,
    stockQuantity: 50,
    hasSerial: false,
  });
  assert(cable.stockQuantity === 50, 'Standard product stock created with 50 items');

  // صنف إلكتروني بسيريال (لابتوب Dell G15)
  const laptop = productService.createProduct({
    name: 'Dell G15 Gaming Laptop',
    barcode: '88411639',
    sku: 'DELL-G15',
    buyPrice: 30000,
    sellPriceRetail: 38000,
    hasSerial: true,
  });
  assert(laptop.hasSerial === true, 'Electronics product created with hasSerial=true');

  // إضافة سيريالات اللابتوب
  const serials = productService.addSerialNumbers(laptop.id, ['DELL-SN-001', 'DELL-SN-002', 'DELL-SN-003'], 24);
  assert(serials.length === 3, 'Successfully registered 3 serial numbers with 24 months warranty');

  const updatedLaptop = productService.getProductById(laptop.id)!;
  assert(updatedLaptop.stockQuantity === 3, 'Laptop stock automatically incremented to 3 based on serial count');

  // --- Test 3: Customer Management & Debt Ledger ---
  console.log('\n--- TEST 3: Customers & Debt Tracking ---');
  const customer = contactService.createContact({
    type: 'customer',
    name: 'شركة الأمل لتكنولوجيا المعلومات',
    phone: '01012345678',
    taxId: '123-456-789',
    initialBalance: 0,
  });
  assert(customer.phone === '01012345678', 'Customer registered successfully');

  // --- Test 4: Sales Invoice with 14% VAT & Serial Allocation ---
  console.log('\n--- TEST 4: Sales Invoice (VAT 14% + Serial Guard) ---');
  const saleInvoice = invoiceService.createSaleInvoice({
    contactId: customer.id,
    applyVat14: true,
    discountAmount: 1000,
    paidAmount: 20000, // الباقي آجل
    items: [
      { productId: cable.id, quantity: 2, unitPrice: 70 }, // 140
      { productId: laptop.id, quantity: 1, unitPrice: 38000, serialNumber: 'DELL-SN-001' }, // 38,000
    ],
  });

  // Total: (140 + 38000) - 1000 = 37,140
  // VAT 14%: 37140 * 0.14 = 5199.60
  // Final Amount: 37140 + 5199.60 = 42,339.60
  // Remaining: 42339.60 - 20000 = 22,339.60
  console.log(`Invoice Number: ${saleInvoice.invoiceNumber}`);
  console.log(`Subtotal: ${saleInvoice.subtotal}`);
  console.log(`VAT 14%: ${saleInvoice.taxVat14}`);
  console.log(`Final Amount: ${saleInvoice.finalAmount}`);
  console.log(`Remaining Debt: ${saleInvoice.remainingAmount}`);

  assert(saleInvoice.taxVat14 === 5199.6, 'VAT 14% accurately calculated');
  assert(saleInvoice.finalAmount === 42339.6, 'Final amount with VAT is accurate');
  assert(saleInvoice.remainingAmount === 22339.6, 'Customer debt accurately calculated');

  // فحص حالة السيريال المباع
  const soldSerial = productService.getSerialByNumber('DELL-SN-001')!;
  assert(soldSerial.status === 'sold', 'Serial DELL-SN-001 status transitioned to SOLD');
  assert(soldSerial.invoiceId === saleInvoice.id, 'Serial linked to sale invoice ID');

  // فحص خصم المخزون
  const cableAfterSale = productService.getProductById(cable.id)!;
  const laptopAfterSale = productService.getProductById(laptop.id)!;
  assert(cableAfterSale.stockQuantity === 48, 'Cable stock reduced from 50 to 48');
  assert(laptopAfterSale.stockQuantity === 2, 'Laptop stock reduced from 3 to 2');

  // فحص مديونية العميل
  const customerAfterSale = contactService.getContactById(customer.id)!;
  assert(customerAfterSale.balance === 22339.6, 'Customer balance updated with remaining debt');

  // --- Test 5: Serial Guard Protection ---
  console.log('\n--- TEST 5: Serial Guard (Preventing duplicate sale of sold serial) ---');
  let guardTriggered = false;
  try {
    invoiceService.createSaleInvoice({
      items: [{ productId: laptop.id, quantity: 1, unitPrice: 38000, serialNumber: 'DELL-SN-001' }],
    });
  } catch (err: any) {
    guardTriggered = true;
    console.log(`Caught Expected Error: ${err.message}`);
  }
  assert(guardTriggered, 'Serial guard correctly blocked selling already-sold serial number');

  // --- Test 6: Sales Return Flow (Restock vs Defective) ---
  console.log('\n--- TEST 6: Sales Return Flow (Intact vs Defective) ---');

  // إرجاع اللابتوب كصنف سليم (يعاد للمخزن)
  const returnInvoice = invoiceService.createSalesReturn({
    originalInvoiceId: saleInvoice.id,
    contactId: customer.id,
    refundAmount: 38000,
    items: [
      {
        productId: laptop.id,
        quantity: 1,
        unitPrice: 38000,
        serialNumber: 'DELL-SN-001',
        isDefective: false, // سليم
      },
    ],
  });

  console.log(`Return Invoice: ${returnInvoice.invoiceNumber}`);
  const returnedSerial = productService.getSerialByNumber('DELL-SN-001')!;
  assert(returnedSerial.status === 'in_stock', 'Intact returned serial status restored to in_stock');
  assert(returnedSerial.invoiceId === null, 'Serial unlinked from old sale invoice');
  assert(returnedSerial.returnInvoiceId === returnInvoice.id, 'Serial linked to return invoice');

  const laptopAfterReturn = productService.getProductById(laptop.id)!;
  assert(laptopAfterReturn.stockQuantity === 3, 'Laptop stock restored from 2 back to 3');

  // --- Test 7: Append-Only Stock Movements Log ---
  console.log('\n--- TEST 7: Append-Only Movements Verification ---');
  const movements = db.queryAll<any>('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at ASC', [
    laptop.id,
  ]);
  console.log(`Total movements recorded for laptop: ${movements.length}`);
  assert(movements.length === 2, 'Exactly 2 movements recorded (1 sale, 1 return)');
  assert(movements[0].type === 'sale' && movements[0].quantity === -1, 'Movement 1 is sale of -1');
  assert(movements[1].type === 'return' && movements[1].quantity === 1, 'Movement 2 is return of +1');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 1 CORE DATABASE TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
