import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import { PrinterConfig, RasterResult, ReceiptData } from './types.js';
import { ReceiptTemplate } from './receipt-template.js';

export class PrinterService {
  private config: PrinterConfig;
  private template: ReceiptTemplate;

  constructor(config?: Partial<PrinterConfig>) {
    this.config = {
      width: config?.width || '80mm',
      dotWidth: config?.dotWidth || (config?.width === '58mm' ? 384 : 576),
      type: config?.type || 'virtual',
      networkHost: config?.networkHost || '192.168.1.200',
      networkPort: config?.networkPort || 9100,
      openCashDrawer: config?.openCashDrawer ?? true,
      cutPaper: config?.cutPaper ?? true,
    };
    this.template = new ReceiptTemplate(this.config);
  }

  /**
   * Generates the ESC/POS raster and dispatches to the configured printer target
   */
  public async printReceipt(data: ReceiptData, outputDir?: string): Promise<RasterResult> {
    const result = this.template.renderToRaster(data);

    if (this.config.type === 'network' && this.config.networkHost) {
      await this.sendToNetworkPrinter(result.escposCommands);
    } else {
      // Virtual mode: Save BMP image & raw commands for verification
      const targetDir = outputDir || process.env.QUAZLINK_RECEIPTS_DIR || path.join(process.cwd(), '.receipts');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const baseName = `receipt_${data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const bmpPath = path.join(targetDir, `${baseName}.bmp`);
      const rawPath = path.join(targetDir, `${baseName}.bin`);

      fs.writeFileSync(bmpPath, result.rasterBytes);
      fs.writeFileSync(rawPath, result.escposCommands);
    }

    return result;
  }

  private sendToNetworkPrinter(commands: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(this.config.networkPort || 9100, this.config.networkHost!, () => {
        socket.write(commands, () => {
          socket.end();
          resolve();
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(new Error(`Failed to send to network printer [${this.config.networkHost}]: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Connection to network printer [${this.config.networkHost}] timed out.`));
      });
    });
  }
}
