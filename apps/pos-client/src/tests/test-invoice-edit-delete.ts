import { PosDatabase } from '../database/connection.js';
import { InvoiceService } from '../services/invoice-service.js';
import { ProductService } from '../services/product-service.js';
import { ContactService } from '../services/contact-service.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function runTest() {
  console.log('🧪 Starting Edit & Delete Invoice Automated Test...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quazlink-test-edit-del-'));
  const dbPath = path.join(tempDir, 'test.sqlite');

  const db = PosDatabase.getInstance(dbPath);

  const productService = new ProductService(db);
  const contactService = new ContactService(db);
  const invoiceService = new InvoiceService(db);

  // 1. Create a customer
  const customer = contactService.createContact({
    name: 'أحمد محمود',
    phone: '01011112222',
    type: 'customer',
  });

  // 2. Create products (one normal, one with serial)
  const productA = productService.createProduct({
    name: 'شاحن أنكر 20W',
    barcode: 'ANKER20W',
    sellPriceRetail: 350,
    buyPrice: 200,
    stockQuantity: 10,
    unit: 'قطعة',
  });

  const productB = productService.createProduct({
    name: 'راوتر تي بي لينك',
    barcode: 'TPLINK300',
    sellPriceRetail: 800,
    buyPrice: 500,
    stockQuantity: 0,
    unit: 'قطعة',
    hasSerial: true,
  });

  // Add a serial for productB (stock becomes 1)
  productService.addSerialNumbers(productB.id, ['TP-SN-998811'], 12);

  console.log('✅ Initial state: Product A stock = 10, Product B stock = 1, Customer balance = 0');

  // 3. Create a sale invoice
  const inv = invoiceService.createSaleInvoice({
    contactId: customer.id,
    paymentMethod: 'credit',
    paidAmount: 500, // 500 paid, rest credit
    items: [
      { productId: productA.id, quantity: 2, unitPrice: 350 }, // 700
      { productId: productB.id, quantity: 1, unitPrice: 800, serialNumber: 'TP-SN-998811' }, // 800
    ],
    // Subtotal: 1500, Paid: 500, Remaining: 1000
  });

  console.log(`✅ Invoice Created: ${inv.invoiceNumber}, Final: ${inv.finalAmount}, Remaining: ${inv.remainingAmount}`);

  const prodA_afterSale = productService.getProductById(productA.id)!;
  const prodB_afterSale = productService.getProductById(productB.id)!;
  const cust_afterSale = contactService.getContactById(customer.id)!;
  const serial_afterSale = productService.getSerialByNumber('TP-SN-998811')!;

  if (prodA_afterSale.stockQuantity !== 8) throw new Error(`Expected Prod A stock 8, got ${prodA_afterSale.stockQuantity}`);
  if (prodB_afterSale.stockQuantity !== 0) throw new Error(`Expected Prod B stock 0, got ${prodB_afterSale.stockQuantity}`);
  if (cust_afterSale.balance !== 1000) throw new Error(`Expected Customer balance 1000, got ${cust_afterSale.balance}`);
  if (serial_afterSale.status !== 'sold') throw new Error(`Expected Serial status 'sold', got ${serial_afterSale.status}`);

  console.log('✅ Stock deducted, serial marked sold, customer debt recorded accurately.');

  // 4. Test Update Sale Invoice
  // Change Product A quantity from 2 to 3, and add a 50 EGP discount
  console.log('🔄 Testing Invoice Update (Edit)...');
  const updatedDetails = invoiceService.updateSaleInvoice(inv.id, {
    contactId: customer.id,
    paymentMethod: 'credit',
    discountAmount: 50,
    paidAmount: 600,
    items: [
      { productId: productA.id, quantity: 3, unitPrice: 350 }, // 1050
      { productId: productB.id, quantity: 1, unitPrice: 800, serialNumber: 'TP-SN-998811' }, // 800
    ],
    // Subtotal: 1850, Disc: 50, Final: 1800, Paid: 600, Remaining: 1200
  });

  const updatedInv = updatedDetails.invoice;
  const prodA_afterEdit = productService.getProductById(productA.id)!;
  const cust_afterEdit = contactService.getContactById(customer.id)!;

  if (prodA_afterEdit.stockQuantity !== 7) throw new Error(`Expected Prod A stock 7 after edit, got ${prodA_afterEdit.stockQuantity}`);
  if (updatedInv.finalAmount !== 1800) throw new Error(`Expected final 1800, got ${updatedInv.finalAmount}`);
  if (cust_afterEdit.balance !== 1200) throw new Error(`Expected customer debt 1200, got ${cust_afterEdit.balance}`);

  console.log('✅ Invoice Edit succeeded! Stock reconciled from 8 to 7, customer balance updated to 1200.');

  // 5. Test Delete Invoice
  console.log('🗑️ Testing Invoice Delete...');
  const deleteResult = invoiceService.deleteInvoice(inv.id);
  if (!deleteResult.success) throw new Error('Delete invoice failed');

  const prodA_afterDelete = productService.getProductById(productA.id)!;
  const prodB_afterDelete = productService.getProductById(productB.id)!;
  const cust_afterDelete = contactService.getContactById(customer.id)!;
  const serial_afterDelete = productService.getSerialByNumber('TP-SN-998811')!;
  const inv_afterDelete = invoiceService.getInvoiceById(inv.id);

  if (inv_afterDelete !== null) throw new Error('Invoice still exists after delete');
  if (prodA_afterDelete.stockQuantity !== 10) throw new Error(`Expected Prod A stock 10, got ${prodA_afterDelete.stockQuantity}`);
  if (prodB_afterDelete.stockQuantity !== 1) throw new Error(`Expected Prod B stock 1, got ${prodB_afterDelete.stockQuantity}`);
  if (cust_afterDelete.balance !== 0) throw new Error(`Expected Customer balance 0, got ${cust_afterDelete.balance}`);
  if (serial_afterDelete.status !== 'in_stock') throw new Error(`Expected Serial in_stock, got ${serial_afterDelete.status}`);

  console.log('✅ Invoice Delete verified 100%! All stock restored to initial, serial released, debt cleared!');
  console.log('🎉 ALL EDIT & DELETE TESTS PASSED WITH 100% SUCCESS!');

  db.close();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
