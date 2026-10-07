import { MonochromeCanvas } from './monochrome-canvas.js';
import { PrinterConfig, RasterResult, ReceiptData } from './types.js';
import { EtaService } from '../services/eta-service.js';

export class ReceiptTemplate {
  private config: PrinterConfig;

  constructor(config: PrinterConfig) {
    this.config = config;
  }

  /**
   * Builds the complete thermal receipt and converts it into pure ESC/POS Raster command bytes
   * Target execution duration: < 50ms
   */
  public renderToRaster(data: ReceiptData): RasterResult {
    const startTime = performance.now();
    const width = this.config.dotWidth || (this.config.width === '80mm' ? 576 : 384);
    const canvas = new MonochromeCanvas(width, 600);

    let curY = 20;

    // 1. ترويسة المتجر (Store Header)
    curY = canvas.drawText(data.storeName, 0, curY, 3, 'center');
    curY += 8;

    if (data.storePhone) {
      curY = canvas.drawText(`Tel: ${data.storePhone}`, 0, curY, 2, 'center');
      curY += 4;
    }

    if (data.taxNumber) {
      curY = canvas.drawText(`Tax Reg: ${data.taxNumber}`, 0, curY, 1, 'center');
      curY += 4;
    }

    curY += 8;
    canvas.drawDashedLine(curY);
    curY += 14;

    // 2. بيانات الفاتورة (Invoice Meta)
    curY = canvas.drawDualColumnText(`Invoice: ${data.invoiceNumber}`, `Date: ${data.dateStr}`, curY, 1);
    curY += 6;

    if (data.cashierName) {
      curY = canvas.drawText(`Cashier: ${data.cashierName}`, 16, curY, 1, 'left');
      curY += 6;
    }

    canvas.drawHorizontalLine(curY, 2);
    curY += 10;

    // 3. ترويسة جدول الأصناف (Items Table Header)
    curY = canvas.drawItemRow('Item', 'Qty', 'Price', 'Total', curY, 2);
    curY += 6;
    canvas.drawDashedLine(curY);
    curY += 10;

    // 4. بنود الفاتورة والسيريالات (Line Items & Serials)
    for (const item of data.items) {
      const priceStr = item.unitPrice.toFixed(0);
      const totalStr = item.totalPrice.toFixed(0);
      curY = canvas.drawItemRow(item.name, `${item.quantity}`, priceStr, totalStr, curY, 2);
      curY += 4;

      // طباعة السيريال للأجهزة والكمبيوتر
      if (item.serialNumber) {
        curY = canvas.drawText(`  [S/N: ${item.serialNumber}]`, 16, curY, 1, 'left');
        curY += 4;
      }
    }

    curY += 6;
    canvas.drawDashedLine(curY);
    curY += 12;

    // 5. الملخص المالي والضرائب (Financial Summary)
    const currency = data.currency || 'EGP';
    curY = canvas.drawDualColumnText('Subtotal', `${data.subtotal.toFixed(2)} ${currency}`, curY, 2);
    curY += 6;

    if (data.discountAmount > 0) {
      curY = canvas.drawDualColumnText('Discount', `-${data.discountAmount.toFixed(2)} ${currency}`, curY, 2);
      curY += 6;
    }

    if (data.taxVat14 > 0) {
      curY = canvas.drawDualColumnText('VAT (14%)', `+${data.taxVat14.toFixed(2)} ${currency}`, curY, 2);
      curY += 6;
    }

    curY += 4;
    canvas.drawHorizontalLine(curY, 3);
    curY += 12;

    // الصافي النهائي (Final Amount - Bold Scale 3)
    curY = canvas.drawDualColumnText('NET TOTAL', `${data.finalAmount.toFixed(2)} ${currency}`, curY, 3);
    curY += 8;
    canvas.drawHorizontalLine(curY, 3);
    curY += 12;

    curY = canvas.drawDualColumnText('Paid', `${data.paidAmount.toFixed(2)} ${currency}`, curY, 2);
    curY += 6;

    if (data.remainingAmount > 0) {
      curY = canvas.drawDualColumnText('Remaining Debt', `${data.remainingAmount.toFixed(2)} ${currency}`, curY, 2);
      curY += 6;
    } else {
      const change = Math.max(0, data.paidAmount - data.finalAmount);
      curY = canvas.drawDualColumnText('Change', `${change.toFixed(2)} ${currency}`, curY, 2);
      curY += 6;
    }

    curY += 8;
    canvas.drawDashedLine(curY);
    curY += 14;

    // 6. كود الفاتورة الإلكترونية المعتمد من مصلحة الضرائب المصرية (ETA E-Receipt QR)
    if (data.qrPayload) {
      curY += 4;
      curY = canvas.drawText('--- ETA E-RECEIPT ---', 0, curY, 1, 'center');
      curY += 6;
      const etaService = new EtaService({} as any);
      const matrix = etaService.generateQrMatrix(data.qrPayload);
      const qrSize = this.config.width === '58mm' ? 120 : 150;
      curY = canvas.drawQrMatrix(matrix, curY, qrSize);
      curY += 8;
    }

    // 7. تذييل الفاتورة وسياسة الاسترجاع (Receipt Footer)
    const footer = data.footerText || 'Thank you for shopping! Returns within 14 days with receipt.';
    curY = canvas.drawText(footer, 0, curY, 1, 'center');
    curY += 10;
    curY = canvas.drawText('Powered by QuazLink Retail OS', 0, curY, 1, 'center');
    curY += 30; // Feed buffer before cut

    const totalHeight = curY;
    const escposCommands = canvas.toEscposRaster(totalHeight, {
      openCashDrawer: this.config.openCashDrawer ?? true,
      cutPaper: this.config.cutPaper ?? true,
    });
    const rasterBytes = canvas.toBmpBuffer(totalHeight);

    const durationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      width,
      height: totalHeight,
      rasterBytes,
      escposCommands,
      durationMs,
    };
  }
}
