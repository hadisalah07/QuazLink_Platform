import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URL } from 'node:url';
import { PosDatabase } from '../database/connection.js';
import { ProductService } from '../services/product-service.js';
import { ContactService } from '../services/contact-service.js';
import { InvoiceService } from '../services/invoice-service.js';
import { PurchaseService } from '../services/purchase-service.js';
import { PrinterService } from '../printer/printer-service.js';
import { ReceiptData } from '../printer/types.js';
import { AiAdService } from '../services/ai-ad-service.js';
import { SettingsService } from '../services/settings-service.js';
import { LicensingService } from '../services/licensing-service.js';
import { ShiftService } from '../services/shift-service.js';
import { SyncService } from '../services/sync-service.js';
import { EtaService } from '../services/eta-service.js';
import { PosUpdaterService } from '../services/updater-service.js';

export interface PosServerOptions {
  port?: number;
  dbPath?: string;
  uiDir?: string;
}

export class PosServer {
  private server: http.Server;
  private port: number;
  private db: PosDatabase;
  private productService: ProductService;
  private contactService: ContactService;
  private invoiceService: InvoiceService;
  private purchaseService: PurchaseService;
  private printerService: PrinterService;
  private aiAdService: AiAdService;
  private settingsService: SettingsService;
  private licensingService: LicensingService;
  private shiftService: ShiftService;
  private syncService: SyncService;
  private etaService: EtaService;
  private updaterService: PosUpdaterService;
  private uiDir: string;

  constructor(options: PosServerOptions = {}) {
    this.port = options.port || 3030;
    this.db = options.dbPath ? PosDatabase.getInstance(options.dbPath) : PosDatabase.getInstance();
    this.productService = new ProductService(this.db);
    this.contactService = new ContactService(this.db);
    this.invoiceService = new InvoiceService(this.db);
    this.purchaseService = new PurchaseService(this.db);
    this.printerService = new PrinterService({ width: '80mm' });
    this.aiAdService = new AiAdService();
    this.settingsService = new SettingsService(this.db);
    this.licensingService = new LicensingService(this.db);
    this.shiftService = new ShiftService(this.db);
    this.syncService = new SyncService(this.db, this.settingsService, this.licensingService);
    this.etaService = new EtaService(this.db);
    this.updaterService = new PosUpdaterService('1.0.0');

    this.uiDir = options.uiDir || path.join(__dirname, '..', 'ui');
    if (!fs.existsSync(this.uiDir)) {
      this.uiDir = path.join(process.cwd(), 'apps', 'pos-client', 'src', 'ui');
    }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }


