import { PosDatabase } from '../database/connection.js';
import { ProductService } from '../services/product-service.js';
import { ContactService } from '../services/contact-service.js';
import { PurchaseService } from '../services/purchase-service.js';

console.log('🧪 Testing Cashier POS Purchase/Supply Direct Mode...');

const db = PosDatabase.createInMemory();
const productService = new ProductService(db);
const contactService = new ContactService(db);
const purchaseService = new PurchaseService(db);

// 1. Create a product with initial stock = 5
const p1 = productService.createProduct({
  barcode: 'TEST-SSD-1TB',
  name: 'Kingston SSD 1TB NVMe',
  buyPrice: 1800,
  sellPriceRetail: 2400,
  sellPriceWholesale: 2200,
  stockQuantity: 5,
  hasSerial: false,
});

console.log('✅ Initial product stock:', p1.stockQuantity);

// 2. Perform Cashier Direct Purchase (without passing supplierId, testing fallback default supplier)
const purchaseResult = purchaseService.createPurchaseInvoice({
  paymentMethod: 'cash',
  paidAmount: 3600,
  notes: 'توريد سريع من كاشير POS',
  items: [
    {
      productId: p1.id,
      quantity: 2,
      unitPrice: 1800,
    },
  ],
});

console.log('✅ Purchase created successfully with invoice number:', purchaseResult.invoiceNumber);

// Verify stock increased from 5 to 7
const updatedProduct = productService.getProductById(p1.id);
if (updatedProduct?.stockQuantity === 7) {
  console.log('✅ Verified: Product stock increased from 5 to 7!');
} else {
  throw new Error(`Expected stock 7 but got ${updatedProduct?.stockQuantity}`);
}

// 3. Test Purchase with Serial Number
const p2 = productService.createProduct({
  barcode: 'TEST-LAPTOP-DELL',
  name: 'Dell Latitude 5420 i7',
  buyPrice: 15000,
  sellPriceRetail: 18500,
  sellPriceWholesale: 17500,
  stockQuantity: 0,
  hasSerial: true,
});

const purchaseWithSerial = purchaseService.createPurchaseInvoice({
  paymentMethod: 'credit',
  paidAmount: 0,
  notes: 'توريد جهاز لابتوب بسيريال',
  items: [
    {
      productId: p2.id,
      quantity: 1,
      unitPrice: 15000,
      serialNumbers: ['SN-DELL-2026-X1'],
    },
  ],
});

console.log('✅ Purchase with serial created:', purchaseWithSerial.invoiceNumber);
const updatedP2 = productService.getProductById(p2.id);
if (updatedP2?.stockQuantity === 1) {
  console.log('✅ Verified: Serial product stock increased to 1!');
} else {
  throw new Error(`Expected serial product stock 1, got ${updatedP2?.stockQuantity}`);
}

const serialRow = db.prepare('SELECT * FROM product_serials WHERE serial_number = ?').get('SN-DELL-2026-X1') as any;
if (serialRow && serialRow.status === 'in_stock') {
  console.log('✅ Verified: Serial number recorded into stock database as "in_stock"!');
} else {
  throw new Error(`Expected serial in_stock, got ${serialRow?.status}`);
}

console.log('🎉 ALL CASHIER PURCHASE TESTS PASSED 100%!');
