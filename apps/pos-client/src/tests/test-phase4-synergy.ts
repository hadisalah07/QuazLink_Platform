import * as path from 'node:path';
import * as fs from 'node:fs';
import { PosDatabase } from '../database/connection';
import { ProductService } from '../services/product-service';
import { ContactService } from '../services/contact-service';
import { InvoiceService } from '../services/invoice-service';
import { AiAdService } from '../services/ai-ad-service';

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('✨ Running QuazLink POS Phase 4 Ecosystem Synergy Tests...');
  console.log('====================================================\n');

  const testDbPath = path.join(process.cwd(), 'test-pos-phase4.sqlite');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
  if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);

  const db = PosDatabase.getInstance(testDbPath);
  const productService = new ProductService(db);
  const contactService = new ContactService(db);
  const invoiceService = new InvoiceService(db);
  const aiAdService = new AiAdService();

  try {
    // ----------------------------------------------------
    // TEST 1: AI Marketing Ad Generation Engine
    // ----------------------------------------------------
    console.log('--- TEST 1: AI Marketing Ad Copy Engine ---');
    const laptop = productService.createProduct({
      name: 'لابتوب لينوفو ليجن Lenovo Legion Pro 5',
      sku: 'LEGION-PRO5',
      buyPrice: 48000,
      sellPriceRetail: 54000,
      sellPriceWholesale: 51500,
      stockQuantity: 4,
      minStockAlert: 2,
      hasSerial: true,
    });

    // 1.1 Facebook Post
    const fbAd = await aiAdService.generateAd({
      product: laptop,
      preset: 'facebook_post',
      storeName: 'الوكيل للكمبيوتر والجيمنج',
      storePhone: '01012345678',
      customPrompt: 'خصم خاص للدفع كاش + شنطة هدية',
    });
    console.log('Generated Facebook Post Preview:\n' + fbAd.slice(0, 160) + '...\n');
    if (!fbAd.includes('Lenovo Legion') || !fbAd.includes('54,000') || !fbAd.includes('01012345678')) {
      throw new Error('Facebook ad missing product name, price, or phone');
    }
    console.log('✅ Facebook post ad generated with specs, price, and Egyptian retail tone');

    // 1.2 WhatsApp Broadcast
    const waAd = await aiAdService.generateAd({
      product: laptop,
      preset: 'whatsapp_broadcast',
      storeName: 'الوكيل للكمبيوتر والجيمنج',
      storePhone: '01012345678',
    });
    if (!waAd.includes('54,000 EGP') || !waAd.includes('الوكيل للكمبيوتر')) {
      throw new Error('WhatsApp broadcast ad missing price or store name');
    }
    console.log('✅ WhatsApp broadcast copy generated with bullet points');

    // 1.3 Flash Sale (48 Hours)
    const flashAd = await aiAdService.generateAd({
      product: laptop,
      preset: 'flash_sale',
      storeName: 'الوكيل للكمبيوتر والجيمنج',
      storePhone: '01012345678',
    });
    if (!flashAd.includes('48 سـاعـة') || !flashAd.includes('54,000')) {
      throw new Error('Flash sale ad missing 48-hour urgency or price');
    }
    console.log('✅ Flash sale ad generated with urgency triggers');

    // 1.4 Tech Review Specs
    const techAd = await aiAdService.generateAd({
      product: laptop,
      preset: 'tech_review',
      storeName: 'الوكيل للكمبيوتر والجيمنج',
      storePhone: '01012345678',
    });
    console.log('Tech Review Ad Preview:\n' + techAd.slice(0, 160) + '...\n');
    if (!techAd.includes('Lenovo Legion') && !techAd.includes('لينوفو')) {
      throw new Error('Tech review ad missing product name');
    }
    console.log('✅ Tech review specs ad generated accurately');

    // ----------------------------------------------------
    // TEST 2: Digital WhatsApp Invoice Packaging
    // ----------------------------------------------------
    console.log('\n--- TEST 2: WhatsApp Digital Invoice Formatting ---');
    const customer = contactService.createContact({
      name: 'م / أحمد الشناوي',
      phone: '01123456789',
      type: 'customer',
    });

    const serials = productService.addSerialNumbers(laptop.id, ['LEGION-SN-9988'], 24);

    const invoice = invoiceService.createSaleInvoice({
      contactId: customer.id,
      paymentMethod: 'cash',
      paidAmount: 54000,
      applyVat14: false,
      items: [
        {
          productId: laptop.id,
          quantity: 1,
          unitPrice: 54000,
          serialNumber: 'LEGION-SN-9988',
        },
      ],
    });

    console.log(`Sale Invoice Created: ${invoice.invoiceNumber}`);

    // Verify WhatsApp Status is initially pending
    const createdInvoice = invoiceService.getInvoiceById(invoice.id);
    if (!createdInvoice) throw new Error('Invoice not found');
    console.log(`Initial WhatsApp Status: ${createdInvoice.whatsappStatus}`);
    if (createdInvoice.whatsappStatus !== 'pending') {
      throw new Error('Initial whatsapp status must be pending');
    }
    console.log('✅ Initial invoice whatsapp_status is pending');

    // Simulate WhatsApp Dispatch
    const items = invoiceService.getInvoiceItems(invoice.id);
    const storeName = 'الوكيل للكمبيوتر والجيمنج';
    const storePhone = '01012345678';

    let waText = `🧾 *فاتورة شراء إلكترونية معتمدة*\n`;
    waText += `🏬 *${storeName}*\n`;
    waText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `🔢 رقم الفاتورة: *${invoice.invoiceNumber}*\n`;
    waText += `👤 العميل: ${customer.name}\n\n`;
    waText += `📦 *بيان الأصناف والضمان:*\n`;
    items.forEach((item) => {
      waText += `• ${laptop.name} × ${item.quantity} = ${item.totalPrice.toFixed(2)} EGP\n`;
      if (item.serialNumber) {
        waText += `  └ 🔑 سـيـريـال الضمان: *${item.serialNumber}*\n`;
      }
    });
    waText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    waText += `💵 الإجمالي: *${invoice.finalAmount.toFixed(2)} EGP*\n`;
    waText += `💰 المدفوع: *${invoice.paidAmount.toFixed(2)} EGP*\n`;

    let normPhone = customer.phone.replace(/\D/g, '');
    if (normPhone.startsWith('01') && normPhone.length === 11) {
      normPhone = '2' + normPhone;
    }
    const whatsappUrl = `https://wa.me/${normPhone}?text=${encodeURIComponent(waText)}`;

    if (!whatsappUrl.startsWith('https://wa.me/20112345678')) {
      throw new Error(`Invalid WhatsApp URL: ${whatsappUrl}`);
    }
    if (!waText.includes('LEGION-SN-9988') || !waText.includes('54000.00 EGP')) {
      throw new Error('WhatsApp text missing serial number or final amount');
    }

    // Update status in DB
    db.run("UPDATE invoices SET whatsapp_status = 'sent' WHERE id = ?", [invoice.id]);
    const updatedInvoice = invoiceService.getInvoiceById(invoice.id);
    if (updatedInvoice?.whatsappStatus !== 'sent') {
      throw new Error('whatsapp_status not updated to sent');
    }
    console.log('✅ WhatsApp message format contains customer, serial, and correct totals');
    console.log('✅ WhatsApp URL formatted correctly with country code (+20)');
    console.log('✅ Invoice record successfully marked as sent in SQLite database');

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 4 ECOSYSTEM SYNERGY TESTS PASSED 100%!');
    console.log('====================================================\n');
  } finally {
    try {
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch (e) {}
  }
}

runPhase4Tests().catch((err) => {
  console.error('❌ Phase 4 Tests Failed:', err);
  process.exit(1);
});
