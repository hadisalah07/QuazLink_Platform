import { PosDatabase } from '../database/connection.js';
import { Invoice, InvoiceItem, InvoiceType, PaymentMethod } from '../database/types.js';
import { InvoiceNumberService } from './invoice-number.js';
import { ProductService } from './product-service.js';
import { ContactService } from './contact-service.js';

export interface CreateInvoiceItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  serialNumber?: string;
}

export interface CreateSaleInvoiceInput {
  contactId?: string;
  paymentMethod?: PaymentMethod;
  discountAmount?: number;
  paidAmount?: number;
  applyVat14?: boolean;
  notes?: string;
  items: CreateInvoiceItemInput[];
  branchCode?: string;
  posTerminalId?: string;
}

export interface ReturnItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  serialNumber?: string;
  isDefective?: boolean; // هل الصنف تالف/معيوب أم سليم ويعاد للرف؟
}

export interface CreateSalesReturnInput {
  originalInvoiceId: string;
  contactId?: string;
  refundAmount?: number;
  notes?: string;
  items: ReturnItemInput[];
  branchCode?: string;
  posTerminalId?: string;
}

export class InvoiceService {
  private db: PosDatabase;
  private numberService: InvoiceNumberService;
  private productService: ProductService;
  private contactService: ContactService;

  constructor(db: PosDatabase) {
    this.db = db;
    this.numberService = new InvoiceNumberService(db);
    this.productService = new ProductService(db);
    this.contactService = new ContactService(db);
  }

