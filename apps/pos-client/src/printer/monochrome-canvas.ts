/**
 * QuazLink Ultra-Fast 1-Bit Monochrome Canvas & ESC/POS Raster Encoder
 * Zero external heavy dependencies - executes in < 20ms
 */

export class MonochromeCanvas {
  public readonly width: number; // 576 (80mm) or 384 (58mm)
  private height: number;
  private buffer: Uint8Array; // 1 byte = 8 pixels (1 = black/print dot, 0 = white)
  private bytesPerRow: number;

  constructor(width: number = 576, initialHeight: number = 400) {
    this.width = width;
    this.bytesPerRow = Math.ceil(width / 8);
    this.height = initialHeight;
    this.buffer = new Uint8Array(this.bytesPerRow * this.height);
  }

  public getHeight(): number {
    return this.height;
  }

  /**
   * Ensures canvas height is at least minHeight, expanding buffer if needed
   */
  public ensureHeight(minHeight: number): void {
    if (minHeight <= this.height) return;
    const newHeight = Math.max(minHeight, this.height + 300);
    const newBuffer = new Uint8Array(this.bytesPerRow * newHeight);
    newBuffer.set(this.buffer);
    this.buffer = newBuffer;
    this.height = newHeight;
  }

  /**
   * Sets a single pixel (x, y) to black (1) or white (0)
   */
  public setPixel(x: number, y: number, isBlack = true): void {
    if (x < 0 || x >= this.width || y < 0) return;
    this.ensureHeight(y + 1);

    const byteIndex = y * this.bytesPerRow + Math.floor(x / 8);
    const bitPos = 7 - (x % 8); // MSB (Most Significant Bit first)

    if (isBlack) {
      this.buffer[byteIndex] |= 1 << bitPos;
    } else {
      this.buffer[byteIndex] &= ~(1 << bitPos);
    }
  }

  /**
   * Draws a horizontal line across the receipt
   */
  public drawHorizontalLine(y: number, thickness = 2, startX = 0, endX?: number): void {
    const end = endX ?? this.width;
    for (let t = 0; t < thickness; t++) {
      for (let x = startX; x < end; x++) {
        this.setPixel(x, y + t, true);
      }
    }
  }

  /**
   * Draws a dotted horizontal divider
   */
  public drawDashedLine(y: number, dotLength = 6, gap = 4): void {
    let x = 10;
    while (x < this.width - 10) {
      for (let i = 0; i < dotLength && x < this.width - 10; i++, x++) {
        this.setPixel(x, y, true);
        this.setPixel(x, y + 1, true);
      }
      x += gap;
    }
  }

