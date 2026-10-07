import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { PosDatabase } from '../database/connection.js';

export interface CreditWalletInfo {
  aiTokens: number;
  whatsappMessages: number;
  totalAiConsumed: number;
  totalWhatsappConsumed: number;
}

export interface LicenseInfo {
  status: 'active' | 'expired' | 'invalid_hardware' | 'trial';
  tier: 'trial' | 'lifetime' | 'saas_subscription';
  hardwareId: string;
  licenseKey: string;
  businessName: string;
  branchCode: string;
  activatedAt: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  modules: {
    core_pos: boolean;
    shifts_zreport: boolean;
    serial_warranty: boolean;
    ai_marketing: boolean;
    whatsapp_receipts: boolean;
    crm_ledgers: boolean;
    cloud_sync: boolean;
  };
  credits: CreditWalletInfo;
}

export class LicensingService {
  private db: PosDatabase;
  private cachedHardwareId: string | null = null;
  private readonly SECRET_SALT = 'QUAZLINK_ENTERPRISE_ERP_CORE_SALT_2026';

  constructor(db: PosDatabase) {
    this.db = db;
    this.ensureBusinessProfile();
  }

  /**
   * حساب البصمة الفريدة لعتاد الجهاز (Hardware ID)
   */
  public getHardwareId(): string {
    if (this.cachedHardwareId) return this.cachedHardwareId;

    const rawSpecs = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'GenericCPU',
      os.userInfo().username,
      this.getMacAddress(),
    ].join('::');

