import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cp from 'node:child_process';
import { PosDatabase } from '../database/connection.js';

export interface CreditWalletInfo {
  aiTokens: number;
  whatsappMessages: number;
  totalAiConsumed: number;
  totalWhatsappConsumed: number;
}

export interface LicenseInfo {
  status: 'active' | 'expired' | 'invalid_hardware' | 'trial' | 'clock_tampered';
  tier: 'trial' | 'lifetime' | 'saas_subscription';
  hardwareId: string;
  licenseKey: string;
  businessName: string;
  branchCode: string;
  activatedAt: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  isTampered?: boolean;
  isPaywallLocked?: boolean;
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

interface AnchorPayload {
  hw: string;
  firstTrialAt: string;
  trialExpiresAt: string;
  lastRuntime: number;
  status?: string;
}

export interface DetailedHardwareSpecs {
  motherboardUuid: string;
  motherboardSerial: string;
  motherboardMfr: string;
  motherboardModel: string;
  cpuModel: string;
  cpuProcessorId: string;
  cpuCores: number;
  cpuLogical: number;
  diskModel: string;
  diskSizeGB: number;
  biosVersion: string;
  biosMfr: string;
  totalMemoryMB: number;
  freeMemoryMB: number;
  osPlatform: string;
  osRelease: string;
  osArch: string;
  hostname: string;
  username: string;
}

export class LicensingService {
  private db: PosDatabase;
  private cachedHardwareId: string | null = null;
  private cachedLegacyHardwareId: string | null = null;
  private cachedSpecs: DetailedHardwareSpecs | null = null;
  private readonly SECRET_SALT = 'QUAZLINK_ENTERPRISE_ERP_CORE_SALT_2026';
  private readonly TRIAL_DURATION_DAYS = 30; // 30-day strict trial

  constructor(db: PosDatabase) {
    this.db = db;
    this.ensureSchemaExtensions();
    this.ensureBusinessProfile();
    // Non-blocking background verification with QuazLink Cloud Ledger
    setTimeout(() => {
      this.syncWithCloudLedger().catch(() => {});
    }, 4000);
  }

  /**
   * تأكيد وجود أعمدة الحماية والأقفال في قاعدة البيانات
   */
  private ensureSchemaExtensions(): void {
    try {
      this.db.run('ALTER TABLE business_profile ADD COLUMN first_trial_at TEXT');
    } catch {}
    try {
      this.db.run('ALTER TABLE business_profile ADD COLUMN trial_expires_at TEXT');
    } catch {}
    try {
      this.db.run('ALTER TABLE business_profile ADD COLUMN last_known_runtime TEXT');
    } catch {}
    try {
      this.db.run('ALTER TABLE business_profile ADD COLUMN tampered_flag INTEGER DEFAULT 0');
    } catch {}
  }