  /**
   * 1. إنشاء فاتورة بيع نقدية أو آجلة مع فحص السيريال وتحديث المخزن التراكمي
   */
  public createSaleInvoice(input: CreateSaleInvoiceInput): Invoice {
    if (!input.items || input.items.length === 0) {
      throw new Error('Invoice must contain at least one item.');
    }

    return this.db.transaction(() => {
      const invoiceId = this.db.generateId();
      const invoiceNumber = this.numberService.generateNextInvoiceNumber({
        prefix: 'INV',
        branchCode: input.branchCode || 'B01',
        posTerminalId: input.posTerminalId || 'POS01',
      });

      let subtotal = 0;
      const validatedItems: {
        product: any;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        serialNumber?: string;
      }[] = [];

      for (const item of input.items) {
        const product = this.productService.getProductById(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        // التحقق الإلزامي من السيريال للأجهزة والكمبيوتر
        if (product.hasSerial) {
          if (!item.serialNumber) {
            throw new Error(`Product [${product.name}] requires a Serial Number (hasSerial=true).`);
          }

          const serial = this.productService.getSerialByNumber(item.serialNumber);
          if (!serial) {
            throw new Error(`Serial Number [${item.serialNumber}] not registered in system.`);
          }
          if (serial.status !== 'in_stock') {
            throw new Error(`Serial Number [${item.serialNumber}] is not available (Status: ${serial.status}).`);
          }
          if (serial.productId !== product.id) {
            throw new Error(`Serial Number [${item.serialNumber}] does not belong to product [${product.name}].`);
          }
        }

        const totalPrice = item.quantity * item.unitPrice;
        subtotal += totalPrice;

        validatedItems.push({
          product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice,
          serialNumber: item.serialNumber,
        });
      }

      const discount = input.discountAmount || 0.0;
      const taxableAmount = Math.max(0, subtotal - discount);
      const vat14 = input.applyVat14 ? Number((taxableAmount * 0.14).toFixed(2)) : 0.0;
      const finalAmount = Number((taxableAmount + vat14).toFixed(2));
      const paid = input.paidAmount ?? finalAmount;
      const remaining = Number((finalAmount - paid).toFixed(2));
      const paymentMethod = input.paymentMethod || (remaining > 0 ? 'credit' : 'cash');

      // 1. إدراج الفاتورة
      this.db.run(
        `INSERT INTO invoices (
          id, invoice_number, type, payment_method, contact_id,
          subtotal, discount_amount, tax_vat_14, tax_table,
          final_amount, paid_amount, remaining_amount, notes,
          eta_status, synced_to_cloud
        ) VALUES (?, ?, 'sale', ?, ?, ?, ?, ?, 0.0, ?, ?, ?, ?, 'not_applied', 0)`,
        [
          invoiceId,
          invoiceNumber,
          paymentMethod,
          input.contactId || null,
          subtotal,
          discount,
          vat14,
          finalAmount,
          paid,
          remaining,
          input.notes || null,
        ]
      );

      // 2. إدراج بنود الفاتورة وتحديث السيريالات والمخزون التراكمي
      for (const item of validatedItems) {
        const itemId = this.db.generateId();
        this.db.run(
          `INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price, serial_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, invoiceId, item.product.id, item.quantity, item.unitPrice, item.totalPrice, item.serialNumber || null]
        );

        // تخصيص السيريال وتحويل حالته إلى 'sold'
        if (item.serialNumber) {
          this.db.run(
            `UPDATE product_serials
             SET status = 'sold', invoice_id = ?, sold_at = datetime('now')
             WHERE serial_number = ?`,
            [invoiceId, item.serialNumber]
          );
        }

        // خصم المخزون
        this.productService.updateStockQuantity(item.product.id, -item.quantity);
        const updatedProduct = this.productService.getProductById(item.product.id)!;

        // تسجيل حركة المخزون كـ Append-Only Ledger
        const movementId = this.db.generateId();
        this.db.run(
          `INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_id)
           VALUES (?, ?, 'sale', ?, ?, ?)`,
          [movementId, item.product.id, -item.quantity, updatedProduct.stockQuantity, invoiceId]
        );
      }

      // 3. تحديث حساب العميل وسجل المقبوضات
      if (input.contactId) {
        if (remaining > 0) {
          // إضافة المتبقي كمديونية على العميل
          this.contactService.updateBalance(input.contactId, remaining);
        }

        if (paid > 0) {
          const paymentId = this.db.generateId();
          this.db.run(
            `INSERT INTO payments (id, contact_id, invoice_id, amount, type, method, notes)
             VALUES (?, ?, ?, ?, 'receipt', ?, 'دفعة سداد فاتورة مبيعات')`,
            [paymentId, input.contactId, invoiceId, paid, paymentMethod]
          );
        }
      }

      return this.getInvoiceById(invoiceId)!;
    });
  }

  /**
   * 2. إنشاء مرتجع بيع (Sales Return Flow) مع معالجة السيريال بدقة ومنع الازدواجية
   */
  public createSalesReturn(input: CreateSalesReturnInput): Invoice {
    return this.db.transaction(() => {
      const originalInvoice = this.getInvoiceById(input.originalInvoiceId);
      if (!originalInvoice) {
        throw new Error(`Original sale invoice not found: ${input.originalInvoiceId}`);
      }

      const returnInvoiceId = this.db.generateId();
      const returnNumber = this.numberService.generateNextInvoiceNumber({
        prefix: 'RET',
        branchCode: input.branchCode || 'B01',
        posTerminalId: input.posTerminalId || 'POS01',
      });

      let subtotal = 0;

      for (const item of input.items) {
        subtotal += item.quantity * item.unitPrice;
      }

      const finalAmount = subtotal;
      const refundAmount = input.refundAmount ?? finalAmount;

      // 1. إدراج فاتورة المرتجع
      this.db.run(
        `INSERT INTO invoices (
          id, invoice_number, type, payment_method, contact_id,
          subtotal, discount_amount, tax_vat_14, tax_table,
          final_amount, paid_amount, remaining_amount, notes,
          eta_status, synced_to_cloud
        ) VALUES (?, ?, 'sale_return', 'cash', ?, ?, 0.0, 0.0, 0.0, ?, ?, 0.0, ?, 'not_applied', 0)`,
        [
          returnInvoiceId,
          returnNumber,
          input.contactId || originalInvoice.contactId || null,
          subtotal,
          finalAmount,
          refundAmount,
          input.notes || `مرتجع للفاتورة الأصلية: ${originalInvoice.invoiceNumber}`,
        ]
      );

      // 2. معالجة بنود المرتجع وحالات السيريال
      for (const item of input.items) {
        const itemId = this.db.generateId();
        this.db.run(
          `INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price, serial_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [itemId, returnInvoiceId, item.productId, item.quantity, item.unitPrice, item.quantity * item.unitPrice, item.serialNumber || null]
        );

        // معالجة حالة السيريال المرتجع
        if (item.serialNumber) {
          const serial = this.productService.getSerialByNumber(item.serialNumber);
          if (!serial) {
            throw new Error(`Serial [${item.serialNumber}] not found in database.`);
          }

          if (item.isDefective) {
            // صنف تالف/معيوب: لا يدخل المخزن القابل للبيع
            this.db.run(
              `UPDATE product_serials
               SET status = 'defective', return_invoice_id = ?, returned_at = datetime('now')
               WHERE serial_number = ?`,
              [returnInvoiceId, item.serialNumber]
            );
          } else {
            // صنف سليم: يعاد للمخزن المتاح للبيع
            this.db.run(
              `UPDATE product_serials
               SET status = 'in_stock', invoice_id = NULL, return_invoice_id = ?, returned_at = datetime('now')
               WHERE serial_number = ?`,
              [returnInvoiceId, item.serialNumber]
            );

            // زيادة المخزون للصنف السليم فقط
            this.productService.updateStockQuantity(item.productId, item.quantity);
            const updatedProduct = this.productService.getProductById(item.productId)!;

            // تسجيل حركة المخزون
            const movementId = this.db.generateId();
            this.db.run(
              `INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_id)
               VALUES (?, ?, 'return', ?, ?, ?)`,
              [movementId, item.productId, item.quantity, updatedProduct.stockQuantity, returnInvoiceId]
            );
          }
        } else {
          // صنف بدون سيريال: يعاد للمخزون إذا لم يكن تالفاً
          if (!item.isDefective) {
            this.productService.updateStockQuantity(item.productId, item.quantity);
            const updatedProduct = this.productService.getProductById(item.productId)!;

            const movementId = this.db.generateId();
            this.db.run(
              `INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_id)
               VALUES (?, ?, 'return', ?, ?, ?)`,
              [movementId, item.productId, item.quantity, updatedProduct.stockQuantity, returnInvoiceId]
            );
          }
        }
      }

      // 3. خصم المرتجع من حساب العميل إذا كان مسجلاً
      const contactId = input.contactId || originalInvoice.contactId;
      if (contactId && refundAmount > 0) {
        this.contactService.updateBalance(contactId, -refundAmount);

        const paymentId = this.db.generateId();
        this.db.run(
          `INSERT INTO payments (id, contact_id, invoice_id, amount, type, method, notes)
           VALUES (?, ?, ?, ?, 'payment', 'cash', 'رد قيمة مرتجع مبيعات')`,
          [paymentId, contactId, returnInvoiceId, refundAmount]
        );
      }

      return this.getInvoiceById(returnInvoiceId)!;
    });
  }