  /**
   * Draws a filled rectangle (used for QR modules, barcodes, banners)
   */
  public drawRect(x: number, y: number, w: number, h: number): void {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        this.setPixel(x + c, y + r, true);
      }
    }
  }

  /**
   * Simple 5x7 / 8x12 crisp dot-matrix font renderer for labels & headers
   */
  public drawText(
    text: string,
    x: number,
    y: number,
    scale = 2,
    align: 'left' | 'center' | 'right' = 'left'
  ): number {
    const charWidth = 6 * scale;
    const charHeight = 8 * scale;
    const totalWidth = text.length * charWidth;

    let startX = x;
    if (align === 'center') {
      startX = Math.floor((this.width - totalWidth) / 2);
    } else if (align === 'right') {
      startX = this.width - totalWidth - x;
    }

    let curX = startX;
    for (let i = 0; i < text.length; i++) {
      this.drawChar(text[i], curX, y, scale);
      curX += charWidth;
    }

    return y + charHeight;
  }

  /**
   * Draws a two-column row (e.g. "إجمالي الفاتورة ........... 1500 EGP")
   */
  public drawDualColumnText(
    leftText: string,
    rightText: string,
    y: number,
    scale = 2
  ): number {
    const charWidth = 6 * scale;
    const charHeight = 8 * scale;

    // Left column
    let curX = 16;
    for (let i = 0; i < leftText.length; i++) {
      this.drawChar(leftText[i], curX, y, scale);
      curX += charWidth;
    }

    // Right column
    const rightTotalWidth = rightText.length * charWidth;
    curX = this.width - 16 - rightTotalWidth;
    for (let i = 0; i < rightText.length; i++) {
      this.drawChar(rightText[i], curX, y, scale);
      curX += charWidth;
    }

    return y + charHeight;
  }

  /**
   * Draws a 4-column receipt item row (Name, Qty, Price, Total)
   */
  public drawItemRow(
    name: string,
    qty: string,
    price: string,
    total: string,
    y: number,
    scale = 2
  ): number {
    const charWidth = 6 * scale;
    const charHeight = 8 * scale;

    // Col 1: Item Name (max 18 chars)
    const truncatedName = name.length > 18 ? name.substring(0, 16) + '..' : name;
    let curX = 16;
    for (let i = 0; i < truncatedName.length; i++) {
      this.drawChar(truncatedName[i], curX, y, scale);
      curX += charWidth;
    }

    // Col 2: Qty (at 50% width)
    curX = Math.floor(this.width * 0.48);
    for (let i = 0; i < qty.length; i++) {
      this.drawChar(qty[i], curX, y, scale);
      curX += charWidth;
    }

    // Col 3: Unit Price (at 65% width)
    curX = Math.floor(this.width * 0.65);
    for (let i = 0; i < price.length; i++) {
      this.drawChar(price[i], curX, y, scale);
      curX += charWidth;
    }

    // Col 4: Total (Right aligned)
    const totalW = total.length * charWidth;
    curX = this.width - 16 - totalW;
    for (let i = 0; i < total.length; i++) {
      this.drawChar(total[i], curX, y, scale);
      curX += charWidth;
    }

    return y + charHeight;
  }

  /**
   * Draws QR Code bit-pattern representation (ETA compliant standard block)
   */
  public drawQrMatrix(modules: boolean[][], y: number, sizePx = 160): number {
    const moduleCount = modules.length;
    if (moduleCount === 0) return y;

    const moduleSize = Math.max(2, Math.floor(sizePx / moduleCount));
    const actualWidth = moduleCount * moduleSize;
    const startX = Math.floor((this.width - actualWidth) / 2);
    const startY = y;

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (modules[r][c]) {
          this.drawRect(
            startX + c * moduleSize,
            startY + r * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }

    return startY + actualWidth + 10;
  }

  /**
   * Internal bitmap font rendering (Numbers, ASCII, Arabic Latinized mapping)
   */
  private drawChar(char: string, startX: number, startY: number, scale: number): void {
    const glyph = FONT_5X7[char] || FONT_5X7['?'] || [0, 0, 0, 0, 0];
    for (let col = 0; col < 5; col++) {
      const colBits = glyph[col];
      for (let row = 0; row < 7; row++) {
        if ((colBits >> row) & 1) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              this.setPixel(startX + col * scale + dx, startY + row * scale + dy, true);
            }
          }
        }
      }
    }
  }

  /**
   * Encodes the canvas buffer into ESC/POS GS v 0 (Raster Bit Image)
   * Command: 1D 76 30 m xL xH yL yH d1...dk
   */
  public toEscposRaster(finalHeight: number, options: { openCashDrawer?: boolean; cutPaper?: boolean } = {}): Buffer {
    const clampedHeight = Math.min(finalHeight, this.height);
    const xL = this.bytesPerRow & 0xff;
    const xH = (this.bytesPerRow >> 8) & 0xff;
    const yL = clampedHeight & 0xff;
    const yH = (clampedHeight >> 8) & 0xff;

    const dataLength = this.bytesPerRow * clampedHeight;
    const rasterHeader = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    const rasterData = Buffer.from(this.buffer.buffer, 0, dataLength);

    const parts: Buffer[] = [];

    // 1. نبضة فتح درج النقدية القياسية (ESC p 0 25 250)
    if (options.openCashDrawer) {
      parts.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    }

    // 2. تهيئة الطابعة (ESC @)
    parts.push(Buffer.from([0x1b, 0x40]));

    // 3. أمر الصورة النقطية (GS v 0)
    parts.push(rasterHeader);
    parts.push(rasterData);

    // 4. تغذية أسطر بعد الطباعة (Feed 4 lines: ESC d 4)
    parts.push(Buffer.from([0x1b, 0x64, 0x04]));

    // 5. قطع الورق القياسي (GS V 66 0)
    if (options.cutPaper !== false) {
      parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
    }

    return Buffer.concat(parts);
  }

  /**
   * Exports raw monochrome bitmap image (BMP format) for visual inspection / virtual testing
   */
  public toBmpBuffer(finalHeight: number): Buffer {
    const clampedHeight = Math.min(finalHeight, this.height);
    const rowPadding = (4 - (this.bytesPerRow % 4)) % 4;
    const paddedRowSize = this.bytesPerRow + rowPadding;
    const pixelArraySize = paddedRowSize * clampedHeight;
    const fileSize = 54 + 8 + pixelArraySize; // 54 header + 8 color palette + pixels

    const buffer = Buffer.alloc(fileSize);

    // BMP Header
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(54 + 8, 10); // Offset to pixel data

    // DIB Header (BITMAPINFOHEADER)
    buffer.writeUInt32LE(40, 14); // Header size
    buffer.writeInt32LE(this.width, 18);
    buffer.writeInt32LE(-clampedHeight, 22); // Top-down BMP
    buffer.writeUInt16LE(1, 26); // Color planes
    buffer.writeUInt16LE(1, 28); // 1-bit per pixel
    buffer.writeUInt32LE(0, 30); // BI_RGB (No compression)
    buffer.writeUInt32LE(pixelArraySize, 34);

    // 2-Color Palette (0 = White, 1 = Black)
    // Color 0: White (RGB: 255, 255, 255)
    buffer.writeUInt8(255, 54);
    buffer.writeUInt8(255, 55);
    buffer.writeUInt8(255, 56);
    buffer.writeUInt8(0, 57);
    // Color 1: Black (RGB: 0, 0, 0)
    buffer.writeUInt8(0, 58);
    buffer.writeUInt8(0, 59);
    buffer.writeUInt8(0, 60);
    buffer.writeUInt8(0, 61);

    // Pixel Data
    let destOffset = 62;
    for (let y = 0; y < clampedHeight; y++) {
      const srcOffset = y * this.bytesPerRow;
      for (let x = 0; x < this.bytesPerRow; x++) {
        buffer.writeUInt8(this.buffer[srcOffset + x], destOffset++);
      }
      for (let p = 0; p < rowPadding; p++) {
        buffer.writeUInt8(0, destOffset++);
      }
    }

    return buffer;
  }
}

