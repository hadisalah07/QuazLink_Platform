-- QuazLink Retail POS & ERP - SQLite Database Schema (Phase 1)
-- Optimized for Local-First Offline Operation & Seamless Cloud Synchronization

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- 1. ملف النشاط التجاري والترخيص
CREATE TABLE IF NOT EXISTS business_profile (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    branch_code TEXT NOT NULL DEFAULT 'B01',
    pos_terminal_id TEXT NOT NULL DEFAULT 'POS01',
    phone TEXT NOT NULL,
    address TEXT,
    tax_number TEXT,
    receipt_footer TEXT,
    currency TEXT NOT NULL DEFAULT 'EGP',
    license_key TEXT NOT NULL,
    license_type TEXT NOT NULL DEFAULT 'saas_subscription',
    hardware_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. تصنيفات المنتجات
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. المنتجات والمخزون
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    buy_price REAL NOT NULL DEFAULT 0.0,
    sell_price_retail REAL NOT NULL,
    sell_price_wholesale REAL,
    stock_quantity REAL NOT NULL DEFAULT 0.0,
    min_stock_alert REAL NOT NULL DEFAULT 3.0,
    unit TEXT NOT NULL DEFAULT 'قطعة',
    image_url TEXT,
    has_serial INTEGER NOT NULL DEFAULT 0, -- 1 = إلزامي إدخال السيريال للأجهزة
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 4. الأرقام التسلسلية للأجهزة والإلكترونيات (Serials / IMEI) وتتبع المرتجعات
CREATE TABLE IF NOT EXISTS product_serials (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'in_stock', -- 'in_stock', 'sold', 'returned', 'defective'
    invoice_id TEXT,
    return_invoice_id TEXT,
    warranty_months INTEGER NOT NULL DEFAULT 12,
    sold_at TEXT,
    returned_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_serials_product_status ON product_serials(product_id, status);
CREATE INDEX IF NOT EXISTS idx_serials_number ON product_serials(serial_number);

-- 5. جهات الاتصال (العملاء والموردين)
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'customer' | 'supplier'
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    tax_id TEXT,
    address TEXT,
    balance REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

-- 6. الفواتير
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE, -- Composite: INV-B01-POS01-20261005-0001
    type TEXT NOT NULL, -- 'sale', 'purchase', 'sale_return', 'purchase_return'
    payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'credit', 'visa', 'partial'
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    subtotal REAL NOT NULL,
    discount_amount REAL NOT NULL DEFAULT 0.0,
    tax_vat_14 REAL NOT NULL DEFAULT 0.0,
    tax_table REAL NOT NULL DEFAULT 0.0,
    final_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0.0,
    remaining_amount REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    -- حقول الجاهزية للفاتورة والإيصال الإلكتروني ETA
    eta_uuid TEXT,
    eta_status TEXT NOT NULL DEFAULT 'not_applied', -- 'not_applied', 'pending', 'valid', 'invalid'
    eta_submission_time TEXT,
    -- حقول الواتساب والمزامنة
    whatsapp_status TEXT DEFAULT 'pending',
    synced_to_cloud INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);

-- 7. بنود الفاتورة
CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    serial_number TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);

-- 8. سجل المدفوعات والتحصيل (Append-Only Financial Ledger)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id),
    invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL, -- 'receipt' (قبض) | 'payment' (صرف)
    method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);

-- 9. سجل حركة المخزون (Append-Only Stock Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    type TEXT NOT NULL, -- 'sale', 'purchase', 'adjustment', 'return'
    quantity REAL NOT NULL, -- (+ أو -)
    balance_after REAL NOT NULL,
    reference_id TEXT, -- invoiceId
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

-- 10. عداد الفواتير الذري المحلي (Atomic Sequence Counters)
CREATE TABLE IF NOT EXISTS invoice_counters (
    counter_key TEXT PRIMARY KEY, -- مثال: "B01_POS01_20261005"
    last_seq INTEGER NOT NULL DEFAULT 0
);

-- 11. إدارة الورديات وإغلاق الخزينة (Shifts & Cash Drawer Management)
CREATE TABLE IF NOT EXISTS cash_shifts (
    id TEXT PRIMARY KEY,
    shift_number INTEGER NOT NULL,
    cashier_name TEXT NOT NULL DEFAULT 'الكاشير الرئيسي',
    status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
    opening_amount REAL NOT NULL DEFAULT 0.0,
    closing_amount REAL,
    expected_amount REAL,
    difference_amount REAL, -- الفرق: 0 مظبوط، موجب زيادة، سالب عجز
    total_sales_cash REAL NOT NULL DEFAULT 0.0,
    total_returns_cash REAL NOT NULL DEFAULT 0.0,
    total_payments_received REAL NOT NULL DEFAULT 0.0,
    total_expenses REAL NOT NULL DEFAULT 0.0,
    notes TEXT,
    opened_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shifts_status ON cash_shifts(status);

-- 12. المصروفات النثرية أثناء الوردية (Petty Cash Expenses)
CREATE TABLE IF NOT EXISTS petty_expenses (
    id TEXT PRIMARY KEY,
    shift_id TEXT REFERENCES cash_shifts(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'نثريات',
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    recorded_by TEXT DEFAULT 'الكاشير',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_petty_expenses_shift ON petty_expenses(shift_id);

-- 13. إعدادات النظام والموديولات المفعلة (Modular System Settings)
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 14. سجل عمليات المزامنة السحابية (Cloud Synchronization Audit Log)
CREATE TABLE IF NOT EXISTS cloud_sync_log (
    id TEXT PRIMARY KEY,
    sync_type TEXT NOT NULL DEFAULT 'full', -- 'push', 'pull', 'full'
    status TEXT NOT NULL, -- 'success', 'failed', 'partial'
    pushed_count INTEGER NOT NULL DEFAULT 0,
    pulled_count INTEGER NOT NULL DEFAULT 0,
    details TEXT,
    error_message TEXT,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_created ON cloud_sync_log(created_at);

-- 15. النسخ الاحتياطية للنظام محلياً وسحابياً (Local & Cloud System Backups)
CREATE TABLE IF NOT EXISTS system_backups (
    id TEXT PRIMARY KEY,
    backup_type TEXT NOT NULL DEFAULT 'local', -- 'local', 'cloud', 'hybrid'
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    checksum_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_backups_created ON system_backups(created_at);

-- 16. محفظة رصيد الكريديت للذكاء الاصطناعي والواتساب (Lifetime / SaaS Credit Wallet)
CREATE TABLE IF NOT EXISTS credit_wallet (
    credit_type TEXT PRIMARY KEY, -- 'ai_tokens', 'whatsapp_messages'
    balance INTEGER NOT NULL DEFAULT 100,
    total_consumed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);


