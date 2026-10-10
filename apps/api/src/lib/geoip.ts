import https from 'https';
import http from 'http';

export interface GeoLocation {
  country: string;
  city: string;
  countryCode: string;
  flag: string;
  ip: string;
}

// Convert 2-letter ISO country code (e.g. 'EG', 'SA') into emoji flag (e.g. 🇪🇬, 🇸🇦)
export function getCountryFlag(code?: string | null): string {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  if (upper === 'LO') return '💻';
  try {
    const codePoints = [...upper].map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

// Country code to friendly name fallback map
const COMMON_COUNTRY_NAMES: Record<string, string> = {
  EG: 'Egypt',
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  KW: 'Kuwait',
  QA: 'Qatar',
  OM: 'Oman',
  BH: 'Bahrain',
  JO: 'Jordan',
  IQ: 'Iraq',
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  TR: 'Turkey',
  CA: 'Canada',
  AU: 'Australia',
};

// In-memory cache to prevent repeated external network lookups
const geoCache = new Map<string, GeoLocation>();

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^.*:/, '').trim(); // Remove IPv6 prefix if present
  if (
    clean === '127.0.0.1' ||
    clean === 'localhost' ||
    clean === '::1' ||
    clean === '' ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.') ||
    clean.startsWith('172.16.') ||
    clean.startsWith('172.17.') ||
    clean.startsWith('172.18.') ||
    clean.startsWith('172.19.') ||
    clean.startsWith('172.20.') ||
    clean.startsWith('172.21.') ||
    clean.startsWith('172.22.') ||
    clean.startsWith('172.23.') ||
    clean.startsWith('172.24.') ||
    clean.startsWith('172.25.') ||
    clean.startsWith('172.26.') ||
    clean.startsWith('172.27.') ||
    clean.startsWith('172.28.') ||
    clean.startsWith('172.29.') ||
    clean.startsWith('172.30.') ||
    clean.startsWith('172.31.')
  ) {
    return true;
  }
  return false;
}

export function extractClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    '127.0.0.1'
  );
}

/**
 * Resolves geolocation details for an IP address.
 * Leverages Cloudflare edge headers if present, local private IP detection,
 * and an external fast GeoIP lookup with in-memory caching.
 */
export async function resolveGeoLocation(
  ip: string,
  reqHeaders?: Record<string, string | string[] | undefined>
): Promise<GeoLocation> {
  const cleanIp = ip ? ip.trim() : '127.0.0.1';

  // 1. Check if Cloudflare or CDN already provided geo headers
  if (reqHeaders) {
    const cfCountry = reqHeaders['cf-ipcountry'];
    const cfCity = reqHeaders['cf-ipcity'];
    if (typeof cfCountry === 'string' && cfCountry && cfCountry !== 'XX') {
      const code = cfCountry.toUpperCase();
      const country = COMMON_COUNTRY_NAMES[code] || code;
      const city = typeof cfCity === 'string' ? decodeURIComponent(cfCity) : 'City Node';
      const loc: GeoLocation = {
        country,
        city,
        countryCode: code,
        flag: getCountryFlag(code),
        ip: cleanIp,
      };
      geoCache.set(cleanIp, loc);
      return loc;
    }
  }

  // 2. Check in-memory cache
  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  // 3. Handle Localhost & Private Subnets
  if (isPrivateIp(cleanIp)) {
    const localLoc: GeoLocation = {
      country: 'Local Network',
      city: 'Local Workstation',
      countryCode: 'LO',
      flag: '💻',
      ip: cleanIp,
    };
    geoCache.set(cleanIp, localLoc);
    return localLoc;
  }

  // 4. Resolve via fast IP-API (free, high-throughput, no key needed)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const fallback: GeoLocation = {
        country: 'Global Network',
        city: 'Cloud Node',
        countryCode: 'UN',
        flag: '🌍',
        ip: cleanIp,
      };
      resolve(fallback);
    }, 2500);

    const url = `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,city`;
    http
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(data);
            if (parsed.status === 'success' && parsed.countryCode) {
              const loc: GeoLocation = {
                country: parsed.country || 'Global Node',
                city: parsed.city || 'Regional Center',
                countryCode: parsed.countryCode.toUpperCase(),
                flag: getCountryFlag(parsed.countryCode),
                ip: cleanIp,
              };
              geoCache.set(cleanIp, loc);
              return resolve(loc);
            }
          } catch {}

          const fallback: GeoLocation = {
            country: 'Global Network',
            city: 'Cloud Node',
            countryCode: 'UN',
            flag: '🌍',
            ip: cleanIp,
          };
          resolve(fallback);
        });
      })
      .on('error', () => {
        clearTimeout(timer);
        const fallback: GeoLocation = {
          country: 'Global Network',
          city: 'Cloud Node',
          countryCode: 'UN',
          flag: '🌍',
          ip: cleanIp,
        };
        resolve(fallback);
      });
  });
}
