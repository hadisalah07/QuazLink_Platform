/**
 * QuazLink Retail POS & ERP - Core Database Types (Phase 1)
 */

export type LicenseType = 'saas_subscription' | 'lifetime_offline';

export type ProductSerialStatus = 'in_stock' | 'sold' | 'returned' | 'defective';

export type ContactType = 'customer' | 'supplier';

export type InvoiceType = 'sale' | 'purchase' | 'sale_return' | 'purchase_return';

export type PaymentMethod = 'cash' | 'credit' | 'visa' | 'partial';

export type PaymentType = 'receipt' | 'payment';

export type StockMovementType = 'sale' | 'purchase' | 'adjustment' | 'return';

export type EtaStatus = 'not_applied' | 'pending' | 'valid' | 'invalid';

export type WhatsAppStatus = 'pending' | 'sent' | 'failed' | 'whatsappless';

export interface BusinessProfile {
  id: string; // UUID v4 / ULID
  businessName: string;
  branchCode: string; // e.g. "B01"
  posTerminalId: string; // e.g. "POS01"
  phone: string;
  address?: string | null;
  taxNumber?: string | null; // رقم التسجيل الضريبي
  receiptFooter?: string | null;
  currency: string; // default "EGP"
  licenseKey: string;
  licenseType: LicenseType;
  hardwareId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  barcode?: string | null;
  sku?: string | null;
  name: string;
  categoryId?: string | null;
  buyPrice: number;
  sellPriceRetail: number;
  sellPriceWholesale?: number | null;
  stockQuantity: number;
  minStockAlert: number;
  unit: string;
  imageUrl?: string | null;
  hasSerial: boolean; // تفعيل إلزامية السيريال للأجهزة والكمبيوتر
  createdAt: string;
  updatedAt: string;
}

export interface ProductSerial {
  id: string;
  productId: string;
  serialNumber: string;
  status: ProductSerialStatus;
  invoiceId?: string | null; // فاتورة البيع
  returnInvoiceId?: string | null; // فاتورة المرتجع
  warrantyMonths: number;
  soldAt?: string | null;
  returnedAt?: string | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  type: ContactType;
  name: string;
  phone: string;
  taxId?: string | null; // للعملاء التجاريين B2B
  address?: string | null;
  balance: number; // دائن / مدين
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // Composite: INV-B01-POS01-20261005-0001
  type: InvoiceType;
  paymentMethod: PaymentMethod;
  contactId?: string | null;
  subtotal: number;
  discountAmount: number;
  taxVat14: number; // ضريبة القيمة المضافة 14%
  taxTable: number; // ضريبة الجدول
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string | null;
  // ETA Compliance fields
  etaUuid?: string | null;
  etaStatus: EtaStatus;
  etaSubmissionTime?: string | null;
  // Cloud & WhatsApp
  whatsappStatus?: WhatsAppStatus | null;
  syncedToCloud: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serialNumber?: string | null;
}

export interface Payment {
  id: string;
  contactId: string;
  invoiceId?: string | null;
  amount: number;
  type: PaymentType;
  method: string;
  notes?: string | null;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number; // + or -
  balanceAfter: number;
  referenceId?: string | null; // invoiceId
  createdAt: string;
}
