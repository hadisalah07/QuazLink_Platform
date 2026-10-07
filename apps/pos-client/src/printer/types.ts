/**
 * QuazLink Thermal Printing & Hardware Types
 */

export type PrinterWidth = '80mm' | '58mm';

export interface PrinterConfig {
  width: PrinterWidth; // '80mm' = 576 dots, '58mm' = 384 dots
  dotWidth: number; // 576 or 384
  type: 'virtual' | 'network' | 'usb';
  networkHost?: string;
  networkPort?: number;
  openCashDrawer?: boolean; // إرسال نبضة فتح درج النقدية
  cutPaper?: boolean; // قطع الورق بعد الطباعة
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serialNumber?: string | null;
}

export interface ReceiptData {
  storeName: string;
  storePhone: string;
  storeAddress?: string;
  taxNumber?: string;
  invoiceNumber: string;
  dateStr: string;
  cashierName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  taxVat14: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency?: string;
  qrPayload?: string;
  footerText?: string;
}

export interface RasterResult {
  width: number;
  height: number;
  rasterBytes: Buffer;
  escposCommands: Buffer;
  durationMs: number;
}
