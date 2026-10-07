import { PosServer } from './server/api-server.js';
import { PosDatabase } from './database/connection.js';
import { ProductService } from './services/product-service.js';
import { ContactService } from './services/contact-service.js';

async function seedInitialDataIfNeeded(db: PosDatabase) {
  const productService = new ProductService(db);
  const contactService = new ContactService(db);

  const existingProducts = productService.getAllProducts();
  if (existingProducts.length === 0) {
    console.log('🌱 Seeding initial retail products & serials for demo...');

    // 1. Electronic items with Serials
    const laptop1 = productService.createProduct({
      name: 'Dell G15 Gaming Laptop (RTX 4060)',
      barcode: '8841163901',
      sku: 'DELL-G15-4060',
      buyPrice: 38000,
      sellPriceRetail: 44500,
      sellPriceWholesale: 42000,
      hasSerial: true,
      minStockAlert: 2,
    });
    productService.addSerialNumbers(laptop1.id, ['DELL-G15-SN01', 'DELL-G15-SN02', 'DELL-G15-SN03'], 24);

    const gpu = productService.createProduct({
      name: 'NVIDIA RTX 4070 Super 12GB',
      barcode: '4719072981',
      sku: 'RTX-4070S',
      buyPrice: 28000,
      sellPriceRetail: 33000,
      hasSerial: true,
      minStockAlert: 2,
    });
    productService.addSerialNumbers(gpu.id, ['RTX4070-SN881', 'RTX4070-SN882'], 36);

    // 2. Standard accessories (No serial)
    productService.createProduct({
      name: 'Logitech G502 Hero Gaming Mouse',
      barcode: '509920608',
      sku: 'LOGI-G502',
      buyPrice: 950,
      sellPriceRetail: 1350,
      sellPriceWholesale: 1200,
      stockQuantity: 25,
      hasSerial: false,
    });

    productService.createProduct({
      name: 'Kingston 1TB NVMe PCIe 4.0 SSD',
      barcode: '740617329',
      sku: 'KNG-1TB-NVME',
      buyPrice: 2200,
      sellPriceRetail: 2950,
      sellPriceWholesale: 2700,
      stockQuantity: 40,
      hasSerial: false,
    });

    productService.createProduct({
      name: 'Anker PowerLine III USB-C Cable (1.8m)',
      barcode: '848061060',
      sku: 'ANK-TYPEC-18',
      buyPrice: 120,
      sellPriceRetail: 220,
      stockQuantity: 60,
      hasSerial: false,
    });

    // 3. Demo customer
    contactService.createContact({
      type: 'customer',
      name: 'م. أحمد الشافعي (العميل المميز)',
      phone: '01012345678',
      taxId: '654-321-987',
      address: 'المنصورة، الدقهلية',
    });

    console.log('✅ Demo inventory seeded successfully!');
  }
}

async function startPosApplication() {
  const db = PosDatabase.getInstance();
  await seedInitialDataIfNeeded(db);

  const server = new PosServer({ port: 3030 });
  const port = await server.start();

  console.log('\n======================================================');
  console.log(`🚀 QuazLink POS Client is Ready!`);
  console.log(`🌐 Open in browser or POS screen: http://localhost:${port}`);
  console.log(`⌨️  Keyboard Shortcuts: F1=Search, F2=Retail/Wholesale, F3=Customer, F12=Pay`);
  console.log('======================================================\n');
}

startPosApplication().catch((err) => {
  console.error('Fatal POS launch error:', err);
  process.exit(1);
});
