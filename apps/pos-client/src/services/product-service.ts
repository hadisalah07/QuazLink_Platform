import { PosDatabase } from '../database/connection.js';
import { Product, ProductSerial, ProductSerialStatus } from '../database/types.js';

export interface CreateProductInput {
  name: string;
  barcode?: string;
  sku?: string;
  categoryId?: string;
  buyPrice: number;
  sellPriceRetail: number;
  sellPriceWholesale?: number;
  stockQuantity?: number;
  minStockAlert?: number;
  unit?: string;
  imageUrl?: string;
  hasSerial?: boolean;
}

export class ProductService {
  private db: PosDatabase;

  constructor(db: PosDatabase) {
    this.db = db;
  }

  public createProduct(input: CreateProductInput): Product {
    const id = this.db.generateId();
    const hasSerialInt = input.hasSerial ? 1 : 0;
    const stock = input.stockQuantity ?? 0;
    const minAlert = input.minStockAlert ?? 3;
    const unit = input.unit || 'قطعة';

    this.db.run(
      `INSERT INTO products (
        id, barcode, sku, name, category_id, buy_price,
        sell_price_retail, sell_price_wholesale, stock_quantity,
        min_stock_alert, unit, image_url, has_serial
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.barcode || null,
        input.sku || null,
        input.name,
        input.categoryId || null,
        input.buyPrice ?? 0.0,
        input.sellPriceRetail,
        input.sellPriceWholesale || null,
        stock,
        minAlert,
        unit,
        input.imageUrl || null,
        hasSerialInt,
      ]
    );

    return this.getProductById(id)!;
  }

  public updateProduct(id: string, input: Partial<CreateProductInput>): Product {
    const existing = this.getProductById(id);
    if (!existing) throw new Error(`Product not found: ${id}`);

    this.db.run(
      `UPDATE products SET
        name = COALESCE(?, name),
        barcode = COALESCE(?, barcode),
        sku = COALESCE(?, sku),
        buy_price = COALESCE(?, buy_price),
        sell_price_retail = COALESCE(?, sell_price_retail),
        sell_price_wholesale = COALESCE(?, sell_price_wholesale),
        min_stock_alert = COALESCE(?, min_stock_alert),
        unit = COALESCE(?, unit),
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        input.name ?? null,
        input.barcode ?? null,
        input.sku ?? null,
        input.buyPrice ?? null,
        input.sellPriceRetail ?? null,
        input.sellPriceWholesale ?? null,
        input.minStockAlert ?? null,
        input.unit ?? null,
        id,
      ]
    );

    return this.getProductById(id)!;
  }

  public getProductMovements(productId: string): {
    id: string;
    type: string;
    quantity: number;
    balanceAfter: number;
    referenceId: string | null;
    createdAt: string;
  }[] {
    const rows = this.db.queryAll<any>(
      'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC',
      [productId]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      quantity: r.quantity,
      balanceAfter: r.balance_after,
      referenceId: r.reference_id,
      createdAt: r.created_at,
    }));
  }

  public getProductById(id: string): Product | null {
    const row = this.db.queryOne<any>('SELECT * FROM products WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapProductRow(row);
  }

  public getProductByBarcode(barcode: string): Product | null {
    const row = this.db.queryOne<any>('SELECT * FROM products WHERE barcode = ?', [barcode]);
    if (!row) return null;
    return this.mapProductRow(row);
  }

  public getAllProducts(): Product[] {
    const rows = this.db.queryAll<any>('SELECT * FROM products ORDER BY name ASC');
    return rows.map((r) => this.mapProductRow(r));
  }

  public getLowStockProducts(): Product[] {
    const rows = this.db.queryAll<any>(
      'SELECT * FROM products WHERE stock_quantity <= min_stock_alert ORDER BY stock_quantity ASC'
    );
    return rows.map((r) => this.mapProductRow(r));
  }

  // --- Serial Number Lifecycle & Electronics Tracking ---

  public addSerialNumbers(productId: string, serialNumbers: string[], warrantyMonths = 12): ProductSerial[] {
    const product = this.getProductById(productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    return this.db.transaction(() => {
      const addedSerials: ProductSerial[] = [];

      for (const sn of serialNumbers) {
        const trimmed = sn.trim();
        if (!trimmed) continue;

        const id = this.db.generateId();
        this.db.run(
          `INSERT INTO product_serials (id, product_id, serial_number, status, warranty_months)
           VALUES (?, ?, ?, 'in_stock', ?)`,
          [id, productId, trimmed, warrantyMonths]
        );

        addedSerials.push(this.getSerialById(id)!);
      }

      // Update product stock based on added serials if product uses serials
      if (product.hasSerial) {
        this.updateStockQuantity(productId, addedSerials.length);
      }

      return addedSerials;
    });
  }

  public getSerialById(id: string): ProductSerial | null {
    const row = this.db.queryOne<any>('SELECT * FROM product_serials WHERE id = ?', [id]);
    if (!row) return null;
    return this.mapSerialRow(row);
  }

  public getSerialByNumber(serialNumber: string): ProductSerial | null {
    const row = this.db.queryOne<any>('SELECT * FROM product_serials WHERE serial_number = ?', [serialNumber.trim()]);
    if (!row) return null;
    return this.mapSerialRow(row);
  }

  public getAvailableSerials(productId: string): ProductSerial[] {
    const rows = this.db.queryAll<any>(
      "SELECT * FROM product_serials WHERE product_id = ? AND status = 'in_stock' ORDER BY created_at ASC",
      [productId]
    );
    return rows.map((r) => this.mapSerialRow(r));
  }

  public updateStockQuantity(productId: string, delta: number): void {
    this.db.run("UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now') WHERE id = ?", [
      delta,
      productId,
    ]);
  }

  private mapProductRow(r: any): Product {
    return {
      id: r.id,
      barcode: r.barcode,
      sku: r.sku,
      name: r.name,
      categoryId: r.category_id,
      buyPrice: r.buy_price,
      sellPriceRetail: r.sell_price_retail,
      sellPriceWholesale: r.sell_price_wholesale,
      stockQuantity: r.stock_quantity,
      minStockAlert: r.min_stock_alert,
      unit: r.unit,
      imageUrl: r.image_url,
      hasSerial: Boolean(r.has_serial),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapSerialRow(r: any): ProductSerial {
    return {
      id: r.id,
      productId: r.product_id,
      serialNumber: r.serial_number,
      status: r.status as ProductSerialStatus,
      invoiceId: r.invoice_id,
      returnInvoiceId: r.return_invoice_id,
      warrantyMonths: r.warranty_months,
      soldAt: r.sold_at,
      returnedAt: r.returned_at,
      createdAt: r.created_at,
    };
  }
}
