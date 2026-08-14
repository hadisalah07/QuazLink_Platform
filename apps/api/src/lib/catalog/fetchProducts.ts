import { Catalog } from '@prisma/client';
import { Product } from './types';
import { pickAdapter } from './adapters';
import { validateUrl } from './ssrfGuard';
import { decrypt } from '../crypto';

export async function fetchProducts(catalog: Catalog): Promise<Product[]> {
  // 1. SSRF Guard
  await validateUrl(catalog.apiUrl);

  const apiKey = catalog.apiKey ? decrypt(catalog.apiKey) : null;

  // 2. Build Headers
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (catalog.authScheme === 'bearer' && apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (catalog.authScheme === 'header' && catalog.authHeader && apiKey) {
    headers[catalog.authHeader] = apiKey;
  }

  let finalUrl = catalog.apiUrl;
  if (catalog.authScheme === 'query' && apiKey) {
    const url = new URL(finalUrl);
    url.searchParams.append('api_key', apiKey); // naive assumption of param name
    finalUrl = url.toString();
  }

  // 3. Fetch Data with Timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s max

  let res: Response;
  try {
    res = await fetch(finalUrl, {
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Product API timed out after 10 seconds');
    }
    throw new Error(`Failed to fetch products: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`API responded with status ${res.status}: ${res.statusText}`);
  }

  const data = await res.json().catch(() => {
    throw new Error('API did not return valid JSON');
  });

  // 4. Adapt to Normalized Format
  const adapter = pickAdapter(catalog.sourceType);
  return adapter(data);
}
