import { PosDatabase } from '../database/connection.js';
import { Invoice, InvoiceItem } from '../database/types.js';
import { InvoiceNumberService } from './invoice-number.js';
import { ProductService } from './product-service.js';
import { ContactService } from './contact-service.js';

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitPrice: number; // سعر الشراء للوحدة
  serialNumbers?: string[]; // سيريالات في حال كان الصنف به سيريال
}

export interface CreatePurchaseInvoiceInput {
  supplierId: string;
  items: PurchaseItemInput[];
  paidAmount?: number;
  notes?: string;
  branchCode?: string;
  posTerminalId?: string;
}

export class PurchaseService {
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
   * تسجيل فاتورة شراء بضاعة من مورد وتحديث المخزن والسيريالات ورصيد المورد
   */
  public createPurchaseInvoice(input: CreatePurchaseInvoiceInput): Invoice {
    if (!input.items || input.items.length === 0) {
      throw new Error('Purchase invoice must contain at least one item.');
    }

    const supplier = this.contactService.getContactById(input.supplierId);
    if (!supplier) {
      throw new Error(`Supplier not found: ${input.supplierId}`);
    }

    return this.db.transaction(() => {
      const invoiceId = this.db.generateId();
      const invoiceNumber = this.numberService.generateNextInvoiceNumber({
        prefix: 'PUR',
        branchCode: input.branchCode || 'B01',
        posTerminalId: input.posTerminalId || 'POS01',
      });

      let subtotal = 0;
      const validatedItems: {
        product: any;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        serialNumbers?: string[];
      }[] = [];

      for (const item of input.items) {
        const product = this.productService.getProductById(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        if (product.hasSerial && item.serialNumbers && item.serialNumbers.length !== item.quantity) {
          throw new Error(
            `Serial count (${item.serialNumbers.length}) does not match quantity (${item.quantity}) for product [${product.name}].`
          );
        }

        const totalPrice = item.quantity * item.unitPrice;
        subtotal += totalPrice;

        validatedItems.push({
          product,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice,
          serialNumbers: item.serialNumbers,
        });
      }

      const finalAmount = subtotal;
      const paid = input.paidAmount ?? finalAmount;
      const remaining = Number((finalAmount - paid).toFixed(2));
      const paymentMethod = remaining > 0 ? 'credit' : 'cash';

      // 1. إدراج فاتورة الشراء
      this.db.run(
        `INSERT INTO invoices (
          id, invoice_number, type, payment_method, contact_id,
          subtotal, discount_amount, tax_vat_14, tax_table,
          final_amount, paid_amount, remaining_amount, notes,
          eta_status, synced_to_cloud
        ) VALUES (?, ?, 'purchase', ?, ?, ?, 0.0, 0.0, 0.0, ?, ?, ?, ?, 'not_applied', 0)`,
        [
          invoiceId,
          invoiceNumber,
          paymentMethod,
          input.supplierId,
          subtotal,
          finalAmount,
          paid,
          remaining,
          input.notes || null,
        ]
      );

      // 2. إدراج البنود وزيادة المخزن وإضافة السيريالات الواردة
      for (const item of validatedItems) {
        const itemId = this.db.generateId();
        this.db.run(
          `INSERT INTO invoice_items (id, invoice_id, product_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [itemId, invoiceId, item.product.id, item.quantity, item.unitPrice, item.totalPrice]
        );

        // تحديث سعر الشراء للصنف إذا تغير
        this.db.run('UPDATE products SET buy_price = ?, updated_at = datetime(\'now\') WHERE id = ?', [
          item.unitPrice,
          item.product.id,
        ]);

        // إضافة السيريالات الواردة
        if (item.product.hasSerial && item.serialNumbers) {
          for (const sn of item.serialNumbers) {
            const serialId = this.db.generateId();
            this.db.run(
              `INSERT INTO product_serials (id, product_id, serial_number, status, warranty_months)
               VALUES (?, ?, ?, 'in_stock', 12)`,
              [serialId, item.product.id, sn.trim()]
            );
          }
        }

        // زيادة رصيد المخزن
        this.productService.updateStockQuantity(item.product.id, item.quantity);
        const updatedProduct = this.productService.getProductById(item.product.id)!;

        // تسجيل حركة المخزون كـ Append-Only Ledger
        const movementId = this.db.generateId();
        this.db.run(
          `INSERT INTO stock_movements (id, product_id, type, quantity, balance_after, reference_id)
           VALUES (?, ?, 'purchase', ?, ?, ?)`,
          [movementId, item.product.id, item.quantity, updatedProduct.stockQuantity, invoiceId]
        );
      }

      // 3. تحديث حساب المورد وسجل المدفوعات
      if (remaining > 0) {
        // المتبقي دين للمورد علينا (رصيد دائن للمورد)
        this.contactService.updateBalance(input.supplierId, remaining);
      }

      if (paid > 0) {
        const paymentId = this.db.generateId();
        this.db.run(
          `INSERT INTO payments (id, contact_id, invoice_id, amount, type, method, notes)
           VALUES (?, ?, ?, ?, 'payment', 'cash', 'دفعة سداد فاتورة شراء بضاعة')`,
          [paymentId, input.supplierId, invoiceId, paid]
        );
      }

      const row = this.db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
      return {
        id: row.id,
        invoiceNumber: row.invoice_number,
        type: row.type,
        paymentMethod: row.payment_method,
        contactId: row.contact_id,
        subtotal: row.subtotal,
        discountAmount: row.discount_amount,
        taxVat14: row.tax_vat_14,
        taxTable: row.tax_table,
        finalAmount: row.final_amount,
        paidAmount: row.paid_amount,
        remainingAmount: row.remaining_amount,
        notes: row.notes,
        etaUuid: row.eta_uuid,
        etaStatus: row.eta_status,
        etaSubmissionTime: row.eta_submission_time,
        whatsappStatus: row.whatsapp_status,
        syncedToCloud: Boolean(row.synced_to_cloud),
        createdAt: row.created_at,
      };
    });
  }

  public getAllPurchases(limit = 100): Invoice[] {
    const rows = this.db.queryAll<any>(
      "SELECT * FROM invoices WHERE type = 'purchase' ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      type: r.type,
      paymentMethod: r.payment_method,
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
    }));
  }
}
