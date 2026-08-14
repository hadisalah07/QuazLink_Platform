import { PrismaClient } from '@prisma/client';
import { fetchProducts } from './src/lib/catalog/fetchProducts';
const prisma = new PrismaClient();
async function main() {
  const cat = await prisma.catalog.findFirst();
  if (cat) {
    // Override the adapter logic locally just to print the RAW data from fetch
    const res = await fetch(cat.apiUrl, {
      headers: { Authorization: `Bearer ${cat.apiKey}` }
    });
    const raw = await res.json();
    console.log(JSON.stringify(raw.data?.[0] || raw[0] || raw, null, 2));
  }
}
main();
