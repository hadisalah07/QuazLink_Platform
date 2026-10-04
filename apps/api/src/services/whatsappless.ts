import * as fs from 'fs';
import * as path from 'path';

export interface WhatsapplessEntry {
  phone: string;
  addedAt: number;
  expiresAt: number;
  reason: string;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const CACHE_FILE = path.join(process.cwd(), 'whatsappless_cache.json');
const store = new Map<string, WhatsapplessEntry>();

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      const data = JSON.parse(raw);
      const now = Date.now();
      for (const [, val] of Object.entries(data)) {
        const item = val as WhatsapplessEntry;
        if (item && item.phone && item.expiresAt > now) {
          store.set(item.phone, item);
        }
      }
    }
  } catch (e: any) {
    console.error('❌ [API:Whatsappless] Failed to load cache:', e.message);
  }
}

function saveCache() {
  try {
    const obj: Record<string, WhatsapplessEntry> = {};
    for (const [phone, entry] of store.entries()) {
      obj[phone] = entry;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e: any) {
    console.error('❌ [API:Whatsappless] Failed to save cache:', e.message);
  }
}

// Initial load
loadCache();

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
}

export function extractPhone(target: string): string | null {
  if (!target) return null;
  const match = target.match(/(?:phone=|wa\.me\/|\+?)([0-9]{8,16})/);
  return match ? normalizePhone(match[1]) : null;
}

export function isWhatsappless(rawPhone: string): boolean {
  const phone = normalizePhone(rawPhone);
  if (!phone) return false;
  const entry = store.get(phone);
  if (!entry) return false;

  // Check 1-month expiry
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    saveCache();
    return false;
  }
  return true;
}

export function getWhatsapplessEntry(rawPhone: string): WhatsapplessEntry | null {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  if (isWhatsappless(phone)) {
    return store.get(phone) || null;
  }
  return null;
}

export function addWhatsappless(rawPhone: string, reason: string = "Isn't on WhatsApp"): WhatsapplessEntry {
  const phone = normalizePhone(rawPhone);
  const now = Date.now();
  const entry: WhatsapplessEntry = {
    phone,
    addedAt: now,
    expiresAt: now + ONE_MONTH_MS, // 30 days
    reason,
  };
  store.set(phone, entry);
  saveCache();
  console.log(`🚫 [API:Whatsappless] Number +${phone} cached as whatsappless for 30 days.`);
  return entry;
}

export function removeWhatsappless(rawPhone: string): boolean {
  const phone = normalizePhone(rawPhone);
  const existed = store.delete(phone);
  if (existed) saveCache();
  return existed;
}

export function getAllWhatsappless(): WhatsapplessEntry[] {
  const now = Date.now();
  const list: WhatsapplessEntry[] = [];
  let expired = false;
  for (const [phone, entry] of store.entries()) {
    if (entry.expiresAt > now) {
      list.push(entry);
    } else {
      store.delete(phone);
      expired = true;
    }
  }
  if (expired) saveCache();
  return list;
}