    const hash = crypto.createHash('sha256').update(rawSpecs).digest('hex').toUpperCase();
    // تنسيق بصمة الجهاز بشكل مميز وسهل النسخ: QL-HW-XXXX-XXXX-XXXX-XXXX
    this.cachedHardwareId = `QL-HW-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
    return this.cachedHardwareId;
  }

  private getMacAddress(): string {
    try {
      const ifaces = os.networkInterfaces();
      for (const name of Object.keys(ifaces)) {
        const list = ifaces[name];
        if (list) {
          for (const net of list) {
            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
              return net.mac;
            }
          }
        }
      }
    } catch (e) {}
    return '02:00:00:00:00:01';
  }

  private ensureBusinessProfile(): void {
    const hwId = this.getHardwareId();
    const existing = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    if (!existing) {
      const trialKey = this.generateTrialKey(hwId);
      this.db.run(
        `INSERT INTO business_profile (
          id, business_name, branch_code, pos_terminal_id, phone,
          currency, license_key, license_type, hardware_id
        ) VALUES (?, ?, 'B01', 'POS01', '01000000000', 'EGP', ?, 'trial', ?)`,
        [this.db.generateId(), 'كويزلينك ستور للتجارة والكمبيوتر', trialKey, hwId]
      );
    } else if (!existing.hardware_id) {
      this.db.run('UPDATE business_profile SET hardware_id = ? WHERE id = ?', [hwId, existing.id]);
    }
  }

  /**
   * توليد مفتاح ترخيص تجريبي مفتوح الصلاحيات
   */
  public generateTrialKey(hwId: string): string {
    const payload = {
      tier: 'trial',
      hw: hwId,
      exp: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days trial
      modules: ['core_pos', 'shifts_zreport', 'serial_warranty', 'ai_marketing', 'whatsapp_receipts', 'crm_ledgers', 'cloud_sync'],
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.SECRET_SALT).update(b64).digest('hex').slice(0, 8).toUpperCase();
    return `QLPOS-TRIAL-${b64}-${sig}`;
  }

  /**
   * توليد مفتاح ترخيص دائم أو سنوي (للربط مع منصة QuazLink)
   */
  public generateLicenseKey(tier: 'lifetime' | 'saas_subscription', hwId: string, customModules?: string[], expDays?: number): string {
    const payload = {
      tier,
      hw: hwId,
      exp: tier === 'lifetime' ? null : new Date(Date.now() + (expDays || 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      modules: customModules || ['core_pos', 'shifts_zreport', 'serial_warranty', 'ai_marketing', 'whatsapp_receipts', 'crm_ledgers', 'cloud_sync'],
    };
    const prefix = tier === 'lifetime' ? 'LIFE' : 'SAAS';
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.SECRET_SALT).update(b64).digest('hex').slice(0, 8).toUpperCase();
    return `QLPOS-${prefix}-${b64}-${sig}`;
  }

  /**
   * فحص والتحقق من صحة مفتاح الترخيص
   */
  public verifyLicense(licenseKey: string): { valid: boolean; error?: string; payload?: any } {
    if (!licenseKey || !licenseKey.startsWith('QLPOS-')) {
      return { valid: false, error: 'تنسيق مفتاح الترخيص غير صالح.' };
    }

    const parts = licenseKey.split('-');
    if (parts.length < 4) {
      return { valid: false, error: 'مفتاح الترخيص غير مكتمل.' };
    }

    const b64Payload = parts[2];
    const signature = parts[3];

    const expectedSig = crypto.createHmac('sha256', this.SECRET_SALT).update(b64Payload).digest('hex').slice(0, 8).toUpperCase();
    if (signature !== expectedSig) {
      return { valid: false, error: 'توقيع الترخيص الرقمي غير مطابق (مفتاح مزيف أو تالف).' };
    }

    try {
      const decoded = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
      const currentHw = this.getHardwareId();

      if (decoded.hw !== currentHw) {
        return { valid: false, error: `الترخيص مخصص لجهاز آخر (${decoded.hw}) ولا يطابق هذا الجهاز (${currentHw}).` };
      }

      if (decoded.exp) {
        const expTime = new Date(decoded.exp).getTime();
        if (Date.now() > expTime) {
          return { valid: false, error: 'انتهت صلاحية هذا الترخيص، برجاء التجديد من المنصة.' };
        }
      }

      return { valid: true, payload: decoded };
    } catch (e) {
      return { valid: false, error: 'تعذر قراءة بيانات الترخيص المشفرة.' };
    }
  }

  /**
   * تفعيل رخصة جديدة
   */
  public activateLicense(key: string): { success: boolean; message: string; license?: LicenseInfo } {
    const check = this.verifyLicense(key.trim());
    if (!check.valid || !check.payload) {
      return { success: false, message: check.error || 'فشل تفعيل الترخيص.' };
    }

    const payload = check.payload;
    this.db.run(
      `UPDATE business_profile
       SET license_key = ?, license_type = ?, updated_at = datetime('now')
       WHERE id = (SELECT id FROM business_profile LIMIT 1)`,
      [key.trim(), payload.tier]
    );

    return {
      success: true,
      message: '✅ تم تفعيل الترخيص بنجاح وربطه بالعتاد الحالي.',
      license: this.getLicenseInfo(),
    };
  }

  /**
   * جلب معلومات الترخيص الحالية والموديولات النشطة
   */
  public getLicenseInfo(): LicenseInfo {
    const hwId = this.getHardwareId();
    const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    const licenseKey = profile?.license_key || this.generateTrialKey(hwId);

    const check = this.verifyLicense(licenseKey);
    const payload = check.payload || {
      tier: 'trial',
      exp: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      modules: ['core_pos', 'shifts_zreport', 'serial_warranty', 'ai_marketing', 'whatsapp_receipts', 'crm_ledgers'],
    };

    let status: LicenseInfo['status'] = 'active';
    let daysRemaining = null;

    if (!check.valid) {
      status = check.error?.includes('لجهاز آخر') ? 'invalid_hardware' : 'expired';
    } else if (payload.tier === 'trial') {
      status = 'trial';
    }

    if (payload.exp) {
      const diffMs = new Date(payload.exp).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const modArray: string[] = payload.modules || [];

    return {
      status,
      tier: payload.tier || 'trial',
      hardwareId: hwId,
      licenseKey,
      businessName: profile?.business_name || 'كويزلينك ستور للتجارة والكمبيوتر',
      branchCode: profile?.branch_code || 'B01',
      activatedAt: profile?.created_at || new Date().toISOString(),
      expiresAt: payload.exp || null,
      daysRemaining,
      modules: {
        core_pos: true,
        shifts_zreport: modArray.includes('shifts_zreport'),
        serial_warranty: modArray.includes('serial_warranty'),
        ai_marketing: modArray.includes('ai_marketing'),
        whatsapp_receipts: modArray.includes('whatsapp_receipts'),
        crm_ledgers: modArray.includes('crm_ledgers'),
        cloud_sync: modArray.includes('cloud_sync'),
      },
      credits: this.getCreditWallet(),
    };
  }

  // ==========================================
  // محفظة الكريديت والإضافات السحابية (Credit Wallet)
  // ==========================================

  private ensureCreditWallet(): void {
    this.db.run(`CREATE TABLE IF NOT EXISTS credit_wallet (
      credit_type TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 100,
      total_consumed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    this.db.run(`INSERT OR IGNORE INTO credit_wallet (credit_type, balance, total_consumed) VALUES ('ai_tokens', 100, 0)`);
    this.db.run(`INSERT OR IGNORE INTO credit_wallet (credit_type, balance, total_consumed) VALUES ('whatsapp_messages', 250, 0)`);
  }

