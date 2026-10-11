const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function rawToBmp24(width, height, rawRgbBuffer) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  // 1. BMP File Header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt16LE(0, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt32LE(54, 10); // Offset to pixel data

  // 2. DIB Header / BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14); // Header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // Positive height = bottom-to-top order
  buf.writeUInt16LE(1, 26); // Color planes
  buf.writeUInt16LE(24, 28); // Bits per pixel (24-bit RGB)
  buf.writeUInt32LE(0, 30); // Compression (0 = BI_RGB uncompressed)
  buf.writeUInt32LE(pixelArraySize, 34); // Image size
  buf.writeInt32LE(2835, 38); // Horizontal resolution (72 DPI)
  buf.writeInt32LE(2835, 42); // Vertical resolution
  buf.writeUInt32LE(0, 46); // Color palette colors
  buf.writeUInt32LE(0, 50); // Important colors

  // 3. Write rows in bottom-up order, BGR byte sequence, 4-byte row padding
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 3;
      const r = rawRgbBuffer[srcIdx];
      const g = rawRgbBuffer[srcIdx + 1];
      const b = rawRgbBuffer[srcIdx + 2];
      const destIdx = 54 + y * rowSize + x * 3;
      buf[destIdx] = b;
      buf[destIdx + 1] = g;
      buf[destIdx + 2] = r;
    }
    // Pad remaining bytes in the row to 0
    for (let p = width * 3; p < rowSize; p++) {
      buf[54 + y * rowSize + p] = 0;
    }
  }

  return buf;
}

// SVG design for 164 x 314 px sidebar
const sidebarSvg = `
<svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="45%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- Cyan Glow -->
    <radialGradient id="glowCyan" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>
    </radialGradient>

    <!-- Indigo Glow Bottom -->
    <radialGradient id="glowIndigo" cx="50%" cy="85%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>

    <!-- Metallic Shield -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>

    <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="164" height="314" fill="url(#bgGrad)"/>
  <rect width="164" height="314" fill="url(#glowCyan)"/>
  <rect width="164" height="314" fill="url(#glowIndigo)"/>

  <!-- High-Tech Grid Accent Lines -->
  <line x1="0" y1="40" x2="164" y2="40" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>
  <line x1="0" y1="120" x2="164" y2="120" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>
  <line x1="0" y1="200" x2="164" y2="200" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>
  <line x1="0" y1="280" x2="164" y2="280" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>
  
  <line x1="40" y1="0" x2="40" y2="314" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>
  <line x1="124" y1="0" x2="124" y2="314" stroke="#334155" stroke-width="0.75" stroke-opacity="0.3" stroke-dasharray="3,3"/>

  <!-- Top Accent Neon Bar -->
  <rect x="20" y="22" width="124" height="2" rx="1" fill="#06b6d4" opacity="0.8"/>

  <!-- Central Shield / Badge Container -->
  <g transform="translate(42, 48)">
    <!-- Outer Glow -->
    <rect x="-4" y="-4" width="88" height="88" rx="20" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-opacity="0.6"/>
    <!-- Card Inner -->
    <rect x="0" y="0" width="80" height="80" rx="16" fill="url(#shieldGrad)" stroke="#38bdf8" stroke-width="1"/>
    
    <!-- Lightning Bolt Symbol (QuazLink Logo) -->
    <path d="M44 14 L22 44 L38 44 L32 66 L58 36 L42 36 Z" fill="url(#boltGrad)"/>
  </g>

  <!-- Typography -->
  <!-- Brand Name -->
  <text x="82" y="160" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">QuazLink</text>
  
  <!-- Subtitle Tag -->
  <g transform="translate(24, 172)">
    <rect x="0" y="0" width="116" height="20" rx="10" fill="#06b6d4" fill-opacity="0.15" stroke="#06b6d4" stroke-width="1" stroke-opacity="0.5"/>
    <text x="58" y="14" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="800" fill="#38bdf8" text-anchor="middle" letter-spacing="1">POS &amp; RETAIL ERP</text>
  </g>

  <!-- Features Mini List / Bullet Badges -->
  <g transform="translate(18, 212)">
    <!-- Bullet 1 -->
    <circle cx="6" cy="6" r="3" fill="#10b981"/>
    <text x="16" y="10" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="600" fill="#cbd5e1">Offline-First Engine</text>

    <!-- Bullet 2 -->
    <circle cx="6" cy="22" r="3" fill="#06b6d4"/>
    <text x="16" y="26" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="600" fill="#cbd5e1">Dual-OS Win7 / 10 / 11</text>

    <!-- Bullet 3 -->
    <circle cx="6" cy="38" r="3" fill="#6366f1"/>
    <text x="16" y="42" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="600" fill="#cbd5e1">Cloud Auto-Sync</text>
  </g>

  <!-- Bottom Version & Security Seal -->
  <rect x="14" y="280" width="136" height="18" rx="4" fill="#0f172a" stroke="#334155" stroke-width="0.8"/>
  <text x="82" y="293" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="700" fill="#94a3b8" text-anchor="middle">OFFICIAL ENTERPRISE OS</text>
</svg>
`;

// SVG design for 150 x 57 px header
const headerSvg = `
<svg width="150" height="57" viewBox="0 0 150 57" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headerBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="boltGradH" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>

  <rect width="150" height="57" fill="url(#headerBg)"/>
  <line x1="0" y1="56" x2="150" y2="56" stroke="#06b6d4" stroke-width="1.5"/>

  <!-- Logo Icon -->
  <g transform="translate(10, 8)">
    <rect x="0" y="0" width="40" height="40" rx="8" fill="#1e293b" stroke="#06b6d4" stroke-width="1"/>
    <path d="M22 7 L11 22 L19 22 L16 33 L29 18 L21 18 Z" fill="url(#boltGradH)"/>
  </g>

  <!-- Brand Name & Badge -->
  <text x="58" y="25" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff">QuazLink</text>
  <text x="58" y="40" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#38bdf8">POS &amp; ERP SETUP</text>
</svg>
`;

async function main() {
  const outDir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Rendering installerSidebar.bmp (164x314)...');
  const sidebarRaw = await sharp(Buffer.from(sidebarSvg))
    .resize(164, 314)
    .removeAlpha()
    .raw()
    .toBuffer();
  const sidebarBmp = rawToBmp24(164, 314, sidebarRaw);
  fs.writeFileSync(path.join(outDir, 'installerSidebar.bmp'), sidebarBmp);
  fs.writeFileSync(path.join(outDir, 'uninstallerSidebar.bmp'), sidebarBmp);

  console.log('Rendering installerHeader.bmp (150x57)...');
  const headerRaw = await sharp(Buffer.from(headerSvg))
    .resize(150, 57)
    .removeAlpha()
    .raw()
    .toBuffer();
  const headerBmp = rawToBmp24(150, 57, headerRaw);
  fs.writeFileSync(path.join(outDir, 'installerHeader.bmp'), headerBmp);

  console.log('✅ NSIS Custom Branded Bitmaps generated successfully in build/');
}

main().catch(console.error);