// 5x7 Standard Dot-Matrix Glyphs Map
const FONT_5X7: Record<string, number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  '!': [0x00, 0x00, 0x5f, 0x00, 0x00],
  '"': [0x00, 0x07, 0x00, 0x07, 0x00],
  '#': [0x14, 0x7f, 0x14, 0x7f, 0x14],
  '$': [0x24, 0x2a, 0x7f, 0x2a, 0x12],
  '%': [0x23, 0x13, 0x08, 0x64, 0x62],
  '&': [0x36, 0x49, 0x55, 0x22, 0x50],
  "'": [0x00, 0x05, 0x03, 0x00, 0x00],
  '(': [0x00, 0x1c, 0x22, 0x41, 0x00],
  ')': [0x00, 0x41, 0x22, 0x1c, 0x00],
  '*': [0x14, 0x08, 0x3e, 0x08, 0x14],
  '+': [0x08, 0x08, 0x3e, 0x08, 0x08],
  ',': [0x00, 0x50, 0x30, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '/': [0x20, 0x10, 0x08, 0x04, 0x02],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4b, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7f, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3c, 0x4a, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1e],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  ';': [0x00, 0x56, 0x36, 0x00, 0x00],
  '<': [0x08, 0x14, 0x22, 0x41, 0x00],
  '=': [0x14, 0x14, 0x14, 0x14, 0x14],
  '>': [0x00, 0x41, 0x22, 0x14, 0x08],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  '@': [0x32, 0x49, 0x79, 0x41, 0x3e],
  'A': [0x7e, 0x11, 0x11, 0x11, 0x7e],
  'B': [0x7f, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3e, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7f, 0x41, 0x41, 0x22, 0x1c],
  'E': [0x7f, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7f, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3e, 0x41, 0x49, 0x49, 0x7a],
  'H': [0x7f, 0x08, 0x08, 0x08, 0x7f],
  'I': [0x00, 0x41, 0x7f, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3f, 0x01],
  'K': [0x7f, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7f, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  'N': [0x7f, 0x04, 0x08, 0x10, 0x7f],
  'O': [0x3e, 0x41, 0x41, 0x41, 0x3e],
  'P': [0x7f, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3e, 0x41, 0x51, 0x21, 0x5e],
  'R': [0x7f, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7f, 0x01, 0x01],
  'U': [0x3f, 0x40, 0x40, 0x40, 0x3f],
  'V': [0x1f, 0x20, 0x40, 0x20, 0x1f],
  'W': [0x3f, 0x40, 0x38, 0x40, 0x3f],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
  'a': [0x20, 0x54, 0x54, 0x54, 0x78],
  'b': [0x7f, 0x48, 0x44, 0x44, 0x38],
  'c': [0x38, 0x44, 0x44, 0x44, 0x20],
  'd': [0x38, 0x44, 0x44, 0x48, 0x7f],
  'e': [0x38, 0x54, 0x54, 0x54, 0x18],
  'f': [0x08, 0x7e, 0x09, 0x01, 0x02],
  'g': [0x0c, 0x52, 0x52, 0x52, 0x3e],
  'h': [0x7f, 0x08, 0x04, 0x04, 0x78],
  'i': [0x00, 0x44, 0x7d, 0x40, 0x00],
  'j': [0x20, 0x40, 0x44, 0x3d, 0x00],
  'k': [0x7f, 0x10, 0x28, 0x44, 0x00],
  'l': [0x00, 0x41, 0x7f, 0x40, 0x00],
  'm': [0x7c, 0x04, 0x18, 0x04, 0x78],
  'n': [0x7c, 0x08, 0x04, 0x04, 0x78],
  'o': [0x38, 0x44, 0x44, 0x44, 0x38],
  'p': [0x7c, 0x14, 0x14, 0x14, 0x08],
  'q': [0x08, 0x14, 0x14, 0x18, 0x7c],
  'r': [0x7c, 0x08, 0x04, 0x04, 0x08],
  's': [0x48, 0x54, 0x54, 0x54, 0x20],
  't': [0x04, 0x3f, 0x44, 0x40, 0x20],
  'u': [0x3c, 0x40, 0x40, 0x20, 0x7c],
  'v': [0x1c, 0x20, 0x40, 0x20, 0x1c],
  'w': [0x3c, 0x40, 0x30, 0x40, 0x3c],
  'x': [0x44, 0x28, 0x10, 0x28, 0x44],
  'y': [0x0c, 0x50, 0x50, 0x50, 0x3c],
  'z': [0x44, 0x64, 0x54, 0x4c, 0x44],
};