  /**
   * حساب البصمة الفيزيائية الحقيقية الدائمة للوحة الأم والمعالج (Permanent Motherboard Hardware ID)
   * هذه البصمة محفورة في عتاد الجهاز (SMBIOS/CPU) وتظل ثابتة بنسبة 100% حتى لو تم عمل فورمات للويندوز أو إعادة تثبيته.
   */
  public getHardwareId(): string {
    if (this.cachedHardwareId) return this.cachedHardwareId;

    let rawHw = '';

    // 1. استخراج Motherboard UUID
    try {
      const wmicOut = cp.execSync('wmic csproduct get uuid', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = wmicOut.trim().split(/\r?\n/);
      if (lines.length > 1 && lines[1].trim() && lines[1].trim() !== '00000000-0000-0000-0000-000000000000') {
        rawHw += lines[1].trim();
      }
    } catch {}

    // Fallback: PowerShell في حال عدم توفر WMIC (كما في بعض أنظمة Win 11 المخففة)
    if (!rawHw) {
      try {
        const psOut = cp.execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', {
          encoding: 'utf8',
          timeout: 3500,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        const uuid = psOut.trim();
        if (uuid && uuid !== '00000000-0000-0000-0000-000000000000') {
          rawHw += uuid;
        }
      } catch {}
    }

    // 2. استخراج كود المعالج الفيزيائي (CPU Processor ID)
    try {
      const cpuOut = cp.execSync('wmic cpu get processorid', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = cpuOut.trim().split(/\r?\n/);
      if (lines.length > 1 && lines[1].trim()) {
        rawHw += '::' + lines[1].trim();
      }
    } catch {
      try {
        const psCpu = cp.execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).ProcessorId"', {
          encoding: 'utf8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        if (psCpu.trim()) rawHw += '::' + psCpu.trim();
      } catch {}
    }

    // 3. استخراج سيريال اللوحة الأم (BaseBoard Serial)
    try {
      const mbOut = cp.execSync('wmic baseboard get serialnumber', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = mbOut.trim().split(/\r?\n/);
      if (lines.length > 1 && lines[1].trim()) {
        rawHw += '::' + lines[1].trim();
      }
    } catch {
      try {
        const psMb = cp.execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_BaseBoard).SerialNumber"', {
          encoding: 'utf8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        if (psMb.trim()) rawHw += '::' + psMb.trim();
      } catch {}
    }

    // 4. Fallback في حال البيئات الافتراضية الصارمة (Strict VM)
    if (!rawHw) {
      try {
        const regOut = cp.execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
          encoding: 'utf8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
        const match = regOut.match(/MachineGuid\s+REG_SZ\s+([a-zA-Z0-9-]+)/i);
        if (match && match[1]) {
          rawHw += '::' + match[1].trim();
        }
      } catch {}
    }

    if (!rawHw) {
      rawHw = [os.platform(), os.arch(), os.cpus()[0]?.model || 'GenericCPU'].join('::');
    }

    const hash = crypto.createHash('sha256').update(rawHw).digest('hex').toUpperCase();
    this.cachedHardwareId = `QL-HW-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
    return this.cachedHardwareId;
  }

  /**
   * الصيغة القديمة للبصمة (للتحقق المتوافق للرخص التي تم تفعيلها سابقاً دون كسرها)
   */
  public getLegacyHardwareId(): string {
    if (this.cachedLegacyHardwareId) return this.cachedLegacyHardwareId;
    const rawSpecs = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus()[0]?.model || 'GenericCPU',
      os.userInfo().username,
      this.getMacAddress(),
    ].join('::');
    const hash = crypto.createHash('sha256').update(rawSpecs).digest('hex').toUpperCase();
    this.cachedLegacyHardwareId = `QL-HW-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
    return this.cachedLegacyHardwareId;
  }

  /**
   * استخراج كافة مواصفات العتاد واللوحة الأم والمعالج والمساحة بدقة (Full Device Hardware Specs)
   */
  public getDetailedHardwareSpecs(): DetailedHardwareSpecs {
    if (this.cachedSpecs) return this.cachedSpecs;

    let motherboardUuid = '';
    let motherboardSerial = '';
    let motherboardMfr = '';
    let motherboardModel = '';
    let cpuProcessorId = '';
    const cpus = os.cpus();
    let cpuCores = cpus && cpus.length ? cpus.length : 1;
    let cpuLogical = cpus && cpus.length ? cpus.length : 1;
    let diskModel = '';
    let diskSizeGB = 0;
    let biosVersion = '';
    let biosMfr = '';

    // 1. Motherboard UUID
    try {
      const wmicOut = cp.execSync('wmic csproduct get uuid', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = wmicOut.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines[1] && lines[1] !== '00000000-0000-0000-0000-000000000000') {
        motherboardUuid = lines[1];
      }
    } catch {}

    // 2. Baseboard (Motherboard Manufacturer, Model & Serial)
    try {
      const mbOut = cp.execSync('wmic baseboard get manufacturer,product,serialnumber /format:list', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      mbOut.split(/\r?\n/).forEach(line => {
        const [k, ...v] = line.split('=');
        const val = v.join('=').trim();
        if (!val) return;
        const key = (k || '').trim().toLowerCase();
        if (key === 'manufacturer') motherboardMfr = val;
        if (key === 'product') motherboardModel = val;
        if (key === 'serialnumber') motherboardSerial = val;
      });
    } catch {}

    // Fallback: PC Model Name if motherboardModel is empty (Dell XPS, HP ProBook, Lenovo ThinkPad)
    if (!motherboardModel) {
      try {
        const csOut = cp.execSync('wmic csproduct get name /format:list', { encoding: 'utf8', timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] });
        const match = csOut.match(/Name=(.+)/i);
        if (match && match[1]) motherboardModel = match[1].trim();
      } catch {}
    }

    // 3. CPU Specs
    const cpuModel = cpus && cpus[0] ? cpus[0].model.trim() : 'Standard Processor';
    try {
      const cpuOut = cp.execSync('wmic cpu get processorid,numberofcores,numberoflogicalprocessors /format:list', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      cpuOut.split(/\r?\n/).forEach(line => {
        const [k, ...v] = line.split('=');
        const val = v.join('=').trim();
        if (!val) return;
        const key = (k || '').trim().toLowerCase();
        if (key === 'processorid') cpuProcessorId = val;
        if (key === 'numberofcores') cpuCores = parseInt(val, 10) || cpuCores;
        if (key === 'numberoflogicalprocessors') cpuLogical = parseInt(val, 10) || cpuLogical;
      });
    } catch {}

    // 4. Primary Disk Drive
    try {
      const diskOut = cp.execSync('wmic diskdrive get model,size /format:list', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      diskOut.split(/\r?\n/).forEach(line => {
        const [k, ...v] = line.split('=');
        const val = v.join('=').trim();
        if (!val) return;
        const key = (k || '').trim().toLowerCase();
        if (key === 'model' && !diskModel) diskModel = val;
        if (key === 'size' && !diskSizeGB) diskSizeGB = Math.round(parseInt(val, 10) / (1024 * 1024 * 1024)) || 0;
      });
    } catch {}

    // 5. BIOS
    try {
      const biosOut = cp.execSync('wmic bios get smbiosbiosversion,manufacturer /format:list', { encoding: 'utf8', timeout: 2500, stdio: ['pipe', 'pipe', 'ignore'] });
      biosOut.split(/\r?\n/).forEach(line => {
        const [k, ...v] = line.split('=');
        const val = v.join('=').trim();
        if (!val) return;
        const key = (k || '').trim().toLowerCase();
        if (key === 'smbiosbiosversion') biosVersion = val;
        if (key === 'manufacturer') biosMfr = val;
      });
    } catch {}

    this.cachedSpecs = {
      motherboardUuid: motherboardUuid || this.getHardwareId(),
      motherboardSerial: motherboardSerial || 'Standard Serial',
      motherboardMfr: motherboardMfr || 'Generic System Board',
      motherboardModel: motherboardModel || 'Standard System Board',
      cpuModel,
      cpuProcessorId: cpuProcessorId || 'Standard CPU ID',
      cpuCores,
      cpuLogical,
      diskModel: diskModel || 'Primary System Drive',
      diskSizeGB,
      biosVersion: biosVersion || 'UEFI/BIOS Standard',
      biosMfr: biosMfr || motherboardMfr || 'Generic BIOS',
      totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
      osPlatform: process.platform,
      osRelease: os.release(),
      osArch: os.arch(),
      hostname: os.hostname(),
      username: os.userInfo ? (os.userInfo().username || 'Cashier') : 'Cashier',
    };

    return this.cachedSpecs;
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
    } catch {}
    return '02:00:00:00:00:01';
  }

  // ==========================================
  // نظام المراسي الثلاثية (Multi-Anchor Anti-Reset System)
  // ==========================================

  private getAnchorFilePath(): string {
    const baseDir = process.env.ALLUSERSPROFILE || process.env.ProgramData || 'C:\\ProgramData';
    return path.join(baseDir, 'QuazLink', '.ql_sys_anchor');
  }

  private readAnchorFromFile(): AnchorPayload | null {
    try {
      const fpath = this.getAnchorFilePath();
      if (fs.existsSync(fpath)) {
        const raw = fs.readFileSync(fpath, 'utf8').trim();
        return this.verifyAndDecodeAnchor(raw);
      }
    } catch {}
    return null;
  }

  private writeAnchorToFile(token: string): void {
    try {
      const fpath = this.getAnchorFilePath();
      const dir = path.dirname(fpath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fpath, token, 'utf8');
    } catch {}
  }

  private readAnchorFromRegistry(): AnchorPayload | null {
    try {
      const out = cp.execSync('reg query "HKCU\\Software\\QuazLink\\POS" /v TrialAnchor', {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const match = out.match(/TrialAnchor\s+REG_SZ\s+([^\r\n]+)/i);
      if (match && match[1]) {
        return this.verifyAndDecodeAnchor(match[1].trim());
      }
    } catch {}
    return null;
  }

  private writeAnchorToRegistry(token: string): void {
    try {
      cp.execSync(`reg add "HKCU\\Software\\QuazLink\\POS" /v TrialAnchor /t REG_SZ /d "${token}" /f`, {
        timeout: 2000,
        stdio: 'ignore',
      });
    } catch {}
  }

  private createAnchorToken(payload: AnchorPayload): string {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.SECRET_SALT).update(b64).digest('hex').slice(0, 12).toUpperCase();
    return `${b64}.${sig}`;
  }

  private verifyAndDecodeAnchor(raw: string): AnchorPayload | null {
    try {
      const parts = raw.split('.');
      if (parts.length !== 2) return null;
      const [b64, sig] = parts;
      const expected = crypto.createHmac('sha256', this.SECRET_SALT).update(b64).digest('hex').slice(0, 12).toUpperCase();
      if (sig !== expected) return null;
      const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
      if (parsed.hw && parsed.firstTrialAt) return parsed;
    } catch {}
    return null;
  }

  /**
   * تهيئة وتأكيد حساب الفترة التجريبية بدقة وحمايتها من المسح والفورمات
   */
  private ensureBusinessProfile(): void {
    const hwId = this.getHardwareId();
    const existing = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');

    // 1. قراءة المراسي الخارجية (الملف المحمي + الريجستري)
    const fileAnchor = this.readAnchorFromFile();
    const regAnchor = this.readAnchorFromRegistry();

    // 2. البحث عن أقدم تاريخ تشغيل تجريبي مسجل (The Earliest First-Trial Timestamp Always Wins)
    const candidates: number[] = [];
    if (fileAnchor?.firstTrialAt) {
      const t = new Date(fileAnchor.firstTrialAt).getTime();
      if (!isNaN(t) && t > 0) candidates.push(t);
    }
    if (regAnchor?.firstTrialAt) {
      const t = new Date(regAnchor.firstTrialAt).getTime();
      if (!isNaN(t) && t > 0) candidates.push(t);
    }
    if (existing?.first_trial_at) {
      const t = new Date(existing.first_trial_at).getTime();
      if (!isNaN(t) && t > 0) candidates.push(t);
    }

    const now = Date.now();
    let firstTrialMs = candidates.length > 0 ? Math.min(...candidates) : now;
    let trialExpiresMs = firstTrialMs + this.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

    const firstTrialIso = new Date(firstTrialMs).toISOString();
    const trialExpiresIso = new Date(trialExpiresMs).toISOString();

    // 3. فحص التلاعب بساعة النظام (Anti-Clock Rollback)
    const lastRuntimes: number[] = [];
    if (fileAnchor?.lastRuntime) lastRuntimes.push(fileAnchor.lastRuntime);
    if (regAnchor?.lastRuntime) lastRuntimes.push(regAnchor.lastRuntime);
    if (existing?.last_known_runtime) {
      const t = new Date(existing.last_known_runtime).getTime();
      if (!isNaN(t)) lastRuntimes.push(t);
    }

    let isTampered = existing?.tampered_flag === 1;
    if (lastRuntimes.length > 0) {
      const maxLast = Math.max(...lastRuntimes);
      // إذا كان الوقت الحالي للويندوز يرجع للخلف بأكثر من 5 دقائق عن آخر وقت مسجل
      if (now < maxLast - 300000) {
        isTampered = true;
        console.warn('⚠️ [Security Shield] Clock rollback detected! System locked for license protection.');
      }
    }

    // 4. كتابة/تحديث المراسي محلياً لضمان صمودها
    const anchorToken = this.createAnchorToken({
      hw: hwId,
      firstTrialAt: firstTrialIso,
      trialExpiresAt: trialExpiresIso,
      lastRuntime: now,
      status: isTampered ? 'clock_tampered' : undefined,
    });
    this.writeAnchorToFile(anchorToken);
    this.writeAnchorToRegistry(anchorToken);

    // 5. حفظ/تحديث جدول الملف الشخصي
    const trialKey = this.generateTrialKey(hwId, trialExpiresIso);

    if (!existing) {
      this.db.run(
        `INSERT INTO business_profile (
          id, business_name, branch_code, pos_terminal_id, phone,
          currency, license_key, license_type, hardware_id,
          first_trial_at, trial_expires_at, last_known_runtime, tampered_flag
        ) VALUES (?, ?, 'B01', 'POS01', '01000000000', 'EGP', ?, 'trial', ?, ?, ?, ?, ?)`,
        [
          this.db.generateId(),
          'كويزلينك ستور للتجارة والكمبيوتر',
          trialKey,
          hwId,
          firstTrialIso,
          trialExpiresIso,
          new Date(now).toISOString(),
          isTampered ? 1 : 0,
        ]
      );
    } else {
      this.db.run(
        `UPDATE business_profile SET
          hardware_id = ?,
          first_trial_at = COALESCE(first_trial_at, ?),
          trial_expires_at = COALESCE(trial_expires_at, ?),
          last_known_runtime = ?,
          tampered_flag = ?
         WHERE id = ?`,
        [
          hwId,
          firstTrialIso,
          trialExpiresIso,
          new Date(now).toISOString(),
          isTampered ? 1 : 0,
          existing.id,
        ]
      );
    }
  }

  /**
   * تسجيل نبضة التشغيل اللحظية لمكافحة التلاعب بالساعة (Runtime Heartbeat)
   */
  public recordRuntimeHeartbeat(): boolean {
    const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    if (!profile) return true;

    const now = Date.now();
    let isTampered = profile.tampered_flag === 1;

    if (profile.last_known_runtime) {
      const lastMs = new Date(profile.last_known_runtime).getTime();
      if (!isNaN(lastMs) && now < lastMs - 300000) {
        isTampered = true;
      }
    }

    const hwId = this.getHardwareId();
    const firstTrialIso = profile.first_trial_at || new Date(now).toISOString();
    const trialExpiresIso = profile.trial_expires_at || new Date(now + this.TRIAL_DURATION_DAYS * 86400000).toISOString();

    const anchorToken = this.createAnchorToken({
      hw: hwId,
      firstTrialAt: firstTrialIso,
      trialExpiresAt: trialExpiresIso,
      lastRuntime: now,
      status: isTampered ? 'clock_tampered' : undefined,
    });
    this.writeAnchorToFile(anchorToken);
    this.writeAnchorToRegistry(anchorToken);

    this.db.run(
      'UPDATE business_profile SET last_known_runtime = ?, tampered_flag = ? WHERE id = ?',
      [new Date(now).toISOString(), isTampered ? 1 : 0, profile.id]
    );

    return !isTampered;
  }

  /**
   * التحقق والتكامل مع سجل السيرفر المركزي السحابي (Cloud Trial Ledger)
   * لحماية المنظومة من حيلة الفورمات الكامل للويندوز
   */
  public async syncWithCloudLedger(): Promise<void> {
    const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    if (!profile) return;

    const hwId = this.getHardwareId();

    const endpoints = [
      'https://app.quazlink.site/api/pos/trial/verify',
      'https://quazlink.com/api/pos/trial/verify',
      'http://164.68.115.239:3000/api/pos/trial/verify',
      'http://localhost:3000/api/pos/trial/verify',
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const specs = this.getDetailedHardwareSpecs();
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hardwareId: hwId,
            businessName: profile.business_name || 'Retail Store',
            hostname: os.hostname(),
            appVersion: '1.3.7',
            osRelease: os.release(),
            motherboardUuid: specs.motherboardUuid,
            motherboardSerial: specs.motherboardSerial,
            motherboardMfr: specs.motherboardMfr,
            motherboardModel: specs.motherboardModel,
            cpuModel: specs.cpuModel,
            cpuProcessorId: specs.cpuProcessorId,
            cpuCores: specs.cpuCores,
            diskModel: specs.diskModel,
            diskSizeGB: specs.diskSizeGB,
            biosVersion: specs.biosVersion,
            totalMemoryMB: specs.totalMemoryMB,
            rawHardware: specs,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data && data.success) {
            // إذا كان السيرفر يحمل تاريخ انتهاء مسبق أو أعلن أن الجهاز انتهت فترته
            if (data.status === 'expired' || data.firstSeenAt) {
              const serverFirstSeen = new Date(data.firstSeenAt).toISOString();
              const serverExpiresAt = new Date(data.expiresAt || serverFirstSeen).toISOString();

              this.db.run(
                'UPDATE business_profile SET first_trial_at = ?, trial_expires_at = ? WHERE id = ?',
                [serverFirstSeen, serverExpiresAt, profile.id]
              );

              const anchorToken = this.createAnchorToken({
                hw: hwId,
                firstTrialAt: serverFirstSeen,
                trialExpiresAt: serverExpiresAt,
                lastRuntime: Date.now(),
              });
              this.writeAnchorToFile(anchorToken);
              this.writeAnchorToRegistry(anchorToken);
            }
            break;
          }
        }
      } catch {}
    }
  }