  public getCreditWallet(): CreditWalletInfo {
    this.ensureCreditWallet();
    const rows = this.db.queryAll<{ credit_type: string; balance: number; total_consumed: number }>(
      'SELECT credit_type, balance, total_consumed FROM credit_wallet'
    );
    const result: CreditWalletInfo = {
      aiTokens: 100,
      whatsappMessages: 250,
      totalAiConsumed: 0,
      totalWhatsappConsumed: 0,
    };
    for (const r of rows) {
      if (r.credit_type === 'ai_tokens') {
        result.aiTokens = r.balance;
        result.totalAiConsumed = r.total_consumed;
      } else if (r.credit_type === 'whatsapp_messages') {
        result.whatsappMessages = r.balance;
        result.totalWhatsappConsumed = r.total_consumed;
      }
    }
    return result;
  }

  public hasCredits(type: 'ai_tokens' | 'whatsapp_messages', amount = 1): boolean {
    this.ensureCreditWallet();
    const row = this.db.queryOne<{ balance: number }>(
      'SELECT balance FROM credit_wallet WHERE credit_type = ?',
      [type]
    );
    return (row?.balance ?? 0) >= amount;
  }

  public deductCredits(type: 'ai_tokens' | 'whatsapp_messages', amount = 1): { success: boolean; remaining: number } {
    this.ensureCreditWallet();
    const current = this.db.queryOne<{ balance: number; total_consumed: number }>(
      'SELECT balance, total_consumed FROM credit_wallet WHERE credit_type = ?',
      [type]
    );
    const balance = current?.balance ?? 0;
    if (balance < amount) {
      return { success: false, remaining: balance };
    }

    const newBalance = balance - amount;
    const newConsumed = (current?.total_consumed ?? 0) + amount;
    this.db.run(
      `UPDATE credit_wallet SET balance = ?, total_consumed = ?, updated_at = datetime('now') WHERE credit_type = ?`,
      [newBalance, newConsumed, type]
    );

    return { success: true, remaining: newBalance };
  }

  public addCredits(type: 'ai_tokens' | 'whatsapp_messages', amount: number): number {
    this.ensureCreditWallet();
    this.db.run(
      `UPDATE credit_wallet SET balance = balance + ?, updated_at = datetime('now') WHERE credit_type = ?`,
      [amount, type]
    );
    const updated = this.db.queryOne<{ balance: number }>(
      'SELECT balance FROM credit_wallet WHERE credit_type = ?',
      [type]
    );
    return updated?.balance ?? 0;
  }

  /**
   * توليد كود شحن رصيد رسمي (Voucher Code)
   * مثال: QLV-AI-100-7B9F1A4C
   */
  public generateCreditVoucher(type: 'ai_tokens' | 'whatsapp_messages', amount: number): string {
    const typeCode = type === 'ai_tokens' ? 'AI' : 'WA';
    const raw = `${typeCode}:${amount}:${this.SECRET_SALT}`;
    const sig = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8).toUpperCase();
    return `QLV-${typeCode}-${amount}-${sig}`;
  }

  /**
   * شحن كود رصيد ذكاء اصطناعي أو رسائل واتساب
   */
  public redeemCreditVoucher(rawVoucher: string): { success: boolean; message: string; balance?: number } {
    const cleaned = rawVoucher.trim().toUpperCase();
    const parts = cleaned.split('-');
    if (parts.length !== 4 || parts[0] !== 'QLV') {
      return { success: false, message: 'صيغة كود الشحن غير صحيحة. يجب أن تبدأ بـ QLV-' };
    }

    const typeCode = parts[1];
    const amount = parseInt(parts[2], 10);
    const expectedSig = parts[3];

    if (isNaN(amount) || amount <= 0) {
      return { success: false, message: 'قيمة الرصيد بالكود غير صالحة.' };
    }

    let type: 'ai_tokens' | 'whatsapp_messages';
    if (typeCode === 'AI') {
      type = 'ai_tokens';
    } else if (typeCode === 'WA') {
      type = 'whatsapp_messages';
    } else {
      return { success: false, message: 'نوع باقة الرصيد بالكود غير معروفة.' };
    }

    const raw = `${typeCode}:${amount}:${this.SECRET_SALT}`;
    const calculatedSig = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8).toUpperCase();

    if (calculatedSig !== expectedSig) {
      return { success: false, message: 'كود الشحن غير صالح أو مزور.' };
    }

    const newBalance = this.addCredits(type, amount);
    const typeLabel = type === 'ai_tokens' ? 'عمليات ذكاء اصطناعي' : 'رسائل واتساب';
    return {
      success: true,
      message: `✅ تم شحن ${amount} ${typeLabel} بنجاح! الرصيد الحالي: ${newBalance}`,
      balance: newBalance,
    };
  }
}
