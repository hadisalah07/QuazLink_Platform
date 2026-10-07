import { PosDatabase } from '../database/connection.js';

export interface ShiftSummary {
  shiftId: string;
  shiftNumber: number;
  cashierName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  totalSalesCash: number;
  totalSalesInvoicesCount: number;
  totalReturnsCash: number;
  totalReturnsCount: number;
  totalPaymentsReceivedCash: number;
  totalExpenses: number;
  expectedDrawerAmount: number;
  actualCountedAmount?: number;
  differenceAmount?: number;
  expenses: Array<{ id: string; category: string; amount: number; reason: string; createdAt: string }>;
}

export class ShiftService {
  private db: PosDatabase;

  constructor(db: PosDatabase) {
    this.db = db;
  }

  /**
   * جلب الوردية المفتوحة حالياً (إن وجدت)
   */
  public getCurrentShift(): any | null {
    const shift = this.db.queryOne<any>(
      `SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY shift_number DESC LIMIT 1`
    );
    return shift || null;
  }

  /**
   * فتح وردية كاشير جديدة
   */
  public openShift(input: { openingAmount: number; cashierName?: string; notes?: string }): any {
    const current = this.getCurrentShift();
    if (current) {
      throw new Error(`توجد وردية مفتوحة بالفعل برقم (#${current.shift_number}). يجب إغلاقها أولاً قبل فتح وردية جديدة.`);
    }

    const last = this.db.queryOne<any>('SELECT MAX(shift_number) as max_num FROM cash_shifts');
    const nextNum = (last?.max_num || 0) + 1;
    const shiftId = this.db.generateId();

    this.db.run(
      `INSERT INTO cash_shifts (
        id, shift_number, cashier_name, status, opening_amount, notes, opened_at
      ) VALUES (?, ?, ?, 'open', ?, ?, datetime('now'))`,
      [
        shiftId,
        nextNum,
        input.cashierName || 'الكاشير الرئيسي',
        input.openingAmount || 0,
        input.notes || null,
      ]
    );

    return this.getShiftById(shiftId);
  }

  public getShiftById(id: string): any | null {
    return this.db.queryOne<any>('SELECT * FROM cash_shifts WHERE id = ?', [id]);
  }

