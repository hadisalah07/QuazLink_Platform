import { PosDatabase } from '../database/connection.js';
import { Contact, ContactType } from '../database/types.js';

export interface CreateContactInput {
  type: ContactType;
  name: string;
  phone: string;
  taxId?: string;
  address?: string;
  initialBalance?: number;
}

export class ContactService {
  private db: PosDatabase;

  constructor(db: PosDatabase) {
    this.db = db;
  }

  public createContact(input: CreateContactInput): Contact {
    const id = this.db.generateId();
    const balance = input.initialBalance ?? 0.0;

    this.db.run(
      `INSERT INTO contacts (id, type, name, phone, tax_id, address, balance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.type, input.name, input.phone, input.taxId || null, input.address || null, balance]
    );

    return this.getContactById(id)!;
  }

  public getContactById(id: string): Contact | null {
    const row = this.db.queryOne<any>('SELECT * FROM contacts WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapContactRow(row);
  }

  public getContactByPhone(phone: string): Contact | null {
    const row = this.db.queryOne<any>('SELECT * FROM contacts WHERE phone = ?', [phone]);
    if (!row) return null;
    return this.mapContactRow(row);
  }

  public updateBalance(contactId: string, delta: number): void {
    this.db.run("UPDATE contacts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?", [
      delta,
      contactId,
    ]);
  }

  public getAllContacts(type?: ContactType): Contact[] {
    let sql = 'SELECT * FROM contacts';
    const params: any[] = [];
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    sql += ' ORDER BY name ASC';
    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.mapContactRow(r));
  }

  public recordPayment(input: {
    contactId: string;
    amount: number;
    type: 'receipt' | 'payment'; // receipt = قبض من عميل (يقلل مديونيته), payment = صرف لمورد (يقلل مستحقاته)
    method?: string;
    notes?: string;
    invoiceId?: string;
  }): { paymentId: string; newBalance: number } {
    const contact = this.getContactById(input.contactId);
    if (!contact) throw new Error(`Contact not found: ${input.contactId}`);

    return this.db.transaction(() => {
      const paymentId = this.db.generateId();
      this.db.run(
        `INSERT INTO payments (id, contact_id, invoice_id, amount, type, method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          input.contactId,
          input.invoiceId || null,
          input.amount,
          input.type,
          input.method || 'cash',
          input.notes || null,
        ]
      );

      // قبض من عميل (receipt) يقلل مديونيته (-amount)
      // صرف لمورد (payment) يقلل مستحقاته علينا (-amount)
      const balanceDelta = -input.amount;
      this.updateBalance(input.contactId, balanceDelta);

      const updated = this.getContactById(input.contactId)!;
      return { paymentId, newBalance: updated.balance };
    });
  }

  /**
   * كشف حساب تفصيلي للعميل أو المورد مع الرصيد التراكمي لحظة بلحظة
   */
  public getStatementOfAccount(contactId: string): {
    contact: Contact;
    entries: {
      date: string;
      type: string; // 'فاتورة بيع' | 'سند قبض' | 'فاتورة شراء' | 'سند صرف' | 'مرتجع'
      reference: string;
      debit: number; // مدين (+)
      credit: number; // دائن (-)
      balance: number;
      notes?: string;
    }[];
    totalDebit: number;
    totalCredit: number;
    currentBalance: number;
  } {
    const contact = this.getContactById(contactId);
    if (!contact) throw new Error(`Contact not found: ${contactId}`);

    // جلب الفواتير
    const invoices = this.db.queryAll<any>(
      'SELECT id, invoice_number, type, final_amount, created_at, notes FROM invoices WHERE contact_id = ? ORDER BY created_at ASC',
      [contactId]
    );

    // جلب المدفوعات والسندات
    const payments = this.db.queryAll<any>(
      'SELECT id, amount, type, method, notes, created_at FROM payments WHERE contact_id = ? ORDER BY created_at ASC',
      [contactId]
    );

    // تجميع الحركات وترتيبها زمنياً
    const rawEvents: {
      date: string;
      type: string;
      reference: string;
      debit: number;
      credit: number;
      notes?: string;
    }[] = [];

    for (const inv of invoices) {
      if (inv.type === 'sale') {
        rawEvents.push({
          date: inv.created_at,
          type: 'فاتورة مبيعات',
          reference: inv.invoice_number,
          debit: inv.final_amount,
          credit: 0,
          notes: inv.notes,
        });
      } else if (inv.type === 'purchase') {
        rawEvents.push({
          date: inv.created_at,
          type: 'فاتورة مشتريات',
          reference: inv.invoice_number,
          debit: 0,
          credit: inv.final_amount,
          notes: inv.notes,
        });
      } else if (inv.type === 'sale_return') {
        rawEvents.push({
          date: inv.created_at,
          type: 'مرتجع مبيعات',
          reference: inv.invoice_number,
          debit: 0,
          credit: inv.final_amount,
          notes: inv.notes,
        });
      }
    }

    for (const pay of payments) {
      if (pay.type === 'receipt') {
        rawEvents.push({
          date: pay.created_at,
          type: 'سند قبض نقدي',
          reference: pay.id.substring(0, 8),
          debit: 0,
          credit: pay.amount,
          notes: pay.notes,
        });
      } else if (pay.type === 'payment') {
        rawEvents.push({
          date: pay.created_at,
          type: 'سند صرف نقدي',
          reference: pay.id.substring(0, 8),
          debit: pay.amount,
          credit: 0,
          notes: pay.notes,
        });
      }
    }

    // ترتيب الحركات زمنياً وحساب الرصيد التراكمي
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = rawEvents.map((ev) => {
      totalDebit += ev.debit;
      totalCredit += ev.credit;
      runningBalance += ev.debit - ev.credit;

      return {
        ...ev,
        balance: Number(runningBalance.toFixed(2)),
      };
    });

    return {
      contact,
      entries,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      currentBalance: contact.balance,
    };
  }

  private mapContactRow(r: any): Contact {
    return {
      id: r.id,
      type: r.type as ContactType,
      name: r.name,
      phone: r.phone,
      taxId: r.tax_id,
      address: r.address,
      balance: r.balance,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
