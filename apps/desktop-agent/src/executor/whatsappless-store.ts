import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WhatsapplessEntry {
  phone: string;       // Normalized clean digits e.g. "201119665462"
  addedAt: number;     // Timestamp (Date.now())
  expiresAt: number;   // Timestamp (addedAt + 30 days)
  reason: string;      // Reason e.g. "The number isn't on WhatsApp"
}

export const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

/**
 * Normalizes phone string to clean digits only (e.g. "+20 11 1966 5462" -> "201119665462")
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
}

/**
 * Extracts a target phone number from destination URL or raw string
 */
export function extractPhoneNumber(dest: string): string | null {
  if (!dest) return null;
  const lower = dest.toLowerCase();

  // Check for query param ?phone= or &phone=
  if (lower.includes('phone=')) {
    const match = dest.match(/phone=([0-9+]+)/);
    if (match && match[1]) return normalizePhoneNumber(match[1]);
  }

  // Check for wa.me/
  if (lower.includes('wa.me/')) {
    const match = dest.match(/wa\.me\/([0-9+]+)/);
    if (match && match[1]) return normalizePhoneNumber(match[1]);
  }

  // Check if dest is purely a phone number (e.g. "201012345678" or "+201012345678")
  const cleanDigits = normalizePhoneNumber(dest);
  if (cleanDigits.length >= 8 && cleanDigits.length <= 16 && !lower.includes('status')) {
    return cleanDigits;
  }

  return null;
}

export class WhatsapplessStore {
  private filePath: string;
  private entries: Map<string, WhatsapplessEntry> = new Map();

  constructor() {
    const baseDir = path.join(os.homedir(), '.quazlink');
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {}
    }
    this.filePath = path.join(baseDir, 'whatsappless.json');
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      this.entries = new Map();
      return;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(data);
      const now = Date.now();
      this.entries = new Map();

      let hasExpired = false;
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [, entry] of Object.entries(parsed)) {
          const item = entry as WhatsapplessEntry;
          if (item && item.phone && item.expiresAt) {
            if (item.expiresAt > now) {
              this.entries.set(item.phone, item);
            } else {
              hasExpired = true;
            }
          }
        }
      }

      if (hasExpired) {
        this.save();
      }
    } catch (e: any) {
      console.error('❌ [WhatsapplessStore] Failed to load store:', e.message);
      this.entries = new Map();
    }
  }

  private save(): void {
    try {
      const obj: Record<string, WhatsapplessEntry> = {};
      for (const [key, val] of this.entries.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e: any) {
      console.error('❌ [WhatsapplessStore] Failed to save store:', e.message);
    }
  }

  /**
   * Checks if phone number is known to NOT have WhatsApp and is still within 30-day window
   */
  public isWhatsappless(rawPhone: string): boolean {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) return false;

    const entry = this.entries.get(phone);
    if (!entry) return false;

    // Check expiry (1 month)
    if (Date.now() > entry.expiresAt) {
      console.log(`⏱️ [WhatsapplessStore] Number +${phone} expired after 1 month. Removing from blacklist to allow retry.`);
      this.entries.delete(phone);
      this.save();
      return false;
    }

    return true;
  }

  /**
   * Gets the entry for a phone number
   */
  public get(rawPhone: string): WhatsapplessEntry | null {
    const phone = normalizePhoneNumber(rawPhone);
    if (!phone) return null;
    if (this.isWhatsappless(phone)) {
      return this.entries.get(phone) || null;
    }
    return null;
  }

  /**
   * Adds a number to the whatsappless list for 30 days (1 month)
   */
  public addWhatsappless(rawPhone: string, reason: string = "Isn't on WhatsApp"): WhatsapplessEntry {
    const phone = normalizePhoneNumber(rawPhone);
    const now = Date.now();
    const entry: WhatsapplessEntry = {
      phone,
      addedAt: now,
      expiresAt: now + ONE_MONTH_MS, // 30 days
      reason: reason || "Isn't on WhatsApp",
    };

    this.entries.set(phone, entry);
    this.save();

    const expiryDateStr = new Date(entry.expiresAt).toLocaleDateString();
    console.log(`🚫 [WhatsapplessStore] Number +${phone} saved to whatsappless list (Valid for 1 month until: ${expiryDateStr}).`);
    return entry;
  }

  /**
   * Remove a number manually
   */
  public remove(rawPhone: string): boolean {
    const phone = normalizePhoneNumber(rawPhone);
    const existed = this.entries.delete(phone);
    if (existed) this.save();
    return existed;
  }

  /**
   * Returns all active whatsappless entries
   */
  public getAll(): WhatsapplessEntry[] {
    const now = Date.now();
    const active: WhatsapplessEntry[] = [];
    let hasExpired = false;

    for (const [phone, entry] of this.entries.entries()) {
      if (entry.expiresAt > now) {
        active.push(entry);
      } else {
        this.entries.delete(phone);
        hasExpired = true;
      }
    }

    if (hasExpired) this.save();
    return active;
  }
}