  /**
   * توليد مفتاح ترخيص تجريبي لمدة 30 يوماً
   */
  public generateTrialKey(hwId: string, customExpIso?: string): string {
    const expDate = customExpIso
      ? customExpIso.split('T')[0]
      : new Date(Date.now() + this.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const payload = {
      tier: 'trial',
      hw: hwId,
      exp: expDate,
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
   * فحص والتحقق من صحة مفتاح الترخيص (مع التوافق التام للرخص السابقة)
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
      const legacyHw = this.getLegacyHardwareId();

      // التوافق المزدوج: نقبل إما البصمة الفيزيائية الجديدة أو البصمة السابقة إذا كانت مفعلة لعميل قديم
      if (decoded.hw !== currentHw && decoded.hw !== legacyHw) {
        return { valid: false, error: `الترخيص مخصص لجهاز آخر (${decoded.hw}) ولا يطابق هذا الجهاز (${currentHw}).` };
      }

      if (decoded.exp) {
        const expTime = new Date(decoded.exp).getTime();
        if (Date.now() > expTime) {
          return { valid: false, error: 'انتهت صلاحية هذا الترخيص، برجاء التجديد من المنصة.' };
        }
      }

      return { valid: true, payload: decoded };
    } catch {
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
       SET license_key = ?, license_type = ?, tampered_flag = 0, updated_at = datetime('now')
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
   * جلب معلومات الترخيص الحالية مع حالة القفل (Paywall Lock Status)
   */
  public getLicenseInfo(): LicenseInfo {
    const hwId = this.getHardwareId();
    const profile = this.db.queryOne<any>('SELECT * FROM business_profile LIMIT 1');
    const licenseKey = profile?.license_key || this.generateTrialKey(hwId);

    const check = this.verifyLicense(licenseKey);

    // التحقق من التلاعب بساعة الويندوز
    const isClockTampered = profile?.tampered_flag === 1;

    let tier: LicenseInfo['tier'] = profile?.license_type || 'trial';
    let expiresAt: string | null = profile?.trial_expires_at || null;
    let daysRemaining: number | null = null;
    let status: LicenseInfo['status'] = 'trial';

    if (!check.valid && tier !== 'trial') {
      status = check.error?.includes('لجهاز آخر') ? 'invalid_hardware' : 'expired';
    } else if (isClockTampered) {
      status = 'clock_tampered';
    } else if (tier === 'lifetime') {
      status = 'active';
      expiresAt = null;
      daysRemaining = null;
    } else if (tier === 'saas_subscription') {
      if (check.valid && check.payload?.exp) {
        expiresAt = check.payload.exp;
        const diffMs = new Date(expiresAt!).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        status = daysRemaining > 0 ? 'active' : 'expired';
      } else {
        status = 'expired';
        daysRemaining = 0;
      }
    } else {
      // Trial Mode: حساب الأيام المتبقية بناءً على تاريخ الانتهاء الصارم (30 يوماً)
      if (expiresAt) {
        const diffMs = new Date(expiresAt).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        status = daysRemaining > 0 ? 'trial' : 'expired';
      } else {
        daysRemaining = 0;
        status = 'expired';
      }
    }

    const modArray: string[] = check.payload?.modules || [
      'core_pos',
      'shifts_zreport',
      'serial_warranty',
      'ai_marketing',
      'whatsapp_receipts',
      'crm_ledgers',
      'cloud_sync',
    ];

    const isPaywallLocked = status !== 'active' && status !== 'trial';

    return {
      status,
      tier,
      hardwareId: hwId,
      licenseKey,
      businessName: profile?.business_name || 'كويزلينك ستور للتجارة والكمبيوتر',
      branchCode: profile?.branch_code || 'B01',
      activatedAt: profile?.created_at || new Date().toISOString(),
      expiresAt,
      daysRemaining,
      isTampered: isClockTampered,
      isPaywallLocked,
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

  public generateCreditVoucher(type: 'ai_tokens' | 'whatsapp_messages', amount: number): string {
    const typeCode = type === 'ai_tokens' ? 'AI' : 'WA';
    const raw = `${typeCode}:${amount}:${this.SECRET_SALT}`;
    const sig = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8).toUpperCase();
    return `QLV-${typeCode}-${amount}-${sig}`;
  }

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
