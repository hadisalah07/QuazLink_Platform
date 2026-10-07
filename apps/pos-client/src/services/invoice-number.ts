import { PosDatabase } from '../database/connection.js';

export interface InvoiceNumberOptions {
  prefix?: string; // Default: 'INV'
  branchCode?: string; // Default: 'B01'
  posTerminalId?: string; // Default: 'POS01'
  date?: Date; // Default: current local date
}

export class InvoiceNumberService {
  private db: PosDatabase;

  constructor(db: PosDatabase) {
    this.db = db;
  }

  /**
   * Generates a collision-proof composite invoice number:
   * Format: INV-{BranchCode}-{PosID}-{YYYYMMDD}-{Sequence}
   * Example: INV-B01-POS01-20261005-0001
   */
  public generateNextInvoiceNumber(options: InvoiceNumberOptions = {}): string {
    const prefix = options.prefix || 'INV';
    const branch = options.branchCode || 'B01';
    const pos = options.posTerminalId || 'POS01';
    const now = options.date || new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const counterKey = `${branch}_${pos}_${dateStr}`;

    return this.db.transaction(() => {
      // Upsert counter atomically
      this.db.run(
        `INSERT INTO invoice_counters (counter_key, last_seq)
         VALUES (?, 1)
         ON CONFLICT(counter_key) DO UPDATE SET last_seq = last_seq + 1`,
        [counterKey]
      );

      const row = this.db.queryOne<{ last_seq: number }>(
        'SELECT last_seq FROM invoice_counters WHERE counter_key = ?',
        [counterKey]
      );

      const seq = row?.last_seq || 1;
      const formattedSeq = String(seq).padStart(4, '0');

      return `${prefix}-${branch}-${pos}-${dateStr}-${formattedSeq}`;
    });
  }
}
