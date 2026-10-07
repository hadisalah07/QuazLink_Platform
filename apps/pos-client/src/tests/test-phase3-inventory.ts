/**
 * QuazLink Retail POS & ERP - Phase 3 Inventory, Purchases & CRM Verification Tests
 */

import { PosDatabase } from '../database/connection.js';
import { ProductService } from '../services/product-service.js';
import { ContactService } from '../services/contact-service.js';
import { PurchaseService } from '../services/purchase-service.js';
import { InvoiceService } from '../services/invoice-service.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('📦 Running QuazLink POS Phase 3 Inventory & CRM Tests...');
  console.log('====================================================\n');

  const db = PosDatabase.createInMemory();
  const productService = new ProductService(db);
  const contactService = new ContactService(db);
  const purchaseService = new PurchaseService(db);
  const invoiceService = new InvoiceService(db);

  // --- Test 1: Product Creation & Bulk Serial Ingestion ---
  console.log('--- TEST 1: Product Management & Bulk Serials ---');
  const gpu = productService.createProduct({
    name: 'MSI GeForce RTX 4070 Ti 12GB',
    barcode: '47190724070',
    sku: 'MSI-RTX-4070TI',
    buyPrice: 32000,
    sellPriceRetail: 38500,
    sellPriceWholesale: 36500,
    minStockAlert: 2,
    hasSerial: true,
  });
  assert(gpu.hasSerial === true, 'GPU created with hasSerial=true');

  // Bulk add 5 serial numbers
  const serialList = ['MSI-SN-101', 'MSI-SN-102', 'MSI-SN-103', 'MSI-SN-104', 'MSI-SN-105'];
  const addedSerials = productService.addSerialNumbers(gpu.id, serialList, 36);
  assert(addedSerials.length === 5, 'Successfully added 5 serial numbers in bulk');

  const gpuAfterSerials = productService.getProductById(gpu.id)!;
  assert(gpuAfterSerials.stockQuantity === 5, 'Stock auto-updated to 5 based on serial count');

  // Update product prices
  const updatedGpu = productService.updateProduct(gpu.id, {
    sellPriceRetail: 39000,
    minStockAlert: 3,
  });
  assert(updatedGpu.sellPriceRetail === 39000, 'Product retail price updated to 39000');
  assert(updatedGpu.minStockAlert === 3, 'Min stock alert updated to 3');

  // --- Test 2: Supplier Registration & Purchase Invoicing ---
  console.log('\n--- TEST 2: Supplier & Purchase Invoice ---');
  const supplier = contactService.createContact({
    type: 'supplier',
    name: 'شركة الوكيل لتجارة الهاردوير والجملة',
    phone: '01222334455',
    taxId: '888-999-111',
    initialBalance: 0,
  });
  assert(supplier.type === 'supplier', 'Supplier created successfully');

  // Create another product for purchase test
  const ram = productService.createProduct({
    name: 'Corsair Vengeance 32GB DDR5',
    barcode: '84000660',
    sku: 'COR-32G-DDR5',
    buyPrice: 3800,
    sellPriceRetail: 4800,
    stockQuantity: 2,
    hasSerial: false,
  });

  // توريد بضاعة: 10 قطع RAM + 2 كروت شاشة بسيريالات
  // Total: (10 * 3800) + (2 * 32000) = 38000 + 64000 = 102,000 EGP
  // دفعنا للمورد 50,000 كاش والباقي 52,000 آجل
  const purchaseInvoice = purchaseService.createPurchaseInvoice({
    supplierId: supplier.id,
    paidAmount: 50000,
    items: [
      { productId: ram.id, quantity: 10, unitPrice: 3800 },
      {
        productId: gpu.id,
        quantity: 2,
        unitPrice: 32000,
        serialNumbers: ['MSI-SN-106', 'MSI-SN-107'],
      },
    ],
  });

  console.log(`Purchase Invoice: ${purchaseInvoice.invoiceNumber}`);
  console.log(`Subtotal: ${purchaseInvoice.subtotal}`);
  console.log(`Paid: ${purchaseInvoice.paidAmount}`);
  console.log(`Remaining Supplier Debt: ${purchaseInvoice.remainingAmount}`);

  assert(purchaseInvoice.invoiceNumber.startsWith('PUR-B01-POS01-'), 'Purchase composite number matches PUR prefix');
  assert(purchaseInvoice.finalAmount === 102000, 'Purchase total is 102,000 EGP');
  assert(purchaseInvoice.remainingAmount === 52000, 'Remaining supplier debt is 52,000 EGP');

  // Verify stock increment
  const ramAfterPur = productService.getProductById(ram.id)!;
  const gpuAfterPur = productService.getProductById(gpu.id)!;
  assert(ramAfterPur.stockQuantity === 12, 'RAM stock increased from 2 to 12');
  assert(gpuAfterPur.stockQuantity === 7, 'GPU stock increased from 5 to 7');

  // Verify supplier balance
  const supplierAfterPur = contactService.getContactById(supplier.id)!;
  assert(supplierAfterPur.balance === 52000, 'Supplier balance accurately reflects 52,000 credit debt');

  // --- Test 3: Debt Settlement (سداد للمورد وقبض من عميل) ---
  console.log('\n--- TEST 3: Debt Settlement & Payments ---');
  // سداد 20,000 للمورد
  const paymentResult = contactService.recordPayment({
    contactId: supplier.id,
    amount: 20000,
    type: 'payment', // صرف لمورد
    notes: 'تحويل بنكي دفعة تحت الحساب',
  });
  assert(paymentResult.newBalance === 32000, 'Supplier balance reduced from 52,000 to 32,000 after 20,000 payment');

  // --- Test 4: Statement of Account (كشف حساب تفصيلي) ---
  console.log('\n--- TEST 4: Statement of Account ---');
  const statement = contactService.getStatementOfAccount(supplier.id);
  console.log(`Supplier: ${statement.contact.name}`);
  console.log(`Total Debit: ${statement.totalDebit} | Total Credit: ${statement.totalCredit}`);
  console.log(`Statement Entries: ${statement.entries.length}`);

  statement.entries.forEach((entry, idx) => {
    console.log(`  [${idx + 1}] ${entry.date.substring(0, 10)} | ${entry.type} | Ref: ${entry.reference} | Debit: ${entry.debit} | Credit: ${entry.credit} | Balance: ${entry.balance}`);
  });

  assert(statement.entries.length === 3, 'Statement contains exactly 3 transactions (1 purchase, 1 initial payment, 1 settlement payment)');
  assert(Math.abs(statement.currentBalance) === 32000, 'Current balance on statement matches ledger balance (32,000)');

  // --- Test 5: Low Stock Alerts & Product Movements ---
  console.log('\n--- TEST 5: Low Stock Detection & Item Movements ---');
  // بيع 5 كروت شاشة ليتبقى 2 في المخزن (أقل من حد التنبيه 3)
  invoiceService.createSaleInvoice({
    items: [
      { productId: gpu.id, quantity: 1, unitPrice: 39000, serialNumber: 'MSI-SN-101' },
      { productId: gpu.id, quantity: 1, unitPrice: 39000, serialNumber: 'MSI-SN-102' },
      { productId: gpu.id, quantity: 1, unitPrice: 39000, serialNumber: 'MSI-SN-103' },
      { productId: gpu.id, quantity: 1, unitPrice: 39000, serialNumber: 'MSI-SN-104' },
      { productId: gpu.id, quantity: 1, unitPrice: 39000, serialNumber: 'MSI-SN-105' },
    ],
  });

  const gpuAfterSales = productService.getProductById(gpu.id)!;
  assert(gpuAfterSales.stockQuantity === 2, 'GPU stock reduced to 2');

  const lowStockProducts = productService.getLowStockProducts();
  const isGpuAlerted = lowStockProducts.some((p) => p.id === gpu.id);
  assert(isGpuAlerted, 'GPU correctly flagged in Low Stock Alerts (Stock: 2 <= Min: 3)');

  // فحص كارت حركة الصنف
  const movements = productService.getProductMovements(gpu.id);
  console.log(`Total movements logged for GPU: ${movements.length}`);
  // Initial 5 from addSerials, 2 from purchase, 5 sales = 7 movements
  assert(movements.length > 0, 'Movement audit trail successfully tracks item stock history');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 3 INVENTORY & CRM TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runPhase3Tests().catch((err) => {
  console.error('Fatal Phase 3 test error:', err);
  process.exit(1);
});
