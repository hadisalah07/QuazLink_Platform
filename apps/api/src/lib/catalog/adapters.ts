import { Product } from './types';

export function customAdapter(data: any): Product[] {
  // Try to find the array if data is an object
  let items = data;
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') {
      // Common wrapper keys
      items = data.data || data.products || data.items || data.results || data.catalog || [];
    } else {
      return [];
    }
  }

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    id: item.id?.toString() || item._id?.toString() || Math.random().toString(36).substr(2, 9),
    title: item.title || item.name || 'Unknown Product',
    description: item.description || item.desc || item.data?.description || item.data?.desc || '',
    price: item.price?.toString() || item.regular_price?.toString() || item.data?.price?.toString() || '0',
    currency: item.currency || 'EGP', // Default to EGP for local testing or parse if exists
    imageUrl: item.imageUrl || item.image || item.photo || item.thumbnail || (item.images && item.images[0]) || item.data?.image || (item.data?.images && item.data.images[0]) || null,
    images: Array.isArray(item.images) ? item.images : Array.isArray(item.data?.images) ? item.data.images : [],
    productUrl: item.productUrl || item.link || item.url || null,
  }));
}

export function pickAdapter(sourceType: string) {
  // For now, only custom is implemented. Shopify/Woo can be added here later.
  return customAdapter;
}