  public getInvoiceById(id: string): Invoice | null {
    const row = this.db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapInvoiceRow(row);
  }

  public getInvoiceItems(invoiceId: string): InvoiceItem[] {
    const rows = this.db.queryAll<any>('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    return rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      productId: r.product_id,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      serialNumber: r.serial_number,
    }));
  }

  public getAllInvoices(limit = 100): Invoice[] {
    const rows = this.db.queryAll<any>('SELECT * FROM invoices ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map((r) => this.mapInvoiceRow(r));
  }

  public getAllInvoicesWithDetails(limit = 150): any[] {
    const rows = this.db.queryAll<any>(
      `SELECT i.*, 
              c.name as contact_name, 
              c.phone as contact_phone,
              (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) as item_count
       FROM invoices i
       LEFT JOIN contacts c ON i.contact_id = c.id
       ORDER BY i.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({
      ...this.mapInvoiceRow(r),
      contactName: r.contact_name || (r.contact_id ? 'عميل مسجل' : 'عميل نقدي'),
      contactPhone: r.contact_phone || '',
      itemCount: r.item_count || 0,
    }));
  }

  public getInvoiceFullDetails(id: string): any | null {
    const invoice = this.getInvoiceById(id);
    if (!invoice) return null;
    const items = this.db.queryAll<any>(
      `SELECT ii.*, p.name as product_name, p.barcode as product_barcode, p.has_serial
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = ?`,
      [id]
    );
    let contact = null;
    if (invoice.contactId) {
      contact = this.contactService.getContactById(invoice.contactId);
    }
    return {
      invoice,
      contact,
      items: items.map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name || 'صنف غير محدد',
        productBarcode: i.product_barcode || '',
        hasSerial: Boolean(i.has_serial),
        quantity: i.quantity,
        unitPrice: i.unit_price,
        totalPrice: i.total_price,
        serialNumber: i.serial_number,
      })),
    };
  }

  private mapInvoiceRow(r: any): Invoice {
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      type: r.type as InvoiceType,
      paymentMethod: r.payment_method as PaymentMethod,
      contactId: r.contact_id,
      subtotal: r.subtotal,
      discountAmount: r.discount_amount,
      taxVat14: r.tax_vat_14,
      taxTable: r.tax_table,
      finalAmount: r.final_amount,
      paidAmount: r.paid_amount,
      remainingAmount: r.remaining_amount,
      notes: r.notes,
      etaUuid: r.eta_uuid,
      etaStatus: r.eta_status,
      etaSubmissionTime: r.eta_submission_time,
      whatsappStatus: r.whatsapp_status,
      syncedToCloud: Boolean(r.synced_to_cloud),
      createdAt: r.created_at,
    };
  }
}

