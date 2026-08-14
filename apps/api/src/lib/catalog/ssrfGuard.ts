import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  
  // Basic IPv6 check
  if (ip === '::1' || ip.toLowerCase().startsWith('fe80') || ip.toLowerCase().startsWith('fc00')) {
    return true;
  }
  
  return false;
}

export async function validateUrl(targetUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS protocols are allowed');
  }

  // Prevent metadata service attacks
  if (parsed.hostname === '169.254.169.254') {
    throw new Error('Access to cloud metadata services is forbidden');
  }

  // For testing purposes, we might allow localhost if explicitly needed by user,
  // but standard SSRF protection blocks it. We'll block it to follow the plan.
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    throw new Error('Localhost access is forbidden for SSRF protection');
  }

  try {
    // Resolve DNS to prevent DNS rebinding attacks to local IPs
    const { address } = await lookup(parsed.hostname);
    if (isPrivateIP(address)) {
      throw new Error(`Hostname resolves to a private/internal IP address (${address})`);
    }
  } catch (err: any) {
    if (err.message.includes('forbidden') || err.message.includes('private')) throw err;
    throw new Error(`Failed to resolve hostname: ${parsed.hostname}`);
  }
}
