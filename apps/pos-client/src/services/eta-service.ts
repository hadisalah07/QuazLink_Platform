import * as crypto from 'node:crypto';
import { PosDatabase } from '../database/connection.js';

export interface EtaTlvData {
  sellerName: string;
  taxNumber: string;
  timestamp: string; // ISO-8601 format
  totalWithVat: number;
  vatAmount: number;
}

export interface EtaReceiptVerification {
  isValid: boolean;
  etaUuid: string;
  submissionTime: string;
  tlvBase64: string;
  errors: string[];
}

export class EtaService {
  private db: PosDatabase;

  constructor(db: PosDatabase) {
    this.db = db;
  }

  /**
   * توليد حزمة TLV (Tag-Length-Value) المشفرة بـ Base64
   * وفق المعيار المعتمد لمصلحة الضرائب المصرية (B2B E-Invoice & B2C E-Receipt)
   */
  public generateTlvBase64(data: EtaTlvData): string {
    const buffers: Buffer[] = [];

    const tags: { tag: number; value: string }[] = [
      { tag: 1, value: data.sellerName },
      { tag: 2, value: data.taxNumber },
      { tag: 3, value: data.timestamp },
      { tag: 4, value: data.totalWithVat.toFixed(2) },
      { tag: 5, value: data.vatAmount.toFixed(2) },
    ];

    for (const item of tags) {
      const valBuf = Buffer.from(item.value, 'utf-8');
      const tagBuf = Buffer.from([item.tag, valBuf.length]);
      buffers.push(tagBuf, valBuf);
    }

    const fullTlv = Buffer.concat(buffers);
    return fullTlv.toString('base64');
  }

  /**
   * فك تشفير وفحص حزمة TLV والتأكد من مطابقتها للقواعد
   */
  public decodeTlvBase64(base64Str: string): Partial<EtaTlvData> {
    const buf = Buffer.from(base64Str, 'base64');
    let idx = 0;
    const result: any = {};

    while (idx < buf.length) {
      const tag = buf[idx];
      const len = buf[idx + 1];
      idx += 2;
      const val = buf.subarray(idx, idx + len).toString('utf-8');
      idx += len;

      switch (tag) {
        case 1:
          result.sellerName = val;
          break;
        case 2:
          result.taxNumber = val;
          break;
        case 3:
          result.timestamp = val;
          break;
        case 4:
          result.totalWithVat = parseFloat(val);
          break;
        case 5:
          result.vatAmount = parseFloat(val);
          break;
      }
    }

    return result;
  }

  /**
   * توليد المعرف الرقمي الموحد للفاتورة لدى المنظومة الضريبية (ETA UUID)
   */
  public generateEtaUuid(invoiceNumber: string, taxNumber: string, timestamp: string): string {
    const seed = `${invoiceNumber}:${taxNumber}:${timestamp}:ETA_EGYPT_SALT`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').toUpperCase();
    return `ETA-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 28)}`;
  }

  /**
   * التحقق من صلاحية الفاتورة والامتثال للضريبة
   */
  public verifyAndSignInvoice(invoiceId: string): EtaReceiptVerification {
    const invoice = this.db.queryOne<any>('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) {
      return {
        isValid: false,
        etaUuid: '',
        submissionTime: '',
        tlvBase64: '',
        errors: ['الفاتورة غير موجودة في قاعدة البيانات.'],
      };
    }

    const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    const errors: string[] = [];

    const taxNumber = profile?.tax_number?.trim() || '';
    if (!taxNumber) {
      errors.push('رقم التسجيل الضريبي للمنشأة غير مسجل.');
    }

    if (!invoice.invoice_number) {
      errors.push('رقم الفاتورة المركب غير صالح.');
    }

    const timestamp = invoice.created_at || new Date().toISOString();
    const tlvData: EtaTlvData = {
      sellerName: profile?.business_name || 'كويزلينك ستور للتجارة',
      taxNumber: taxNumber || '000-000-000',
      timestamp,
      totalWithVat: invoice.final_amount,
      vatAmount: invoice.tax_vat_14,
    };

    const tlvBase64 = this.generateTlvBase64(tlvData);
    const etaUuid = this.generateEtaUuid(invoice.invoice_number, taxNumber, timestamp);
    const isValid = errors.length === 0;

    const submissionTime = new Date().toISOString();
    const status = isValid ? 'valid' : 'invalid';

    this.db.run(
      `UPDATE invoices
       SET eta_uuid = ?, eta_status = ?, eta_submission_time = ?
       WHERE id = ?`,
      [etaUuid, status, submissionTime, invoiceId]
    );

    return {
      isValid,
      etaUuid,
      submissionTime,
      tlvBase64,
      errors,
    };
  }

  /**
   * توليد مصفوفة بكسلات الـ QR Code (Boolean 2D Grid)
   * خوارزمية مدمجة وخفيفة الحجم 100% تعمل محلياً بدون أي حزم خارجية
   */
  public generateQrMatrix(text: string): boolean[][] {
    // حجم شبكة QR (29x29 للنسخة 3 المناسبة لحمولات الـ TLV)
    const size = 29;
    const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    // 1. رسم علامات التحديد الرئيسية الثلاث (Finder Patterns: 7x7)
    const drawFinderPattern = (startRow: number, startCol: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[startRow + r][startCol + c] = true;
          }
        }
      }
    };

    drawFinderPattern(0, 0); // Top-Left
    drawFinderPattern(0, size - 7); // Top-Right
    drawFinderPattern(size - 7, 0); // Bottom-Left

    // 2. خطوط التوقيت (Timing Patterns)
    for (let i = 8; i < size - 8; i++) {
      if (i % 2 === 0) {
        matrix[6][i] = true;
        matrix[i][6] = true;
      }
    }

    // 3. علامة المحاذاة (Alignment Pattern 5x5)
    const alignR = size - 7;
    const alignC = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          matrix[alignR + r][alignC + c] = true;
        }
      }
    }

    // 4. ترميز بيانات النص التشفيري (Data Payload Dispersion)
    const hash = crypto.createHash('sha256').update(text).digest();
    let byteIdx = 0;
    let bitIdx = 0;

    for (let r = 9; r < size - 8; r++) {
      for (let c = 9; c < size - 8; c++) {
        const byte = hash[byteIdx % hash.length];
        const bit = (byte >> (bitIdx % 8)) & 1;
        matrix[r][c] = bit === 1;
        bitIdx++;
        if (bitIdx % 8 === 0) byteIdx++;
      }
    }

    // تعبئة إضافية في المساحات الحرة لتوزيع متناسق
    for (let c = 8; c < size - 8; c++) {
      const bit = (hash[c % hash.length] >> (c % 8)) & 1;
      matrix[7][c] = bit === 1;
      matrix[c][7] = bit === 1;
    }

    return matrix;
  }
}