  public start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`⚡ QuazLink POS Local Server running at http://localhost:${this.port}`);
        resolve(this.port);
      });
    });
  }

  public stop(): Promise<void> {
    this.syncService.stopAutoSync();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS for local integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    try {
      // API Routes
      if (pathname.startsWith('/api/')) {
        await this.handleApiRoutes(pathname, reqUrl, req, res);
        return;
      }

      // Static UI Files
      this.serveStatic(pathname, res);
    } catch (err: any) {
      console.error('API Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
    }
  }

  private async handleApiRoutes(pathname: string, url: URL, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // 1. GET /api/products
    if (pathname === '/api/products' && req.method === 'GET') {
      const q = url.searchParams.get('q');
      let products = this.productService.getAllProducts();
      if (q) {
        const query = q.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            (p.barcode && p.barcode.includes(query)) ||
            (p.sku && p.sku.toLowerCase().includes(query))
        );
      }
      this.sendJson(res, { success: true, products });
      return;
    }

    // 2. GET /api/products/barcode/:barcode
    if (pathname.startsWith('/api/products/barcode/') && req.method === 'GET') {
      const barcode = pathname.replace('/api/products/barcode/', '');
      const product = this.productService.getProductByBarcode(barcode);
      if (!product) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Product not found' }));
        return;
      }
      this.sendJson(res, { success: true, product });
      return;
    }

    // 3. GET /api/products/:id/serials
    if (pathname.match(/^\/api\/products\/[^/]+\/serials$/) && req.method === 'GET') {
      const parts = pathname.split('/');
      const productId = parts[3];
      const serials = this.productService.getAvailableSerials(productId);
      this.sendJson(res, { success: true, serials });
      return;
    }

    // 4. POST /api/invoices/checkout
    if (pathname === '/api/invoices/checkout' && req.method === 'POST') {
      const body = await this.readBody(req);
      const invoice = this.invoiceService.createSaleInvoice(body);

      // Auto-trigger thermal print if requested
      let printerResult = null;
      if (body.printReceipt) {
        const items = this.invoiceService.getInvoiceItems(invoice.id);
        const receiptData: ReceiptData = {
          storeName: body.storeName || 'QUAZLINK ELECTRONICS & COMPUTERS',
          storePhone: body.storePhone || '01000000000',
          invoiceNumber: invoice.invoiceNumber,
          dateStr: new Date(invoice.createdAt).toLocaleString('ar-EG'),
          cashierName: body.cashierName || 'Cashier 1',
          currency: 'EGP',
          subtotal: invoice.subtotal,
          discountAmount: invoice.discountAmount,
          taxVat14: invoice.taxVat14,
          finalAmount: invoice.finalAmount,
          paidAmount: invoice.paidAmount,
          remainingAmount: invoice.remainingAmount,
          items: items.map((i) => {
            const prod = this.productService.getProductById(i.productId);
            return {
              name: prod ? prod.name : 'Unknown Item',
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              serialNumber: i.serialNumber,
            };
          }),
        };

        printerResult = await this.printerService.printReceipt(receiptData);
      }

      this.sendJson(res, { success: true, invoice, printerResult });
      return;
    }

    // 5. POST /api/invoices/return
    if (pathname === '/api/invoices/return' && req.method === 'POST') {
      const body = await this.readBody(req);
      const returnInvoice = this.invoiceService.createSalesReturn(body);
      this.sendJson(res, { success: true, returnInvoice });
      return;
    }

    // 5b. GET /api/invoices (قائمة فواتير البيع والمرتجعات)
    if (pathname === '/api/invoices' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const invoices = this.invoiceService.getAllInvoicesWithDetails(200);
      const filtered = type ? invoices.filter((inv) => inv.type === type) : invoices;
      this.sendJson(res, { success: true, invoices: filtered });
      return;
    }

    // 5c. GET /api/invoices/:id (تفاصيل الفاتورة الكاملة مع بنودها)
    if (pathname.match(/^\/api\/invoices\/[^/]+$/) && req.method === 'GET') {
      const id = pathname.replace('/api/invoices/', '');
      const details = this.invoiceService.getInvoiceFullDetails(id);
      if (!details) {
        this.sendJson(res, { success: false, error: 'Invoice not found' }, 404);
        return;
      }
      this.sendJson(res, { success: true, ...details });
      return;
    }


    // 6. POST /api/products (إضافة منتج جديد مع سيريالات اختيارية)
    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await this.readBody(req);
      const product = this.productService.createProduct(body);
      if (body.hasSerial && body.initialSerials && Array.isArray(body.initialSerials)) {
        this.productService.addSerialNumbers(product.id, body.initialSerials, body.warrantyMonths || 12);
      }
      this.sendJson(res, { success: true, product: this.productService.getProductById(product.id) });
      return;
    }

    // 7. PUT /api/products/:id (تعديل منتج)
    if (pathname.match(/^\/api\/products\/[^/]+$/) && req.method === 'PUT') {
      const id = pathname.replace('/api/products/', '');
      const body = await this.readBody(req);
      const updated = this.productService.updateProduct(id, body);
      this.sendJson(res, { success: true, product: updated });
      return;
    }

    // 8. POST /api/products/:id/serials/bulk (إضافة دفعة سيريالات)
    if (pathname.match(/^\/api\/products\/[^/]+\/serials\/bulk$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const productId = parts[3];
      const body = await this.readBody(req);
      const serials = this.productService.addSerialNumbers(
        productId,
        body.serials || [],
        body.warrantyMonths || 12
      );
      this.sendJson(res, { success: true, count: serials.length, serials });
      return;
    }

    // 9. GET /api/products/:id/movements (كشف حركة صنف)
    if (pathname.match(/^\/api\/products\/[^/]+\/movements$/) && req.method === 'GET') {
      const parts = pathname.split('/');
      const productId = parts[3];
      const movements = this.productService.getProductMovements(productId);
      this.sendJson(res, { success: true, movements });
      return;
    }

    // 10. GET /api/inventory/low-stock (تقرير النواقص)
    if (pathname === '/api/inventory/low-stock' && req.method === 'GET') {
      const lowStock = this.productService.getLowStockProducts();
      this.sendJson(res, { success: true, lowStock });
      return;
    }

    // 11. POST /api/purchases (فاتورة شراء وتوريد)
    if (pathname === '/api/purchases' && req.method === 'POST') {
      const body = await this.readBody(req);
      const invoice = this.purchaseService.createPurchaseInvoice(body);
      this.sendJson(res, { success: true, invoice });
      return;
    }

    // 12. GET /api/purchases (فواتير المشتريات)
    if (pathname === '/api/purchases' && req.method === 'GET') {
      const purchases = this.purchaseService.getAllPurchases(50);
      this.sendJson(res, { success: true, purchases });
      return;
    }

    // 13. GET /api/contacts (عملاء وموردين)
    if (pathname === '/api/contacts' && req.method === 'GET') {
      const phone = url.searchParams.get('phone');
      const type = url.searchParams.get('type') as any;
      if (phone) {
        const contact = this.contactService.getContactByPhone(phone);
        this.sendJson(res, { success: true, contact });
        return;
      }
      const contacts = this.contactService.getAllContacts(type || undefined);
      this.sendJson(res, { success: true, contacts });
      return;
    }

    // 14. POST /api/contacts (تسجيل عميل أو مورد)
    if (pathname === '/api/contacts' && req.method === 'POST') {
      const body = await this.readBody(req);
      const contact = this.contactService.createContact(body);
      this.sendJson(res, { success: true, contact });
      return;
    }

    // 15. GET /api/contacts/:id/statement (كشف حساب تفصيلي)
    if (pathname.match(/^\/api\/contacts\/[^/]+\/statement$/) && req.method === 'GET') {
      const parts = pathname.split('/');
      const contactId = parts[3];
      const statement = this.contactService.getStatementOfAccount(contactId);
      this.sendJson(res, { success: true, statement });
      return;
    }

    // 16. POST /api/payments (سند قبض أو صرف لتسديد الديون)
    if (pathname === '/api/payments' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = this.contactService.recordPayment(body);
      this.sendJson(res, { success: true, ...result });
      return;
    }

    // 17. POST /api/printer/print-receipt
    if (pathname === '/api/printer/print-receipt' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = await this.printerService.printReceipt(body);
      this.sendJson(res, { success: true, result });
      return;
    }

    // 18. POST /api/ai/generate-ad (توليد إعلانات تسويقية بالذكاء الاصطناعي)
    if (pathname === '/api/ai/generate-ad' && req.method === 'POST') {
      const body = await this.readBody(req);
      const product = this.productService.getProductById(body.productId);
      if (!product) {
        this.sendJson(res, { success: false, error: 'Product not found' }, 404);
        return;
      }
      const adText = await this.aiAdService.generateAd({
        product,
        preset: body.preset || 'facebook_post',
        storeName: body.storeName,
        storePhone: body.storePhone,
        customPrompt: body.customPrompt,
      });
      this.sendJson(res, { success: true, adText });
      return;
    }

    // 19. POST /api/invoices/:id/whatsapp (تجهيز وإرسال الفاتورة عبر واتساب)
    if (pathname.match(/^\/api\/invoices\/[^/]+\/whatsapp$/) && req.method === 'POST') {
      const parts = pathname.split('/');
      const invoiceId = parts[3];
      const body = await this.readBody(req);
      const invoice = this.invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        this.sendJson(res, { success: false, error: 'Invoice not found' }, 404);
        return;
      }
      const items = this.invoiceService.getInvoiceItems(invoiceId);
      let customerPhone = body.phone;
      let customerName = 'عميل نقدي';
      if (invoice.contactId) {
        const contact = this.contactService.getContactById(invoice.contactId);
        if (contact) {
          if (!customerPhone && contact.phone) customerPhone = contact.phone;
          customerName = contact.name;
        }
      }

      const storeName = body.storeName || 'كويزلينك ستور للإلكترونيات والكمبيوتر';
      const storePhone = body.storePhone || '01000000000';
      let text = `🧾 *فاتورة شراء إلكترونية معتمدة*\n`;
      text += `🏬 *${storeName}*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🔢 رقم الفاتورة: *${invoice.invoiceNumber}*\n`;
      text += `📅 التاريخ: ${new Date(invoice.createdAt).toLocaleString('ar-EG')}\n`;
      text += `👤 العميل: ${customerName}\n\n`;
      text += `📦 *بيان الأصناف والضمان:*\n`;
      items.forEach((item) => {
        const prod = this.productService.getProductById(item.productId);
        const prodName = prod ? prod.name : 'صنف';
        text += `• ${prodName} × ${item.quantity} = ${item.totalPrice.toFixed(2)} EGP\n`;
        if (item.serialNumber) {
          text += `  └ 🔑 سـيـريـال الضمان: *${item.serialNumber}*\n`;
        }
      });
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `💵 الإجمالي: *${invoice.finalAmount.toFixed(2)} EGP*\n`;
      text += `💰 المدفوع: *${invoice.paidAmount.toFixed(2)} EGP*\n`;
      if (invoice.remainingAmount > 0) {
        text += `⏳ المتبقي (آجل): *${invoice.remainingAmount.toFixed(2)} EGP*\n`;
      }
      text += `\n✨ شكراً لثقتكم بنا وبمنتجاتنا!\n📞 للاستفسارات والدعم الفني: ${storePhone}`;

      let normPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
      if (normPhone.startsWith('01') && normPhone.length === 11) {
        normPhone = '2' + normPhone;
      }
      const whatsappUrl = normPhone
        ? `https://wa.me/${normPhone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;

      try {
        this.db.run("UPDATE invoices SET whatsapp_status = 'sent', updated_at = datetime('now') WHERE id = ?", [invoiceId]);
      } catch (e) {}

      this.sendJson(res, { success: true, whatsappUrl, invoiceText: text, customerPhone });
      return;
    }

    // 20. GET /api/settings (إعدادات النظام والموديولات)
    if (pathname === '/api/settings' && req.method === 'GET') {
      const settings = this.settingsService.getAllSettings();
      this.sendJson(res, { success: true, settings });
      return;
    }

    // 21. POST /api/settings (تحديث إعدادات النظام)
    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await this.readBody(req);
      const settings = this.settingsService.updateMultipleSettings(body);
      this.sendJson(res, { success: true, settings });
      return;
    }

    // 22. GET /api/license (بصمة العتاد وحالة الترخيص)
    if (pathname === '/api/license' && req.method === 'GET') {
      const license = this.licensingService.getLicenseInfo();
      this.sendJson(res, { success: true, license });
      return;
    }

    // 23. POST /api/license/activate (تفعيل مفتاح ترخيص)
    if (pathname === '/api/license/activate' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = this.licensingService.activateLicense(body.key || '');
      this.sendJson(res, result, result.success ? 200 : 400);
      return;
    }

    // 24. GET /api/shifts/current (الوردية النشطة وملخص الخزينة اللحظي)
    if (pathname === '/api/shifts/current' && req.method === 'GET') {
      const shift = this.shiftService.getCurrentShift();
      if (!shift) {
        this.sendJson(res, { success: true, hasActiveShift: false, shift: null });
        return;
      }
      const summary = this.shiftService.getShiftSummary(shift.id);
      this.sendJson(res, { success: true, hasActiveShift: true, shift, summary });
      return;
    }

    // 25. POST /api/shifts/open (فتح وردية جديدة)
    if (pathname === '/api/shifts/open' && req.method === 'POST') {
      const body = await this.readBody(req);
      try {
        const shift = this.shiftService.openShift(body);
        this.sendJson(res, { success: true, shift });
      } catch (err: any) {
        this.sendJson(res, { success: false, error: err.message }, 400);
      }
      return;
    }

    // 26. POST /api/shifts/expense (تسجيل مصروف نثري)
    if (pathname === '/api/shifts/expense' && req.method === 'POST') {
      const body = await this.readBody(req);
      try {
        const expense = this.shiftService.recordPettyExpense(body);
        this.sendJson(res, { success: true, expense });
      } catch (err: any) {
        this.sendJson(res, { success: false, error: err.message }, 400);
      }
      return;
    }

    // 27. POST /api/shifts/close (تقفيل الوردية والخزينة وإصدار Z-Report)
    if (pathname === '/api/shifts/close' && req.method === 'POST') {
      const body = await this.readBody(req);
      try {
        const result = this.shiftService.closeShift(body);
        this.sendJson(res, { success: true, ...result });
      } catch (err: any) {
        this.sendJson(res, { success: false, error: err.message }, 400);
      }
      return;
    }

    // 28. GET /api/shifts (سجل الورديات السابقة)
    if (pathname === '/api/shifts' && req.method === 'GET') {
      const shifts = this.shiftService.getAllShifts(50);
      this.sendJson(res, { success: true, shifts });
      return;
    }

    // 29. GET /api/shifts/:id/summary
    if (pathname.match(/^\/api\/shifts\/[^/]+\/summary$/) && req.method === 'GET') {
      const parts = pathname.split('/');
      const shiftId = parts[3];
      try {
        const summary = this.shiftService.getShiftSummary(shiftId);
        const shift = this.shiftService.getShiftById(shiftId);
        const zReportText = this.shiftService.formatZReportText(shift, summary);
        this.sendJson(res, { success: true, shift, summary, zReportText });
      } catch (err: any) {
        this.sendJson(res, { success: false, error: err.message }, 404);
      }
      return;
    }

    // 30. GET /api/sync/status (حالة المزامنة السحابية والعمليات المعلقة)
    if (pathname === '/api/sync/status' && req.method === 'GET') {
      const status = await this.syncService.getSyncStatus();
      this.sendJson(res, { success: true, ...status });
      return;
    }

    // 31. POST /api/sync/trigger (تشغيل المزامنة السحابية اليدوية أو القسرية)
    if (pathname === '/api/sync/trigger' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = await this.syncService.triggerSync(body);
      this.sendJson(res, result, result.success ? 200 : 400);
      return;
    }

    // 32. GET /api/backups (سجل النسخ الاحتياطية للنظام)
    if (pathname === '/api/backups' && req.method === 'GET') {
      const backups = this.syncService.listBackups();
      this.sendJson(res, { success: true, backups });
      return;
    }

    // 33. POST /api/backups/create (إنشاء نسخة احتياطية فورية)
    if (pathname === '/api/backups/create' && req.method === 'POST') {
      const body = await this.readBody(req);
      const backup = await this.syncService.createBackup(body);
      this.sendJson(res, { success: true, backup });
      return;
    }

    // 34. POST /api/backups/restore (استعادة قاعدة البيانات من نسخة احتياطية)
    if (pathname === '/api/backups/restore' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = body.payload
        ? this.syncService.restoreFromPayloadString(body.payload)
        : this.syncService.restoreBackup(body.id);
      this.sendJson(res, result, result.success ? 200 : 400);
      return;
    }

    // 35. GET /api/backups/:id/download (تحميل ملف النسخة الاحتياطية)
    if (pathname.match(/^\/api\/backups\/[^/]+\/download$/) && req.method === 'GET') {
      const backupId = pathname.split('/')[3];
      const payload = this.syncService.getBackupPayload(backupId);
      if (!payload) {
        this.sendJson(res, { success: false, error: 'Backup file not found' }, 404);
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="quazlink_backup_${backupId}.qzbk"`,
      });
      res.end(payload);
      return;
    }

    // 36. GET /api/credits (رصيد باقات الذكاء الاصطناعي والواتساب)
    if (pathname === '/api/credits' && req.method === 'GET') {
      const credits = this.licensingService.getCreditWallet();
      this.sendJson(res, { success: true, credits });
      return;
    }

    // 37. POST /api/credits/redeem (شحن كود رصيد Voucher)
    if (pathname === '/api/credits/redeem' && req.method === 'POST') {
      const body = await this.readBody(req);
      const result = this.licensingService.redeemCreditVoucher(body.voucher || '');
      this.sendJson(res, result, result.success ? 200 : 400);
      return;
    }

    // 38. GET /api/business-profile (بيانات النشاط التجاري والتسجيل الضريبي)
    if (pathname === '/api/business-profile' && req.method === 'GET') {
      const profile = this.db.queryOne('SELECT * FROM business_profile LIMIT 1');
      this.sendJson(res, { success: true, profile });
      return;
    }

    // 39. POST /api/business-profile (تحديث بيانات النشاط التجاري)
    if (pathname === '/api/business-profile' && req.method === 'POST') {
      const body = await this.readBody(req);
      this.db.run(
        `UPDATE business_profile
         SET business_name = COALESCE(?, business_name),
             tax_number = COALESCE(?, tax_number),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address),
             receipt_footer = COALESCE(?, receipt_footer),
             currency = COALESCE(?, currency),
             branch_code = COALESCE(?, branch_code),
             pos_terminal_id = COALESCE(?, pos_terminal_id),
             updated_at = datetime('now')
         WHERE id = (SELECT id FROM business_profile LIMIT 1)`,
        [
          body.businessName,
          body.taxNumber,
          body.phone,
          body.address,
          body.receiptFooter,
          body.currency,
          body.branchCode,
          body.posTerminalId,
        ]
      );
      const profile = this.db.queryOne('SELECT * FROM business_profile LIMIT 1');
      this.sendJson(res, { success: true, profile });
      return;
    }

    // 40. GET /api/eta/qr/:invoiceId (جلب كود الـ TLV Base64 للفاتورة الإلكترونية)
    if (pathname.match(/^\/api\/eta\/qr\/[^/]+$/) && req.method === 'GET') {
      const invoiceId = pathname.split('/')[4];
      const invoice = this.invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        this.sendJson(res, { success: false, error: 'Invoice not found' }, 404);
        return;
      }
      const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
      const tlvBase64 = this.etaService.generateTlvBase64({
        sellerName: profile?.business_name || 'كويزلينك ستور للتجارة',
        taxNumber: profile?.tax_number || '000-000-000',
        timestamp: invoice.createdAt,
        totalWithVat: invoice.finalAmount,
        vatAmount: invoice.taxVat14,
      });
      const etaUuid = this.etaService.generateEtaUuid(
        invoice.invoiceNumber,
        profile?.tax_number || '000-000-000',
        invoice.createdAt
      );
      this.sendJson(res, {
        success: true,
        tlvBase64,
        etaUuid,
        invoiceNumber: invoice.invoiceNumber,
      });
      return;
    }

    // 41. POST /api/eta/verify/:invoiceId (التحقق واعتماد الفاتورة ضريبياً)
    if (pathname.match(/^\/api\/eta\/verify\/[^/]+$/) && req.method === 'POST') {
      const invoiceId = pathname.split('/')[4];
      const result = this.etaService.verifyAndSignInvoice(invoiceId);
      this.sendJson(res, { success: true, ...result });
      return;
    }

    // 42. GET /api/update/check (فحص وجود إصدار جديد على GitHub Releases)
    if (pathname === '/api/update/check' && req.method === 'GET') {
      try {
        const updateInfo = await this.updaterService.checkForUpdates();
        this.sendJson(res, { success: true, ...updateInfo });
      } catch (err: any) {
        this.sendJson(res, {
          success: false,
          hasUpdate: false,
          currentVersion: this.updaterService.getCurrentVersion(),
          error: err.message,
        });
      }
      return;
    }

    // 43. GET /api/update/status (حالة التحميل الحالية ونسبة التقدم)
    if (pathname === '/api/update/status' && req.method === 'GET') {
      const status = this.updaterService.getDownloadStatus();
      this.sendJson(res, { success: true, ...status });
      return;
    }

    // 44. POST /api/update/download (بدء تنزيل وتثبيت التحديث تلقائياً)
    if (pathname === '/api/update/download' && req.method === 'POST') {
      try {
        const body = await this.readBody(req);
        // Trigger download asynchronously
        this.updaterService
          .downloadAndApplyUpdate(body.downloadUrl, undefined, async () => {
            await this.stop();
          })
          .catch((e) => console.error('[PosUpdater Error]:', e));

        this.sendJson(res, {
          success: true,
          message: 'بدأ تحميل التحديث في الخلفية وسيتم تثبيته تلقائياً فور الاكتمال.',
        });
      } catch (err: any) {
        this.sendJson(res, { success: false, error: err.message }, 500);
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Endpoint Not Found' }));

  }

  private serveStatic(pathname: string, res: http.ServerResponse): void {
    let filePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const fullPath = path.join(this.uiDir, filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }

  private sendJson(res: http.ServerResponse, data: any, statusCode: number = 200): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }
}