  /**
   * حساب ملخص الوردية الحية (Live Drawer Cash Reconciliation)
   */
  public getShiftSummary(shiftId: string): ShiftSummary {
    const shift = this.getShiftById(shiftId);
    if (!shift) {
      throw new Error(`Shift not found: ${shiftId}`);
    }

    const startTime = shift.opened_at;
    const endTime = shift.closed_at ? shift.closed_at : "datetime('now')";

    // 1. مبيعات الكاش النقدية خلال الوردية
    const salesCashRow = this.db.queryOne<any>(
      `SELECT COALESCE(SUM(paid_amount), 0) as total_cash, COUNT(*) as count
       FROM invoices
       WHERE type = 'sale' 
         AND payment_method = 'cash'
         AND datetime(created_at) >= datetime(?)
         ${shift.closed_at ? 'AND datetime(created_at) <= datetime(?)' : ''}`,
      shift.closed_at ? [startTime, shift.closed_at] : [startTime]
    );

    // 2. المرتجعات النقدية المستردة من الدرج للزبائن خلال الوردية
    const returnsCashRow = this.db.queryOne<any>(
      `SELECT COALESCE(SUM(paid_amount), 0) as total_cash, COUNT(*) as count
       FROM invoices
       WHERE type = 'sale_return'
         AND datetime(created_at) >= datetime(?)
         ${shift.closed_at ? 'AND datetime(created_at) <= datetime(?)' : ''}`,
      shift.closed_at ? [startTime, shift.closed_at] : [startTime]
    );

    // 3. سندات القبض النقدية المحصلة من ديون العملاء
    const paymentsRow = this.db.queryOne<any>(
      `SELECT COALESCE(SUM(amount), 0) as total_cash
       FROM payments
       WHERE type = 'receipt'
         AND method = 'cash'
         AND datetime(created_at) >= datetime(?)
         ${shift.closed_at ? 'AND datetime(created_at) <= datetime(?)' : ''}`,
      shift.closed_at ? [startTime, shift.closed_at] : [startTime]
    );

    // 4. المصروفات النثرية المسجلة أثناء الوردية
    const expenses = this.db.queryAll<any>(
      `SELECT id, category, amount, reason, created_at
       FROM petty_expenses
       WHERE shift_id = ?
       ORDER BY created_at DESC`,
      [shiftId]
    );
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalSalesCash = Number(salesCashRow?.total_cash || 0);
    const totalReturnsCash = Number(returnsCashRow?.total_cash || 0);
    const totalPaymentsReceivedCash = Number(paymentsRow?.total_cash || 0);

    const expectedDrawerAmount = Number(
      (shift.opening_amount + totalSalesCash + totalPaymentsReceivedCash - totalReturnsCash - totalExpenses).toFixed(2)
    );

    return {
      shiftId: shift.id,
      shiftNumber: shift.shift_number,
      cashierName: shift.cashier_name,
      status: shift.status,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      openingAmount: shift.opening_amount,
      totalSalesCash,
      totalSalesInvoicesCount: Number(salesCashRow?.count || 0),
      totalReturnsCash,
      totalReturnsCount: Number(returnsCashRow?.count || 0),
      totalPaymentsReceivedCash,
      totalExpenses,
      expectedDrawerAmount,
      actualCountedAmount: shift.closing_amount ?? undefined,
      differenceAmount: shift.difference_amount ?? undefined,
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        amount: e.amount,
        reason: e.reason,
        createdAt: e.created_at,
      })),
    };
  }

  /**
   * تسجيل مصروف نثري من الدرج (بوفيه، إكرامية، صيانة...)
   */
  public recordPettyExpense(input: {
    shiftId?: string;
    category: string;
    amount: number;
    reason: string;
    recordedBy?: string;
  }): any {
    const activeShift = input.shiftId ? this.getShiftById(input.shiftId) : this.getCurrentShift();
    const expenseId = this.db.generateId();

    this.db.run(
      `INSERT INTO petty_expenses (id, shift_id, category, amount, reason, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        expenseId,
        activeShift ? activeShift.id : null,
        input.category || 'نثريات',
        Math.abs(input.amount),
        input.reason,
        input.recordedBy || 'الكاشير',
      ]
    );

    return this.db.queryOne<any>('SELECT * FROM petty_expenses WHERE id = ?', [expenseId]);
  }

  /**
   * تقفيل الوردية والخزينة وإصدار تقرير Z-Report
   */
  public closeShift(input: { shiftId: string; actualCountedAmount: number; notes?: string }): {
    shift: any;
    summary: ShiftSummary;
    zReportText: string;
  } {
    const shift = this.getShiftById(input.shiftId);
    if (!shift) throw new Error(`Shift not found: ${input.shiftId}`);
    if (shift.status === 'closed') throw new Error('هذه الوردية مغلقة بالفعل مسبقاً.');

    const summary = this.getShiftSummary(input.shiftId);
    const actual = Number(input.actualCountedAmount) || 0;
    const difference = Number((actual - summary.expectedDrawerAmount).toFixed(2));

    this.db.run(
      `UPDATE cash_shifts
       SET status = 'closed',
           closing_amount = ?,
           expected_amount = ?,
           difference_amount = ?,
           total_sales_cash = ?,
           total_returns_cash = ?,
           total_payments_received = ?,
           total_expenses = ?,
           notes = ?,
           closed_at = datetime('now')
       WHERE id = ?`,
      [
        actual,
        summary.expectedDrawerAmount,
        difference,
        summary.totalSalesCash,
        summary.totalReturnsCash,
        summary.totalPaymentsReceivedCash,
        summary.totalExpenses,
        input.notes || shift.notes,
        shift.id,
      ]
    );

    const updatedShift = this.getShiftById(shift.id);
    const updatedSummary = this.getShiftSummary(shift.id);
    const zReportText = this.formatZReportText(updatedShift, updatedSummary);

    return {
      shift: updatedShift,
      summary: updatedSummary,
      zReportText,
    };
  }

  public getAllShifts(limit = 40): any[] {
    return this.db.queryAll<any>(
      `SELECT * FROM cash_shifts ORDER BY shift_number DESC LIMIT ?`,
      [limit]
    );
  }

  /**
   * توليد نص الإيصال الحراري لتقرير Z-Report
   */
  public formatZReportText(shift: any, summary: ShiftSummary, storeName = 'QUAZLINK COMPUTERS & ELECTRONICS'): string {
    const diffLabel = (summary.differenceAmount || 0) === 0
      ? '0.00 EGP (مطابق تماماً ✓)'
      : (summary.differenceAmount || 0) > 0
        ? `+${(summary.differenceAmount || 0).toFixed(2)} EGP (زيادة بالدرج)`
        : `${(summary.differenceAmount || 0).toFixed(2)} EGP (عجز بالدرج ⚠️)`;

    let expensesTxt = '';
    if (summary.expenses.length > 0) {
      expensesTxt = '----------------------------------------\nالمصروفات النثرية المسجلة بالوردية:\n';
      summary.expenses.forEach((e) => {
        expensesTxt += `• ${e.category}: ${e.reason} (-${e.amount.toFixed(2)} EGP)\n`;
      });
    }

    return `
========================================
             Z - R E P O R T
       تقرير إغلاق الوردية والخزينة
         ${storeName}
========================================
رقم الوردية:      #${shift.shift_number}
اسم الكاشير:      ${shift.cashier_name}
حالة الوردية:     مغلقة ومرحلة (CLOSED)
تاريخ الفتح:      ${new Date(shift.opened_at).toLocaleString('ar-EG')}
تاريخ الإغلاق:    ${shift.closed_at ? new Date(shift.closed_at).toLocaleString('ar-EG') : '-'}
----------------------------------------
العهدة النقدية الافتتاحية:  +${shift.opening_amount.toFixed(2)} EGP
مبيعات الكاش (${summary.totalSalesInvoicesCount} فاتورة): +${summary.totalSalesCash.toFixed(2)} EGP
مقبوضات سداد الديون:      +${summary.totalPaymentsReceivedCash.toFixed(2)} EGP
مرتجعات البيع النقدية:   -${summary.totalReturnsCash.toFixed(2)} EGP
المصروفات النثرية:        -${summary.totalExpenses.toFixed(2)} EGP
========================================
الرصيد الدفتري المتوقع:   ${summary.expectedDrawerAmount.toFixed(2)} EGP
المبلغ الفعلي المحسوب:   ${(summary.actualCountedAmount || 0).toFixed(2)} EGP
----------------------------------------
الفارق (عجز / زيادة):    ${diffLabel}
========================================
${expensesTxt}----------------------------------------
تم إغلاق الوردية واعتماد الجرد اليومي
QuazLink Retail OS Engine
========================================
`;
  }
}
