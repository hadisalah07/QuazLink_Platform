import type { Page } from 'playwright';

export interface Destination {
  name: string;
  url: string;
}

export const PERSONAL_PROFILE: Destination = {
  name: 'Personal Profile',
  url: 'https://www.facebook.com',
};

// Utility links that live on the "Your Pages" listing but are NOT post
// destinations: inbox, ad center, and the usual profile sub-tabs.
const UTILITY =
  /\b(latest|inbox|messages|ad_center|stories|groups|events|friends|settings|business|help|bookmarks|watch|marketplace|gaming|reels|photos|videos|about|map|notifications|login|logout|policies|privacy|ads|sharer|dialog)\b|inbox|ad_center/i;

// Strip tracking params so `facebook.com/al3shour?__cft__=...` collapses to the
// canonical page URL — except profile.php, whose ?id=... IS the identity.
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.pathname === '/profile.php' && u.searchParams.get('id')) {
      return `${u.origin}/profile.php?id=${u.searchParams.get('id')}`;
    }
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return raw;
  }
}

// FB smushes the card title with metadata on cold loads. Take the first line
// and cut before common separators, then cap as a last resort.
function cleanName(raw: string): string {
  let name = (raw || '').replace(/\s+/g, ' ').trim();
  name = name.split('\n')[0].split(' · ')[0].split(' | ')[0].trim();
  if (name.length > 60) name = name.slice(0, 60).trim();
  return name;
}

function looksLikePage(url: string): boolean {
  if (!/facebook\.com\//i.test(url)) return false;
  if (UTILITY.test(url)) return false;
  const norm = normalizeUrl(url);
  // Reject the bare domain / home — that's the personal profile default.
  if (/facebook\.com(\/(home\.php)?)?$/i.test(norm)) return false;
  return true;
}

async function collectFrom(page: Page, url: string): Promise<Destination[]> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Cold sessions render the pages list slowly (and FB may pop a "save login"
  // sheet first). Poll up to 20s for a real page link instead of a fixed wait.
  const deadline = Date.now() + 20000;
  let raw: { name: string; url: string }[] = [];
  while (Date.now() < deadline) {
    raw = await page.evaluate(() => {
      const main = document.querySelector('[role="main"]') || document.body;
      return Array.from(main.querySelectorAll('a')).map((a) => ({
        name: (a as HTMLAnchorElement).textContent || '',
        url: (a as HTMLAnchorElement).href,
      }));
    });
    if (raw.some((r) => r.name.trim() && looksLikePage(r.url))) break;
    await page.waitForTimeout(1500);
  }

  const seen = new Map<string, Destination>();
  for (const r of raw) {
    if (!looksLikePage(r.url)) continue;
    const name = cleanName(r.name);
    if (!name) continue;
    const norm = normalizeUrl(r.url);
    if (!seen.has(norm)) seen.set(norm, { name, url: norm });
  }
  return Array.from(seen.values());
}

// Always returns at least the Personal Profile. Never throws — page detection
// is best-effort and must not sink a healthy session.
export async function detectDestinations(page: Page): Promise<Destination[]> {
  const sources = [
    'https://www.facebook.com/pages/?category=your_pages',
    'https://www.facebook.com/bookmarks/pages',
  ];
  for (const url of sources) {
    try {
      const pages = await collectFrom(page, url);
      if (pages.length > 0) {
        return [PERSONAL_PROFILE, ...pages];
      }
    } catch {
      // try the next source
    }
  }
  return [PERSONAL_PROFILE];
}
