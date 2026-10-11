/**
 * QuazLink Retail POS & ERP - Client Engine
 * Keyboard-First, Barcode HID Listener, Serial Prompt Guard & Real-Time Checkout
 */

// Application State
const state = {
  cart: [], // { product, quantity, unitPrice, serialNumber }
  priceType: 'retail', // 'retail' | 'wholesale'
  discountAmount: 0,
  applyVat14: false,
  paymentMethod: 'cash',
  paidAmount: 0,
  customer: null, // { id, name, phone }
  pendingSerialProduct: null, // Product awaiting serial prompt confirmation
};

let lastCompletedInvoiceId = null;
let lastCustomerPhone = '';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initZoomControls();
  initGlobalBarcodeListener();
  initKeyboardShortcuts();
  loadQuickProducts();
  refreshLowStockCount();
  initAppSettings();
  focusSearch();
  setTimeout(autoCheckForUpdatesOnStartup, 1500);
  // Periodic background check every 15 minutes for live update notifications
  setInterval(autoCheckForUpdatesOnStartup, 15 * 60 * 1000);
});


// Floating Modern Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.log(`[${type}] ${message}`);
    return;
  }
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span style="font-size:1rem;">${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3200);
}

// Live Clock Ticker
function initClock() {
  const clockEl = document.getElementById('liveClock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  };
  update();
  setInterval(update, 1000);
}

// -------------------------------------------------------------
// 1. Global Barcode HID Listener with Focus Loss Protection
// -------------------------------------------------------------
let barcodeBuffer = '';
let lastKeyTime = 0;

function initGlobalBarcodeListener() {
  window.addEventListener('keydown', (e) => {
    const currentTime = performance.now();
    const timeDiff = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    // Barcode scanner sends bursts with very small interval (< 35ms)
    const isRapid = timeDiff < 40;

    // Check if Enter pressed
    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 3 && (isRapid || document.activeElement.id === 'barcodeInput')) {
        e.preventDefault();
        const scannedCode = barcodeBuffer.trim();
        barcodeBuffer = '';
        handleBarcodeScanned(scannedCode);
        return;
      }
      barcodeBuffer = '';
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (isRapid || barcodeBuffer.length === 0) {
        barcodeBuffer += e.key;
      } else {
        // Human typing slowly outside scanner input
        barcodeBuffer = e.key;
      }
    }
  });

  // Regular input enter listener
  const inputEl = document.getElementById('barcodeInput');
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inputEl.value.trim()) {
      e.preventDefault();
      handleBarcodeScanned(inputEl.value.trim());
      inputEl.value = '';
    }
  });
}

// -------------------------------------------------------------
// 2. Keyboard-First Shortcuts (F1 - F12)
// -------------------------------------------------------------
function initKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // F1: Focus Search
    if (e.key === 'F1') {
      e.preventDefault();
      focusSearch();
    }
    // F2: Toggle Retail / Wholesale
    else if (e.key === 'F2') {
      e.preventDefault();
      togglePriceType();
    }
    // F3: Customer Search
    else if (e.key === 'F3') {
      e.preventDefault();
      openCustomerModal();
    }
    // F4: Edit Quantity of Last Item
    else if (e.key === 'F4') {
      e.preventDefault();
      editLastItemQuantity();
    }
    // F8: Shift & Cash Drawer Control
    else if (e.key === 'F8') {
      e.preventDefault();
      if (appSettingsCache.enable_shifts === 'true') {
        openShiftControlModal();
      }
    }
    // F9: Quick Discount
    else if (e.key === 'F9') {
      e.preventDefault();
      openDiscountModal();
    }

    // F12: Instant Checkout & Print
    else if (e.key === 'F12') {
      e.preventDefault();
      handleCheckout(true);
    }
    // Escape: Close Modals or Clear
    else if (e.key === 'Escape') {
      e.preventDefault();
      closeAllModals();
    }
    // Zoom In: Ctrl + = or Ctrl + + or NumpadAdd (Windows 7 / Arabic Keyboards supported)
    else if (
      e.ctrlKey &&
      (e.key === '=' ||
        e.key === '+' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd' ||
        e.keyCode === 187 ||
        e.keyCode === 107 ||
        e.keyCode === 61)
    ) {
      e.preventDefault();
      adjustZoom(0.1);
    }
    // Zoom Out: Ctrl + - or Ctrl + _ or NumpadSubtract (Windows 7 / Arabic Keyboards supported)
    else if (
      e.ctrlKey &&
      (e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract' ||
        e.keyCode === 189 ||
        e.keyCode === 109 ||
        e.keyCode === 173)
    ) {
      e.preventDefault();
      adjustZoom(-0.1);
    }
    // Zoom Reset: Ctrl + 0 or Numpad0 or Digit0
    else if (
      e.ctrlKey &&
      (e.key === '0' ||
        e.code === 'Digit0' ||
        e.code === 'Numpad0' ||
        e.keyCode === 48 ||
        e.keyCode === 96)
    ) {
      e.preventDefault();
      resetZoom();
    }
  });

  // Ctrl + Mouse Wheel Zoom (Fast Zoom In / Zoom Out for Cashiers)
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          adjustZoom(0.1);
        } else {
          adjustZoom(-0.1);
        }
      }
    },
    { passive: false }
  );
}

// -------------------------------------------------------------
// Zoom Management Engine (Viewport & Scale Factor)
// -------------------------------------------------------------
let currentAppZoom = 1.0;

function initZoomControls() {
  const savedZoom = parseFloat(localStorage.getItem('quazlink_pos_zoom') || '1.0');
  if (savedZoom && !isNaN(savedZoom) && savedZoom !== 1.0) {
    applyZoom(savedZoom, false);
  }

  // Sync zoom events from Electron Native accelerators
  if (window.electronAPI && typeof window.electronAPI.onZoomChanged === 'function') {
    window.electronAPI.onZoomChanged((factor) => {
      applyZoom(factor, true);
    });
  }
}

function adjustZoom(delta) {
  currentAppZoom = Math.min(2.5, Math.max(0.5, Math.round((currentAppZoom + delta) * 10) / 10));
  applyZoom(currentAppZoom, true);
}

function resetZoom() {
  currentAppZoom = 1.0;
  applyZoom(1.0, true);
}

function applyZoom(factor, notify = true) {
  currentAppZoom = factor;
  if (window.electronAPI && typeof window.electronAPI.setZoomFactor === 'function') {
    window.electronAPI.setZoomFactor(factor);
  }
  document.body.style.zoom = factor;
  localStorage.setItem('quazlink_pos_zoom', String(factor));

  const zoomBadge = document.getElementById('headerZoomLevel');
  if (zoomBadge) zoomBadge.textContent = `${Math.round(factor * 100)}%`;

  if (notify) {
    const pct = Math.round(factor * 100);
    showToast(`🔍 مستوى التكبير: ${pct}%${pct === 100 ? ' (الافتراضي)' : ''}`, pct === 100 ? 'info' : 'success');
  }
}


// -------------------------------------------------------------
// 3. Audio Scanner Feedback (Web Audio API)
// -------------------------------------------------------------
function playBeep(freq = 1200, duration = 0.08) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {}
}

// -------------------------------------------------------------
// 4. Products & Scanning Engine
// -------------------------------------------------------------
async function handleBarcodeScanned(query) {
  try {
    // 1. Try fetching by exact barcode
    let res = await fetch(`/api/products/barcode/${encodeURIComponent(query)}`);
    let data = await res.json();

    if (data.success && data.product) {
      addProductToCartOrPromptSerial(data.product);
      playBeep(1400);
      return;
    }

    // 2. Try general search
    res = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
    data = await res.json();

    if (data.success && data.products && data.products.length > 0) {
      addProductToCartOrPromptSerial(data.products[0]);
      playBeep(1400);
    } else {
      playBeep(400, 0.2); // Error low pitch
      showToast(`لم يتم العثور على أي منتج يطابق: "${query}"`, 'warning');
    }
  } catch (err) {
    console.error('Scan error:', err);
  }
}

// Check if product requires serial or can be added directly
function addProductToCartOrPromptSerial(product) {
  if (product.hasSerial) {
    promptSerialGuard(product);
  } else {
    addItemToCart(product);
  }
}

function addItemToCart(product, serialNumber = null) {
  const price = state.priceType === 'wholesale' && product.sellPriceWholesale
    ? product.sellPriceWholesale
    : product.sellPriceRetail;

  // If item doesn't have serial, increment qty if already in cart
  if (!product.hasSerial) {
    const existing = state.cart.find((i) => i.product.id === product.id && !i.serialNumber);
    if (existing) {
      existing.quantity += 1;
      renderCart();
      return;
    }
  }

  // Serialized items are added individually per serial
  state.cart.push({
    product,
    quantity: 1,
    unitPrice: price,
    serialNumber: serialNumber || null,
  });

  renderCart();
}

// -------------------------------------------------------------
// 5. Serial Prompt Guard Modal
// -------------------------------------------------------------
async function promptSerialGuard(product) {
  state.pendingSerialProduct = product;
  document.getElementById('modalProductName').textContent = product.name;
  const input = document.getElementById('serialInputField');
  input.value = '';

  const listContainer = document.getElementById('availableSerialsList');
  listContainer.innerHTML = '<span class="text-dim">جاري جلب السيريالات المتاحة...</span>';

  document.getElementById('serialModal').classList.add('active');
  input.focus();

  try {
    const res = await fetch(`/api/products/${product.id}/serials`);
    const data = await res.json();

    if (data.success && data.serials && data.serials.length > 0) {
      listContainer.innerHTML = '';
      data.serials.forEach((s) => {
        const chip = document.createElement('div');
        chip.className = 'serial-chip';
        chip.textContent = s.serialNumber;
        chip.onclick = () => {
          input.value = s.serialNumber;
          document.querySelectorAll('.serial-chip').forEach((c) => c.classList.remove('selected'));
          chip.classList.add('selected');
        };
        listContainer.appendChild(chip);
      });
    } else {
      listContainer.innerHTML = '<span class="text-dim" style="color:var(--accent-red)">⚠️ لا توجد سيريالات متاحة في المخزن حالياً لهذا الصنف!</span>';
    }
  } catch (err) {
    listContainer.innerHTML = '<span class="text-dim">تعذر جلب السيريالات</span>';
  }
}

function confirmSerialSelection() {
  const serial = document.getElementById('serialInputField').value.trim();
  if (!serial) {
    showToast('برجاء مسح أو كتابة رقم السيريال أولاً', 'warning');
    return;
  }

  // Check if already in current cart
  const duplicate = state.cart.find((i) => i.serialNumber === serial);
  if (duplicate) {
    showToast(`السيريال [${serial}] مضاف بالفعل في نفس الفاتورة!`, 'warning');
    return;
  }

  if (state.pendingSerialProduct) {
    addItemToCart(state.pendingSerialProduct, serial);
    playBeep(1600);
    closeSerialModal();
  }
}

function closeSerialModal() {
  document.getElementById('serialModal').classList.remove('active');
  state.pendingSerialProduct = null;
  focusSearch();
}

// -------------------------------------------------------------
// 6. Cart Rendering & Calculations
// -------------------------------------------------------------
function renderCart() {
  const tbody = document.getElementById('cartTableBody');
  tbody.innerHTML = '';

  if (state.cart.length === 0) {
    tbody.innerHTML = `
      <tr id="emptyCartRow">
        <td colspan="7" class="empty-state">
          <div class="empty-box">
            <span class="empty-icon">🛒</span>
            <h3>السلة فارغة حالياً</h3>
            <p>ابدأ بمسح باركود المنتج بمسدس الباركود أو اضغط <b>F1</b> للبحث بالاسم والكود</p>
          </div>
        </td>
      </tr>`;
    recalculateTotals();
    return;
  }

  state.cart.forEach((item, index) => {
    const tr = document.createElement('tr');
    const total = item.quantity * item.unitPrice;

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="item-name-cell">${item.product.name}</td>
      <td>${item.serialNumber ? `<span class="serial-badge">S/N: ${item.serialNumber}</span>` : '<span class="text-dim">—</span>'}</td>
      <td>
        <div class="qty-control">
          ${!item.serialNumber ? `<button class="btn-qty" onclick="changeQty(${index}, -1)">-</button>` : ''}
          <span class="qty-number">${item.quantity}</span>
          ${!item.serialNumber ? `<button class="btn-qty" onclick="changeQty(${index}, 1)">+</button>` : ''}
        </div>
      </td>
      <td class="price-text">${item.unitPrice.toFixed(0)}</td>
      <td class="total-text">${total.toFixed(0)}</td>
      <td>
        <button class="btn-delete" onclick="removeItem(${index})">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  recalculateTotals();
}

function changeQty(index, delta) {
  if (state.cart[index]) {
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) {
      state.cart.splice(index, 1);
    }
    renderCart();
  }
}

function removeItem(index) {
  state.cart.splice(index, 1);
  renderCart();
}

function clearCart() {
  if (state.cart.length === 0) return;
  if (confirm('هل أنت متأكد من تفريغ وإلغاء السلة الحالية؟')) {
    state.cart = [];
    state.discountAmount = 0;
    renderCart();
    focusSearch();
  }
}

function recalculateTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  document.getElementById('subtotalVal').textContent = `${subtotal.toFixed(2)} EGP`;

  const discount = state.discountAmount || 0;
  document.getElementById('discountVal').textContent = `-${discount.toFixed(2)} EGP`;

  const taxable = Math.max(0, subtotal - discount);
  const vatCheckbox = document.getElementById('vat14Checkbox');
  const vat14 = vatCheckbox.checked ? Number((taxable * 0.14).toFixed(2)) : 0;
  document.getElementById('vat14Val').textContent = `+${vat14.toFixed(2)} EGP`;

  const finalAmount = Number((taxable + vat14).toFixed(2));
  document.getElementById('finalAmountVal').innerHTML = `${finalAmount.toFixed(2)} <span class="currency">EGP</span>`;

  // Paid & Change
  const paidInput = document.getElementById('paidAmountInput');
  const paid = parseFloat(paidInput.value) || 0;
  const change = paid - finalAmount;

  const changeLabel = document.getElementById('changeLabel');
  const changeVal = document.getElementById('changeVal');

  if (change >= 0) {
    changeLabel.textContent = 'الباقي للزبون:';
    changeVal.textContent = `${change.toFixed(2)} EGP`;
    changeVal.style.color = 'var(--accent-emerald)';
  } else {
    changeLabel.textContent = 'المتبقي (آجل/دين):';
    changeVal.textContent = `${Math.abs(change).toFixed(2)} EGP`;
    changeVal.style.color = 'var(--accent-amber)';
  }
}

// Tender Quick Buttons
function addCash(amount) {
  const paidInput = document.getElementById('paidAmountInput');
  const current = parseFloat(paidInput.value) || 0;
  paidInput.value = (current + amount).toFixed(0);
  recalculateTotals();
}

function setExactCash() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = state.discountAmount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const vatCheckbox = document.getElementById('vat14Checkbox');
  const vat14 = vatCheckbox.checked ? Number((taxable * 0.14).toFixed(2)) : 0;
  const finalAmount = Number((taxable + vat14).toFixed(2));

  document.getElementById('paidAmountInput').value = finalAmount.toFixed(0);
  recalculateTotals();
}

function setPaymentMethod(method) {
  state.paymentMethod = method;
  document.querySelectorAll('.pay-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.method === method);
  });
}

function togglePriceType() {
  state.priceType = state.priceType === 'retail' ? 'wholesale' : 'retail';
  const badge = document.getElementById('priceTypeBadge');
  badge.textContent = state.priceType === 'retail' ? 'قطاعي' : 'جملة';
  badge.style.color = state.priceType === 'wholesale' ? 'var(--accent-cyan)' : '#fff';

  // Update existing cart item prices
  state.cart.forEach((item) => {
    item.unitPrice = state.priceType === 'wholesale' && item.product.sellPriceWholesale
      ? item.product.sellPriceWholesale
      : item.product.sellPriceRetail;
  });
  renderCart();
}

// -------------------------------------------------------------
// 7. Checkout & Print Trigger
// -------------------------------------------------------------
async function handleCheckout(printThermal = true) {
  if (state.cart.length === 0) {
    showToast('السلة فارغة! برجاء مسح صنف واحد على الأقل قبل الدفع.', 'warning');
    focusSearch();
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = state.discountAmount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const vatCheckbox = document.getElementById('vat14Checkbox');
  const vat14 = vatCheckbox.checked ? Number((taxable * 0.14).toFixed(2)) : 0;
  const finalAmount = Number((taxable + vat14).toFixed(2));

  const paidInput = document.getElementById('paidAmountInput');
  const paid = parseFloat(paidInput.value) || finalAmount;

  const payload = {
    contactId: state.customer ? state.customer.id : null,
    paymentMethod: state.paymentMethod,
    discountAmount: discount,
    paidAmount: paid,
    applyVat14: vatCheckbox.checked,
    printReceipt: printThermal,
    items: state.cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      serialNumber: i.serialNumber || undefined,
    })),
  };

  try {
    const res = await fetch('/api/invoices/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.success) {
      showToast(`خطأ أثناء إتمام الفاتورة: ${data.error}`, 'error');
      return;
    }

    playBeep(2000, 0.15); // Success high pitch chime

    lastCompletedInvoiceId = data.invoice.id;
    lastCustomerPhone = state.customer ? state.customer.phone : '';

    // Display Thermal Receipt Preview Modal
    displayReceiptPreview(data.invoice, state.cart, paid, finalAmount);

    // Reset Cart
    state.cart = [];
    state.discountAmount = 0;
    paidInput.value = '';
    renderCart();
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('تعذر الاتصال بسيرفر الكاشير المحلي.', 'error');
  }
}

function displayReceiptPreview(invoice, items, paid, finalAmount) {
  const paper = document.getElementById('receiptPaper');
  let itemsTxt = '';
  items.forEach((item) => {
    itemsTxt += `${item.product.name.padEnd(20)} x${item.quantity}   ${(item.quantity * item.unitPrice).toFixed(0)} EGP\n`;
    if (item.serialNumber) {
      itemsTxt += `  [S/N: ${item.serialNumber}]\n`;
    }
  });

  paper.textContent = `
========================================
    AL-ASHOR COMPUTER & ELECTRONICS
          Tel: 01009876543
========================================
Invoice: ${invoice.invoiceNumber}
Date:    ${new Date(invoice.createdAt).toLocaleString('ar-EG')}
Cashier: POS01
----------------------------------------
Item                     Qty     Total
----------------------------------------
${itemsTxt}----------------------------------------
Subtotal:                ${invoice.subtotal.toFixed(2)} EGP
Discount:               -${invoice.discountAmount.toFixed(2)} EGP
VAT (14%):              +${invoice.taxVat14.toFixed(2)} EGP
========================================
NET TOTAL:               ${invoice.finalAmount.toFixed(2)} EGP
========================================
Paid:                    ${paid.toFixed(2)} EGP
Change:                  ${Math.max(0, paid - finalAmount).toFixed(2)} EGP
----------------------------------------
البضاعة المباعة ترد وتستبدل خلال 14 يوماً
Powered by QuazLink Retail OS
========================================
`;

  const phoneInput = document.getElementById('receiptPhoneInput');
  if (phoneInput) {
    phoneInput.value = lastCustomerPhone || '';
  }

  document.getElementById('receiptModal').classList.add('active');
}

function closeReceiptModal() {
  document.getElementById('receiptModal').classList.remove('active');
  focusSearch();
}

async function sendReceiptWhatsapp() {
  if (!lastCompletedInvoiceId) {
    showToast('لا توجد فاتورة مكتملة للإرسال', 'warning');
    return;
  }

  const phoneInput = document.getElementById('receiptPhoneInput');
  let phone = (phoneInput ? phoneInput.value.trim() : '') || lastCustomerPhone;

  if (!phone) {
    showToast('برجاء كتابة رقم هاتف العميل (واتساب)', 'warning');
    if (phoneInput) phoneInput.focus();
    return;
  }

  try {
    const res = await fetch(`/api/invoices/${lastCompletedInvoiceId}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (data.success && data.whatsappUrl) {
      window.open(data.whatsappUrl, '_blank');
      showToast('تم فتح محادثة الواتساب بنجاح', 'success');
    } else {
      showToast('خطأ أثناء تجهيز رسالة الواتساب: ' + (data.error || ''), 'error');
    }
  } catch (err) {
    showToast('فشل الاتصال بالسيرفر', 'error');
  }
}

// -------------------------------------------------------------
// 8. Customer & Discount Modals
// -------------------------------------------------------------
function openCustomerModal() {
  document.getElementById('customerModal').classList.add('active');
  document.getElementById('customerPhoneInput').focus();
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('active');
  focusSearch();
}

async function searchCustomer() {
  const phone = document.getElementById('customerPhoneInput').value.trim();
  if (!phone) return;

  try {
    const res = await fetch(`/api/contacts?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    if (data.success && data.contact) {
      document.getElementById('customerNameInput').value = data.contact.name;
    }
  } catch (err) {}
}

async function saveCustomer() {
  const phone = document.getElementById('customerPhoneInput').value.trim();
  const name = document.getElementById('customerNameInput').value.trim();

  if (!phone || !name) {
    showToast('برجاء إدخال الاسم ورقم الهاتف', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'customer', name, phone }),
    });
    const data = await res.json();
    if (data.success) {
      state.customer = data.contact;
      document.getElementById('customerNameBadge').textContent = name;
      closeCustomerModal();
    }
  } catch (err) {
    showToast('تعذر حفظ بيانات العميل', 'error');
  }
}

// -------------------------------------------------------------
// Quick Discount & Quantity Modals (No native browser prompts)
// -------------------------------------------------------------
let discountMode = 'amount'; // 'amount' | 'percent'
let pendingQuantityItem = null;

function calculateCartSubtotal() {
  return state.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function openDiscountModal() {
  const subtotal = calculateCartSubtotal();
  if (subtotal === 0 && state.cart.length === 0) {
    showToast('السلة فارغة حالياً! أضف أصنافاً أولاً لتطبيق الخصم.', 'warning');
    return;
  }

  const modal = document.getElementById('discountModal');
  const input = document.getElementById('discountValueInput');
  const preview = document.getElementById('discountSubtotalPreview');

  if (preview) preview.textContent = `${subtotal.toFixed(2)} EGP`;
  discountMode = 'amount';
  updateDiscountModeUI();

  if (input) {
    input.value = state.discountAmount > 0 ? state.discountAmount : '';
  }
  previewDiscountCalculation();
  modal.classList.add('active');
  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 60);
}

function closeDiscountModal() {
  const modal = document.getElementById('discountModal');
  if (modal) modal.classList.remove('active');
  focusSearch();
}

function setDiscountMode(mode) {
  discountMode = mode;
  updateDiscountModeUI();
  previewDiscountCalculation();
  const input = document.getElementById('discountValueInput');
  if (input) input.focus();
}

function updateDiscountModeUI() {
  const btnAmount = document.getElementById('btnDiscountModeAmount');
  const btnPercent = document.getElementById('btnDiscountModePercent');
  const label = document.getElementById('discountInputLabel');
  const unitBadge = document.getElementById('discountUnitBadge');

  if (btnAmount) btnAmount.classList.toggle('active', discountMode === 'amount');
  if (btnPercent) btnPercent.classList.toggle('active', discountMode === 'percent');

  if (discountMode === 'amount') {
    if (label) label.textContent = 'أدخل قيمة الخصم بالجنيه:';
    if (unitBadge) unitBadge.textContent = 'EGP';
  } else {
    if (label) label.textContent = 'أدخل نسبة الخصم المئوية (%):';
    if (unitBadge) unitBadge.textContent = '%';
  }
}

function setQuickDiscount(val, mode) {
  setDiscountMode(mode);
  const input = document.getElementById('discountValueInput');
  if (input) input.value = val;
  previewDiscountCalculation();
}

function previewDiscountCalculation() {
  const subtotal = calculateCartSubtotal();
  const input = document.getElementById('discountValueInput');
  const rawVal = parseFloat(input ? input.value : 0) || 0;

  let calculatedDiscount = 0;
  if (discountMode === 'amount') {
    calculatedDiscount = Math.min(subtotal, Math.max(0, rawVal));
  } else {
    const percent = Math.min(100, Math.max(0, rawVal));
    calculatedDiscount = (subtotal * percent) / 100;
  }

  const netAfterDiscount = Math.max(0, subtotal - calculatedDiscount);

  const calcEl = document.getElementById('discountCalculatedVal');
  const netEl = document.getElementById('discountNetPreviewVal');
  if (calcEl) calcEl.textContent = `${calculatedDiscount.toFixed(2)} EGP`;
  if (netEl) netEl.textContent = `${netAfterDiscount.toFixed(2)} EGP`;
}

function applyDiscountConfirm() {
  const subtotal = calculateCartSubtotal();
  const input = document.getElementById('discountValueInput');
  const rawVal = parseFloat(input ? input.value : 0) || 0;

  let calculatedDiscount = 0;
  if (discountMode === 'amount') {
    calculatedDiscount = Math.min(subtotal, Math.max(0, rawVal));
  } else {
    const percent = Math.min(100, Math.max(0, rawVal));
    calculatedDiscount = (subtotal * percent) / 100;
  }

  state.discountAmount = Math.round(calculatedDiscount * 100) / 100;
  renderCart();
  closeDiscountModal();
  if (state.discountAmount > 0) {
    showToast(`تم تطبيق خصم بقيمة ${state.discountAmount.toFixed(2)} EGP بنجاح`, 'success');
  } else {
    showToast('تم إلغاء الخصم من الفاتورة', 'info');
  }
}

function handleDiscountInputKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyDiscountConfirm();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeDiscountModal();
  }
}

// Quantity Modal Logic
function editLastItemQuantity() {
  if (state.cart.length === 0) {
    showToast('السلة فارغة حالياً!', 'warning');
    return;
  }
  const lastIndex = state.cart.length - 1;
  const item = state.cart[lastIndex];
  if (item.serialNumber) {
    showToast('الأجهزة ذات السيريال تباع كقطعة واحدة لكل سيريال.', 'warning');
    return;
  }
  openQuantityModal(item);
}

function openQuantityModal(item) {
  pendingQuantityItem = item;
  const modal = document.getElementById('quantityModal');
  const title = document.getElementById('quantityModalTitle');
  const desc = document.getElementById('quantityModalDesc');
  const input = document.getElementById('quantityModalInput');

  if (title) title.textContent = `تعديل كمية: ${item.product.name}`;
  if (desc) desc.textContent = `الكمية الحالية: ${item.quantity} (السعر للقطعة: ${item.unitPrice} EGP)`;
  if (input) input.value = item.quantity;

  modal.classList.add('active');
  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 60);
}

function closeQuantityModal() {
  const modal = document.getElementById('quantityModal');
  if (modal) modal.classList.remove('active');
  pendingQuantityItem = null;
  focusSearch();
}

function confirmQuantityModal() {
  if (!pendingQuantityItem) return;
  const input = document.getElementById('quantityModalInput');
  const val = parseInt(input ? input.value : 0, 10);
  if (isNaN(val) || val <= 0) {
    showToast('برجاء إدخال كمية صحيحة أكبر من صفر', 'warning');
    return;
  }
  pendingQuantityItem.quantity = val;
  renderCart();
  closeQuantityModal();
  showToast(`تم تعديل الكمية إلى ${val}`, 'success');
}

function handleQuantityInputKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    confirmQuantityModal();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeQuantityModal();
  }
}

function closeAllModals() {
  document.querySelectorAll('.pos-modal-backdrop').forEach((m) => m.classList.remove('active'));
  focusSearch();
}

function focusSearch() {
  const el = document.getElementById('barcodeInput');
  if (el) el.focus();
}

function clearSearch() {
  const el = document.getElementById('barcodeInput');
  if (el) {
    el.value = '';
    el.focus();
  }
}

// -------------------------------------------------------------
// 9. Quick Products Loader
// -------------------------------------------------------------
async function loadQuickProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success && data.products) {
      const container = document.getElementById('quickChipsContainer');
      container.innerHTML = '';
      data.products.slice(0, 8).forEach((p) => {
        const chip = document.createElement('div');
        chip.className = 'product-chip';
        chip.textContent = `${p.name} (${p.sellPriceRetail}ج)`;
        chip.onclick = () => addProductToCartOrPromptSerial(p);
        container.appendChild(chip);
      });
    }
  } catch (err) {}
}

// =============================================================
// PHASE 3: View Switcher, Inventory Hub, Purchases & CRM/Ledger
// =============================================================

let currentView = 'posView';
let currentCrmTab = 'customer';
let cachedProducts = [];

function switchView(viewId) {
  currentView = viewId;

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });

  // Update views
  document.querySelectorAll('.app-view').forEach((view) => {
    view.classList.toggle('active', view.id === viewId);
  });

  // Toggle shortcuts bar
  const shortcutsBar = document.getElementById('posShortcutsBar');
  if (shortcutsBar) {
    shortcutsBar.style.display = viewId === 'posView' ? 'flex' : 'none';
  }

  // Load view data
  if (viewId === 'posView') {
    loadQuickProducts();
    focusSearch();
  } else if (viewId === 'salesInvoicesView') {
    loadSalesInvoices();
  } else if (viewId === 'inventoryView') {
    loadInventory();
  } else if (viewId === 'purchasesView') {
    loadPurchases();
  } else if (viewId === 'crmView') {
    switchCrmTab(currentCrmTab);
  } else if (viewId === 'lowStockView') {
    loadLowStock();
  } else if (viewId === 'settingsView') {
    loadSettingsAndLicense();
  }

  refreshLowStockCount();

}

async function refreshLowStockCount() {
  try {
    const res = await fetch('/api/inventory/low-stock');
    const data = await res.json();
    if (data.success && data.lowStock) {
      const badge = document.getElementById('lowStockCountBadge');
      if (badge) badge.textContent = data.lowStock.length;
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// Inventory & Products Hub
// -------------------------------------------------------------
async function loadInventory() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      cachedProducts = data.products || [];
      renderInventoryTable(cachedProducts);
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function renderInventoryTable(products) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-dim)">لا توجد أصناف في المخزن حالياً</td></tr>';
    return;
  }

  products.forEach((p) => {
    const stockClass = p.stockQuantity <= 0 ? 'zero' : (p.stockQuantity <= p.minStockAlert ? 'low' : 'ok');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${p.barcode || p.sku}</code></td>
      <td class="item-name-cell">${p.name}</td>
      <td class="price-text">${p.buyPrice.toFixed(2)} EGP</td>
      <td class="price-text" style="color:var(--accent-cyan)">${p.sellPriceRetail.toFixed(2)} EGP</td>
      <td class="price-text" style="color:var(--accent-indigo)">${(p.sellPriceWholesale || p.sellPriceRetail).toFixed(2)} EGP</td>
      <td><span class="badge-stock ${stockClass}">${p.stockQuantity}</span></td>
      <td><span style="color:var(--text-dim)">${p.minStockAlert}</span></td>
      <td>${p.hasSerial ? '<span class="serial-badge">سيريال / IMEI</span>' : '<span style="color:var(--text-dim)">عادي</span>'}</td>
      <td>
        <div class="table-actions-group">
          <button class="btn-action btn-action-cyan" onclick="openMovementsModal('${p.id}', '${escapeQuotes(p.name)}')">📜 الحركة</button>
          <button class="btn-action btn-action-amber" onclick="openAiAdModal('${p.id}', '${escapeQuotes(p.name)}')">✨ إعلان AI</button>
          ${p.hasSerial ? `<button class="btn-action btn-action-emerald" onclick="openBulkSerialModal('${p.id}', '${escapeQuotes(p.name)}')">+ سيريالات</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterInventoryTable() {
  const q = (document.getElementById('invSearchInput')?.value || '').toLowerCase().trim();
  if (!q) {
    renderInventoryTable(cachedProducts);
    return;
  }
  const filtered = cachedProducts.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    (p.sku && p.sku.toLowerCase().includes(q))
  );
  renderInventoryTable(filtered);
}

function openNewProductModal() {
  document.getElementById('npName').value = '';
  document.getElementById('npBarcode').value = 'PROD-' + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('npBuyPrice').value = '';
  document.getElementById('npSellRetail').value = '';
  document.getElementById('npSellWholesale').value = '';
  document.getElementById('npInitialStock').value = '0';
  document.getElementById('npMinAlert').value = '3';
  document.getElementById('npHasSerial').checked = false;
  document.getElementById('npSerialsText').value = '';
  document.getElementById('npSerialTextareaGroup').style.display = 'none';
  document.getElementById('newProductModal').classList.add('active');
}

function closeNewProductModal() {
  document.getElementById('newProductModal').classList.remove('active');
}

function toggleSerialTextarea() {
  const checked = document.getElementById('npHasSerial').checked;
  document.getElementById('npSerialTextareaGroup').style.display = checked ? 'block' : 'none';
}

async function submitNewProduct() {
  const name = document.getElementById('npName').value.trim();
  const barcode = document.getElementById('npBarcode').value.trim();
  const buyPrice = parseFloat(document.getElementById('npBuyPrice').value) || 0;
  const sellPriceRetail = parseFloat(document.getElementById('npSellRetail').value) || 0;
  const sellPriceWholesale = parseFloat(document.getElementById('npSellWholesale').value) || sellPriceRetail;
  const stockQuantity = parseInt(document.getElementById('npInitialStock').value, 10) || 0;
  const minStockAlert = parseInt(document.getElementById('npMinAlert').value, 10) || 3;
  const hasSerial = document.getElementById('npHasSerial').checked;

  if (!name || !barcode || sellPriceRetail <= 0) {
    showToast('برجاء إدخال اسم المنتج، الباركود، وسعر البيع بشكل صحيح.', 'warning');
    return;
  }

  let initialSerials = [];
  if (hasSerial) {
    const raw = document.getElementById('npSerialsText').value.trim();
    if (raw) {
      initialSerials = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        barcode,
        buyPrice,
        sellPriceRetail,
        sellPriceWholesale,
        stockQuantity: hasSerial ? (initialSerials.length > 0 ? initialSerials.length : stockQuantity) : stockQuantity,
        minStockAlert,
        hasSerial,
        initialSerials,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('تمت إضافة المنتج بنجاح!', 'success');
      closeNewProductModal();
      loadInventory();
      loadQuickProducts();
      refreshLowStockCount();
    } else {
      showToast('خطأ أثناء حفظ المنتج: ' + (data.error || ''), 'error');
    }
  } catch (err) {
    showToast('فشل الاتصال بالسيرفر أثناء حفظ المنتج', 'error');
  }
}

// Bulk Serials Modal
let currentBulkProductId = null;
function openBulkSerialModal(productId, productName) {
  currentBulkProductId = productId;
  document.getElementById('bulkSerialProductName').textContent = productName;
  document.getElementById('bulkSerialsInput').value = '';
  document.getElementById('bulkWarrantyMonths').value = '12';
  document.getElementById('bulkSerialModal').classList.add('active');
}

function closeBulkSerialModal() {
  currentBulkProductId = null;
  document.getElementById('bulkSerialModal').classList.remove('active');
}

async function submitBulkSerials() {
  if (!currentBulkProductId) return;
  const raw = document.getElementById('bulkSerialsInput').value.trim();
  const serials = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  const warrantyMonths = parseInt(document.getElementById('bulkWarrantyMonths').value, 10) || 12;

  if (serials.length === 0) {
    showToast('برجاء كتابة سيريال واحد على الأقل', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/products/${currentBulkProductId}/serials/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serials, warrantyMonths }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم بنجاح تسجيل ${data.count} سيريال وتحديث رصيد المخزن.`, 'success');
      closeBulkSerialModal();
      loadInventory();
    } else {
      showToast('خطأ أثناء إضافة السيريالات: ' + (data.error || ''), 'error');
    }
  } catch (err) {
    showToast('فشل الاتصال بالسيرفر', 'error');
  }
}

// Movements Modal
async function openMovementsModal(productId, productName) {
  document.getElementById('movementsProductName').textContent = `حركات الصنف: ${productName}`;
  const tbody = document.getElementById('movementsTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">جاري التحميل...</td></tr>';
  document.getElementById('movementsModal').classList.add('active');

  try {
    const res = await fetch(`/api/products/${productId}/movements`);
    const data = await res.json();
    if (data.success && data.movements) {
      tbody.innerHTML = '';
      if (data.movements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-dim)">لا توجد حركات مسجلة لهذا الصنف</td></tr>';
        return;
      }
      data.movements.forEach((m) => {
        const typeLabels = {
          purchase: '📥 توريد شراء',
          sale: '📤 بيع فاتورة',
          sales_return: '↩️ مرتجع بيع',
          purchase_return: '↪️ مرتجع شراء',
          adjustment_in: '➕ تسوية جردية بالزيادة',
          adjustment_out: '➖ تسوية جردية بالنقص',
        };
        const dateStr = new Date(m.createdAt).toLocaleString('ar-EG');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dateStr}</td>
          <td><b>${typeLabels[m.movementType] || m.movementType}</b></td>
          <td style="color:${m.quantityChange > 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}; font-weight:bold;">${m.quantityChange > 0 ? '+' : ''}${m.quantityChange}</td>
          <td><b>${m.stockAfter}</b></td>
          <td><code>${m.referenceId || '-'}</code></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--accent-red); text-align:center">فشل تحميل حركات الصنف</td></tr>';
  }
}

function closeMovementsModal() {
  document.getElementById('movementsModal').classList.remove('active');
}

// -------------------------------------------------------------
// Sales Invoices Hub & Management
// -------------------------------------------------------------
let cachedSalesInvoices = [];
let currentSalesFilter = 'all'; // 'all' | 'sale' | 'credit' | 'sale_return'
let currentViewingInvoiceData = null;
let currentReturnInvoiceData = null;

async function loadSalesInvoices() {
  const tbody = document.getElementById('salesInvoicesTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:25px; color:var(--text-dim)">جاري تحميل فواتير المبيعات...</td></tr>';
  }

  try {
    const res = await fetch('/api/invoices');
    const data = await res.json();
    if (data.success && data.invoices) {
      cachedSalesInvoices = data.invoices;
      updateSalesKpis(cachedSalesInvoices);
      filterSalesInvoicesTable();
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:25px; color:var(--text-dim)">تعذر تحميل فواتير البيع</td></tr>';
    }
  } catch (err) {
    console.error('Error loading sales invoices:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:25px; color:var(--accent-red)">خطأ في الاتصال بسيرفر الفواتير</td></tr>';
  }
}

function updateSalesKpis(invoices) {
  let totalAmount = 0;
  let totalPaid = 0;
  let totalRemaining = 0;
  let saleCount = 0;

  invoices.forEach((inv) => {
    if (inv.type === 'sale') {
      totalAmount += inv.finalAmount || 0;
      totalPaid += inv.paidAmount || 0;
      totalRemaining += inv.remainingAmount || 0;
      saleCount++;
    } else if (inv.type === 'sale_return') {
      totalAmount -= inv.finalAmount || 0;
    }
  });

  const totalEl = document.getElementById('salesKpiTotalAmount');
  const countEl = document.getElementById('salesKpiCount');
  const paidEl = document.getElementById('salesKpiPaid');
  const remEl = document.getElementById('salesKpiRemaining');

  if (totalEl) totalEl.textContent = `${Math.max(0, totalAmount).toFixed(2)} EGP`;
  if (countEl) countEl.textContent = saleCount;
  if (paidEl) paidEl.textContent = `${totalPaid.toFixed(2)} EGP`;
  if (remEl) remEl.textContent = `${totalRemaining.toFixed(2)} EGP`;
}

function setSalesInvoiceFilter(filterType) {
  currentSalesFilter = filterType;
  const btnAll = document.getElementById('btnSalesFilterAll');
  const btnSale = document.getElementById('btnSalesFilterSale');
  const btnCredit = document.getElementById('btnSalesFilterCredit');
  const btnReturn = document.getElementById('btnSalesFilterReturn');

  if (btnAll) btnAll.classList.toggle('active', filterType === 'all');
  if (btnSale) btnSale.classList.toggle('active', filterType === 'sale');
  if (btnCredit) btnCredit.classList.toggle('active', filterType === 'credit');
  if (btnReturn) btnReturn.classList.toggle('active', filterType === 'sale_return');

  filterSalesInvoicesTable();
}

function filterSalesInvoicesTable() {
  const q = (document.getElementById('salesSearchInput')?.value || '').toLowerCase().trim();
  let list = cachedSalesInvoices;

  if (currentSalesFilter === 'sale') {
    list = list.filter((inv) => inv.type === 'sale');
  } else if (currentSalesFilter === 'sale_return') {
    list = list.filter((inv) => inv.type === 'sale_return');
  } else if (currentSalesFilter === 'credit') {
    list = list.filter((inv) => inv.remainingAmount > 0);
  }

  if (q) {
    list = list.filter((inv) => {
      const numMatch = (inv.invoiceNumber || '').toLowerCase().includes(q);
      const nameMatch = (inv.contactName || '').toLowerCase().includes(q);
      const phoneMatch = (inv.contactPhone || '').toLowerCase().includes(q);
      return numMatch || nameMatch || phoneMatch;
    });
  }

  renderSalesInvoicesTable(list);
}

function renderSalesInvoicesTable(invoices) {
  const tbody = document.getElementById('salesInvoicesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!invoices || invoices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:35px; color:var(--text-dim)">لا توجد فواتير مطابقة للبحث أو الفلتر المحدد</td></tr>';
    return;
  }

  invoices.forEach((inv) => {
    const isReturn = inv.type === 'sale_return';
    const dateStr = new Date(inv.createdAt).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const typeBadge = isReturn
      ? '<span style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; padding:2px 7px; border-radius:4px; font-size:0.72rem; font-weight:700;">↩️ مرتجع</span>'
      : '<span style="background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); color:#6ee7b7; padding:2px 7px; border-radius:4px; font-size:0.72rem; font-weight:700;">🛒 بيع</span>';

    const remainingClass = inv.remainingAmount > 0 ? 'style="color:var(--accent-amber); font-weight:700;"' : 'style="color:var(--text-dim);"';
    const methodBadge = inv.paymentMethod === 'cash' ? 'نقداً' : inv.paymentMethod === 'credit' ? 'آجل' : inv.paymentMethod === 'vodafone_cash' ? 'محفظة' : 'فيزا/بنك';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${inv.invoiceNumber}</code></td>
      <td>${typeBadge}</td>
      <td>
        <span style="font-weight:700; display:block;">${inv.contactName}</span>
        ${inv.contactPhone ? `<span style="display:block; font-size:0.7rem; color:var(--text-dim); font-family:'JetBrains Mono',monospace;">${inv.contactPhone}</span>` : ''}
      </td>
      <td style="font-size:0.76rem; color:var(--text-muted);">${dateStr}</td>
      <td style="text-align:center;"><span class="badge-stock in-stock" style="padding:2px 6px;">${inv.itemCount || 1}</span></td>
      <td class="price-text">${inv.subtotal.toFixed(2)} EGP</td>
      <td class="price-text" style="color:var(--accent-amber);">${inv.discountAmount > 0 ? `-${inv.discountAmount.toFixed(2)}` : '0.00'} EGP</td>
      <td class="price-text" style="color:var(--accent-emerald); font-weight:800; font-size:0.88rem;">${inv.finalAmount.toFixed(2)} EGP</td>
      <td class="price-text">${inv.paidAmount.toFixed(2)} EGP</td>
      <td class="price-text" ${remainingClass}>${inv.remainingAmount.toFixed(2)} EGP</td>
      <td><span class="badge-terminal">${methodBadge}</span></td>
      <td>
        <div class="table-actions-group">
          <button class="btn-action btn-action-cyan" onclick="openSaleInvoiceDetails('${inv.id}')" title="عرض تفاصيل الفاتورة">👁️ تفاصيل</button>
          <button class="btn-action btn-action-emerald" onclick="reprintThermalInvoice('${inv.id}')" title="طباعة الإيصال الحراري">🖨️ طباعة</button>
          <button class="btn-action btn-action-whatsapp" onclick="sendWhatsappForInvoice('${inv.id}')" title="إرسال عبر واتساب">💬</button>
          ${!isReturn ? `<button class="btn-action btn-action-amber" onclick="openSalesReturnModal('${inv.id}')" title="عمل مرتجع للفاتورة">↩️ مرتجع</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// Sales Invoice Details Modal
// -------------------------------------------------------------
async function openSaleInvoiceDetails(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    if (!data.success || !data.invoice) {
      showToast('تعذر العثور على بيانات الفاتورة', 'error');
      return;
    }

    currentViewingInvoiceData = data;
    const inv = data.invoice;
    const contact = data.contact;

    const modal = document.getElementById('saleInvoiceDetailsModal');
    const title = document.getElementById('invModalTitle');
    const sub = document.getElementById('invModalSubtitle');
    const cust = document.getElementById('invModalCustomer');
    const phone = document.getElementById('invModalPhone');
    const method = document.getElementById('invModalMethod');
    const dateEl = document.getElementById('invModalDate');

    if (title) title.textContent = `فاتورة رقم: ${inv.invoiceNumber}`;
    if (sub) sub.textContent = inv.type === 'sale_return' ? 'مرتجع مبيعات' : 'فاتورة مبيعات معتمدة';
    if (cust) cust.textContent = contact ? contact.name : (inv.contactName || 'عميل نقدي');
    if (phone) phone.textContent = contact?.phone || inv.contactPhone || 'غير مسجل';
    if (method) method.textContent = inv.paymentMethod === 'cash' ? 'نقداً (كاش)' : inv.paymentMethod === 'credit' ? 'آجل / دين' : inv.paymentMethod;
    if (dateEl) dateEl.textContent = new Date(inv.createdAt).toLocaleString('ar-EG');

    // Totals banner
    const subtotalEl = document.getElementById('invModalSubtotal');
    const discEl = document.getElementById('invModalDiscount');
    const vatEl = document.getElementById('invModalVat');
    const finalEl = document.getElementById('invModalFinal');

    if (subtotalEl) subtotalEl.textContent = `${inv.subtotal.toFixed(2)} EGP`;
    if (discEl) discEl.textContent = `-${inv.discountAmount.toFixed(2)} EGP`;
    if (vatEl) vatEl.textContent = `+${(inv.taxVat14 || 0).toFixed(2)} EGP`;
    if (finalEl) finalEl.textContent = `${inv.finalAmount.toFixed(2)} EGP`;

    // Items table
    const itemsTbody = document.getElementById('invModalItemsBody');
    if (itemsTbody) {
      itemsTbody.innerHTML = '';
      (data.items || []).forEach((item) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:700;">
            ${item.productName}
            ${item.productBarcode ? `<span style="display:block; font-size:0.7rem; color:var(--text-dim); font-family:'JetBrains Mono',monospace;">[${item.productBarcode}]</span>` : ''}
          </td>
          <td class="price-text">${item.unitPrice.toFixed(2)} EGP</td>
          <td style="text-align:center; font-family:'JetBrains Mono',monospace; font-weight:700;">x${item.quantity}</td>
          <td class="price-text" style="color:var(--accent-emerald);">${item.totalPrice.toFixed(2)} EGP</td>
          <td>${item.serialNumber ? `<span class="serial-badge">${item.serialNumber}</span>` : '<span style="color:var(--text-dim);">-</span>'}</td>
        `;
        itemsTbody.appendChild(tr);
      });
    }

    if (modal) modal.classList.add('active');
  } catch (err) {
    showToast('خطأ أثناء جلب تفاصيل الفاتورة', 'error');
  }
}

function closeSaleInvoiceDetails() {
  const modal = document.getElementById('saleInvoiceDetailsModal');
  if (modal) modal.classList.remove('active');
}

function reprintCurrentModalInvoice() {
  if (!currentViewingInvoiceData?.invoice) return;
  reprintThermalInvoice(currentViewingInvoiceData.invoice.id);
}

function whatsappCurrentModalInvoice() {
  if (!currentViewingInvoiceData?.invoice) return;
  sendWhatsappForInvoice(currentViewingInvoiceData.invoice.id);
}

function startReturnForCurrentModalInvoice() {
  if (!currentViewingInvoiceData?.invoice) return;
  const id = currentViewingInvoiceData.invoice.id;
  closeSaleInvoiceDetails();
  openSalesReturnModal(id);
}

async function reprintThermalInvoice(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    if (!data.success || !data.invoice) {
      showToast('تعذر العثور على الفاتورة لإعادة الطباعة', 'error');
      return;
    }

    lastCompletedInvoiceId = data.invoice.id;
    lastCustomerPhone = data.contact?.phone || '';

    // Convert items for displayReceiptPreview
    const cartItems = (data.items || []).map((i) => ({
      product: { name: i.productName, barcode: i.productBarcode },
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      serialNumber: i.serialNumber,
    }));

    displayReceiptPreview(data.invoice, cartItems, data.invoice.paidAmount, data.invoice.finalAmount);
    showToast(`تم تجهيز الإيصال الحراري للفاتورة ${data.invoice.invoiceNumber}`, 'info');
  } catch (e) {
    showToast('تعذر فتح معاينة الإيصال الحراري', 'error');
  }
}

async function sendWhatsappForInvoice(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    if (!data.success || !data.invoice) {
      showToast('تعذر العثور على الفاتورة', 'error');
      return;
    }

    const phone = data.contact?.phone;
    if (phone) {
      const waRes = await fetch(`/api/invoices/${invoiceId}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const waData = await waRes.json();
      if (waData.success && waData.whatsappUrl) {
        window.open(waData.whatsappUrl, '_blank');
        showToast('تم فتح محادثة الواتساب بنجاح', 'success');
        return;
      }
    }

    // If no phone, prompt via receipt modal
    lastCompletedInvoiceId = data.invoice.id;
    lastCustomerPhone = '';
    const cartItems = (data.items || []).map((i) => ({
      product: { name: i.productName },
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      serialNumber: i.serialNumber,
    }));
    displayReceiptPreview(data.invoice, cartItems, data.invoice.paidAmount, data.invoice.finalAmount);
    showToast('برجاء كتابة رقم الواتساب لإرسال الفاتورة', 'warning');
  } catch (e) {
    showToast('خطأ أثناء تجهيز الواتساب', 'error');
  }
}

// -------------------------------------------------------------
// Sales Return Logic
// -------------------------------------------------------------
async function openSalesReturnModal(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const data = await res.json();
    if (!data.success || !data.invoice) {
      showToast('تعذر العثور على الفاتورة للمرتجع', 'error');
      return;
    }

    currentReturnInvoiceData = data;
    const inv = data.invoice;
    const sub = document.getElementById('returnModalSubtitle');
    if (sub) sub.textContent = `للفاتورة الأصلية: ${inv.invoiceNumber} (بتاريخ ${new Date(inv.createdAt).toLocaleDateString('ar-EG')})`;

    const tbody = document.getElementById('returnModalItemsBody');
    if (tbody) {
      tbody.innerHTML = '';
      (data.items || []).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="text-align:center;">
            <input type="checkbox" class="return-item-check" data-index="${idx}" onchange="calcReturnRefundTotal()">
          </td>
          <td style="font-weight:700;">${item.productName}</td>
          <td class="price-text">${item.unitPrice.toFixed(2)} EGP</td>
          <td style="text-align:center; font-family:'JetBrains Mono',monospace;">${item.quantity}</td>
          <td>
            <input type="number" class="return-item-qty" data-index="${idx}" min="1" max="${item.quantity}" value="1"
              style="width:60px; background:#0f172a; border:1px solid var(--border-glass); border-radius:4px; padding:3px 6px; color:#fff; text-align:center; font-family:'JetBrains Mono',monospace;"
              oninput="calcReturnRefundTotal()">
          </td>
          <td>${item.serialNumber ? `<span class="serial-badge">${item.serialNumber}</span>` : '<span style="color:var(--text-dim);">-</span>'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const notesInput = document.getElementById('returnNotesInput');
    if (notesInput) notesInput.value = '';

    calcReturnRefundTotal();
    const modal = document.getElementById('salesReturnModal');
    if (modal) modal.classList.add('active');
  } catch (e) {
    showToast('تعذر تحميل بيانات مرتجع الفاتورة', 'error');
  }
}

function closeSalesReturnModal() {
  const modal = document.getElementById('salesReturnModal');
  if (modal) modal.classList.remove('active');
  currentReturnInvoiceData = null;
}

function calcReturnRefundTotal() {
  if (!currentReturnInvoiceData?.items) return;
  let totalRefund = 0;
  const checkboxes = document.querySelectorAll('.return-item-check');
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.index, 10);
      const item = currentReturnInvoiceData.items[idx];
      const qtyInput = document.querySelector(`.return-item-qty[data-index="${idx}"]`);
      const qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
      totalRefund += item.unitPrice * qty;
    }
  });

  const preview = document.getElementById('returnRefundTotalPreview');
  if (preview) preview.textContent = `${totalRefund.toFixed(2)} EGP`;
}

async function confirmSalesReturnSubmit() {
  if (!currentReturnInvoiceData?.invoice) return;
  const inv = currentReturnInvoiceData.invoice;
  const itemsToReturn = [];

  const checkboxes = document.querySelectorAll('.return-item-check');
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const idx = parseInt(cb.dataset.index, 10);
      const item = currentReturnInvoiceData.items[idx];
      const qtyInput = document.querySelector(`.return-item-qty[data-index="${idx}"]`);
      const qty = Math.min(item.quantity, Math.max(1, parseInt(qtyInput ? qtyInput.value : 1, 10) || 1));
      itemsToReturn.push({
        productId: item.productId,
        quantity: qty,
        unitPrice: item.unitPrice,
        serialNumber: item.serialNumber || undefined,
        isDefective: false,
      });
    }
  });

  if (itemsToReturn.length === 0) {
    showToast('برجاء تحديد صنف واحد على الأقل للمرتجع بالضغط على مربع الاختيار.', 'warning');
    return;
  }

  const notes = document.getElementById('returnNotesInput')?.value.trim();

  try {
    const res = await fetch('/api/invoices/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalInvoiceId: inv.id,
        contactId: inv.contactId || undefined,
        notes: notes || undefined,
        items: itemsToReturn,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم تسجيل مرتجع المبيعات بنجاح برقم: ${data.returnInvoice.invoiceNumber}`, 'success');
      closeSalesReturnModal();
      loadSalesInvoices();
    } else {
      showToast('خطأ أثناء تسجيل المرتجع: ' + (data.error || ''), 'error');
    }
  } catch (e) {
    showToast('فشل الاتصال بالسيرفر لتسجيل المرتجع', 'error');
  }
}

// -------------------------------------------------------------
// Purchases Hub
// -------------------------------------------------------------
async function loadPurchases() {
  try {
    const res = await fetch('/api/purchases');
    const data = await res.json();
    if (data.success && data.purchases) {
      const tbody = document.getElementById('purchasesTableBody');
      tbody.innerHTML = '';
      if (data.purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim)">لا توجد فواتير شراء مسجلة حتى الآن</td></tr>';
        return;
      }
      data.purchases.forEach((pur) => {
        const dateStr = new Date(pur.createdAt).toLocaleDateString('ar-EG');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${pur.invoiceNumber}</code></td>
          <td style="font-weight:bold;">${pur.supplierName || 'مورد عام'}</td>
          <td>${dateStr}</td>
          <td class="price-text" style="color:var(--accent-emerald)">${pur.totalAmount.toFixed(2)} EGP</td>
          <td class="price-text">${pur.paidAmount.toFixed(2)} EGP</td>
          <td class="price-text" style="color:${pur.remainingAmount > 0 ? 'var(--accent-amber)' : 'var(--text-dim)'}">${pur.remainingAmount.toFixed(2)} EGP</td>
          <td><span class="badge-terminal">${pur.paymentMethod}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {}
}

async function openNewPurchaseModal() {
  const suppSelect = document.getElementById('purSupplierSelect');
  const prodSelect = document.getElementById('purProductSelect');
  suppSelect.innerHTML = '<option value="">-- اختر مورد --</option>';
  prodSelect.innerHTML = '<option value="">-- اختر صنف --</option>';

  try {
    const [suppRes, prodRes] = await Promise.all([
      fetch('/api/contacts?type=supplier'),
      fetch('/api/products'),
    ]);
    const suppData = await suppRes.json();
    const prodData = await prodRes.json();

    if (suppData.success && suppData.contacts) {
      suppData.contacts.forEach((s) => {
        suppSelect.innerHTML += `<option value="${s.id}">${s.name} (${s.phone || 'بدون هاتف'})</option>`;
      });
    }

    if (prodData.success && prodData.products) {
      cachedProducts = prodData.products;
      prodData.products.forEach((p) => {
        prodSelect.innerHTML += `<option value="${p.id}" data-has-serial="${p.hasSerial}" data-buy-price="${p.buyPrice}">${p.name} [${p.barcode || p.sku}]</option>`;
      });
    }
  } catch (e) {}

  document.getElementById('purQty').value = '1';
  document.getElementById('purUnitPrice').value = '';
  document.getElementById('purTotalItem').value = '0.00 EGP';
  document.getElementById('purPaidAmount').value = '';
  document.getElementById('purRemainingLabel').textContent = '0.00 EGP';
  document.getElementById('purSerialsGroup').style.display = 'none';
  document.getElementById('purSerialsText').value = '';

  document.getElementById('newPurchaseModal').classList.add('active');
}

function closeNewPurchaseModal() {
  document.getElementById('newPurchaseModal').classList.remove('active');
}

function onPurchaseProductSelected() {
  const prodSelect = document.getElementById('purProductSelect');
  const opt = prodSelect.options[prodSelect.selectedIndex];
  if (!opt || !opt.value) return;

  const hasSerial = opt.dataset.hasSerial === 'true' || opt.dataset.hasSerial === '1';
  const buyPrice = parseFloat(opt.dataset.buyPrice) || 0;

  document.getElementById('purUnitPrice').value = buyPrice;
  document.getElementById('purSerialsGroup').style.display = hasSerial ? 'block' : 'none';
  calcPurchaseTotal();
}

function calcPurchaseTotal() {
  const qty = parseInt(document.getElementById('purQty').value, 10) || 0;
  const price = parseFloat(document.getElementById('purUnitPrice').value) || 0;
  const total = qty * price;
  document.getElementById('purTotalItem').value = `${total.toFixed(2)} EGP`;

  const paid = parseFloat(document.getElementById('purPaidAmount').value) || 0;
  const rem = Math.max(0, total - paid);
  document.getElementById('purRemainingLabel').textContent = `${rem.toFixed(2)} EGP`;
}

async function submitPurchaseInvoice() {
  const supplierId = document.getElementById('purSupplierSelect').value;
  const productId = document.getElementById('purProductSelect').value;
  const qty = parseInt(document.getElementById('purQty').value, 10) || 0;
  const unitPrice = parseFloat(document.getElementById('purUnitPrice').value) || 0;
  const paidAmount = parseFloat(document.getElementById('purPaidAmount').value) || 0;

  if (!productId || qty <= 0 || unitPrice <= 0) {
    showToast('برجاء اختيار الصنف وتحديد الكمية وسعر الشراء.', 'warning');
    return;
  }

  const opt = document.getElementById('purProductSelect').options[document.getElementById('purProductSelect').selectedIndex];
  const hasSerial = opt.dataset.hasSerial === 'true' || opt.dataset.hasSerial === '1';
  let serialNumbers = [];

  if (hasSerial) {
    const raw = document.getElementById('purSerialsText').value.trim();
    if (raw) {
      serialNumbers = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    }
    if (serialNumbers.length !== qty) {
      showToast(`تنبيه: عدد السيريالات المدخلة (${serialNumbers.length}) لا يطابق الكمية المشتراة (${qty})!`, 'warning');
      return;
    }
  }

  try {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: supplierId || undefined,
        items: [{
          productId,
          quantity: qty,
          unitCost: unitPrice,
          serialNumbers: hasSerial ? serialNumbers : undefined,
        }],
        paidAmount,
        paymentMethod: 'cash',
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم تسجيل فاتورة الشراء بنجاح برقم: ${data.invoice.invoiceNumber}`, 'success');
      closeNewPurchaseModal();
      loadPurchases();
      refreshLowStockCount();
    } else {
      showToast('خطأ أثناء تسجيل فاتورة الشراء: ' + (data.error || ''), 'error');
    }
  } catch (err) {
    showToast('فشل الاتصال بالسيرفر', 'error');
  }
}

// -------------------------------------------------------------
// CRM & Ledgers Hub
// -------------------------------------------------------------
function switchCrmTab(type) {
  currentCrmTab = type;
  document.getElementById('btnCustomersTab').classList.toggle('active', type === 'customer');
  document.getElementById('btnSuppliersTab').classList.toggle('active', type === 'supplier');
  loadCrm(type);
}

async function loadCrm(type) {
  try {
    const res = await fetch(`/api/contacts?type=${type}`);
    const data = await res.json();
    if (data.success && data.contacts) {
      const tbody = document.getElementById('crmTableBody');
      tbody.innerHTML = '';
      if (data.contacts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-dim)">لا يوجد ${type === 'customer' ? 'عملاء' : 'موردين'} مسجلين حالياً</td></tr>`;
        return;
      }
      data.contacts.forEach((c) => {
        const balanceColor = c.currentBalance > 0 ? 'var(--accent-red)' : (c.currentBalance < 0 ? 'var(--accent-emerald)' : 'var(--text-dim)');
        const balanceLabel = c.currentBalance > 0 ? `${c.currentBalance.toFixed(2)} EGP (عليه)` : (c.currentBalance < 0 ? `${Math.abs(c.currentBalance).toFixed(2)} EGP (له)` : '0.00 EGP');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:bold;">${c.name}</td>
          <td><code>${c.phone || '-'}</code></td>
          <td>${c.taxNumber || '-'}</td>
          <td>${c.address || '-'}</td>
          <td style="font-family:'JetBrains Mono', monospace; font-weight:bold; color:${balanceColor}">${balanceLabel}</td>
          <td><span class="badge-terminal">${c.status === 'active' ? 'نشط' : c.status}</span></td>
          <td>
            <div class="table-actions-group">
              <button class="btn-action btn-action-cyan" onclick="openStatementModal('${c.id}', '${escapeQuotes(c.name)}', '${escapeQuotes(c.phone || '')}')">📊 كشف حساب</button>
              <button class="btn-action btn-action-emerald" onclick="openPaymentModal('${c.id}', '${escapeQuotes(c.name)}', '${c.type}')">💰 تسجيل دفعة</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {}
}

function openAddContactModal() {
  const modal = document.getElementById('addContactModal');
  const title = document.getElementById('addContactModalTitle');
  const typeLabel = currentCrmTab === 'customer' ? 'عميل جديد' : currentCrmTab === 'supplier' ? 'مورد جديد' : 'جهة اتصال جديدة';
  if (title) title.textContent = `إضافة ${typeLabel}`;

  const nameInput = document.getElementById('contactNameInput');
  const phoneInput = document.getElementById('contactPhoneInput');
  const addrInput = document.getElementById('contactAddressInput');
  const taxInput = document.getElementById('contactTaxIdInput');

  if (nameInput) nameInput.value = '';
  if (phoneInput) phoneInput.value = '';
  if (addrInput) addrInput.value = '';
  if (taxInput) taxInput.value = '';

  if (modal) modal.classList.add('active');
  setTimeout(() => {
    if (nameInput) nameInput.focus();
  }, 60);
}

function closeAddContactModal() {
  const modal = document.getElementById('addContactModal');
  if (modal) modal.classList.remove('active');
}

async function saveContactFromModal() {
  const name = document.getElementById('contactNameInput').value.trim();
  const phone = document.getElementById('contactPhoneInput').value.trim();
  const address = document.getElementById('contactAddressInput').value.trim();
  const taxId = document.getElementById('contactTaxIdInput') ? document.getElementById('contactTaxIdInput').value.trim() : '';

  if (!name) {
    showToast('برجاء كتابة اسم العميل أو المورد', 'warning');
    document.getElementById('contactNameInput').focus();
    return;
  }

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: currentCrmTab,
        name,
        phone: phone || undefined,
        address: address || undefined,
        taxId: taxId || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('تمت إضافة جهة الاتصال بنجاح', 'success');
      closeAddContactModal();
      loadCrm(currentCrmTab);
    } else {
      showToast('خطأ: ' + (data.error || 'تعذر الحفظ'), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بالسيرفر لحفظ جهة الاتصال', 'error');
  }
}


// Statement of Account Modal
async function openStatementModal(contactId, name, phone) {
  document.getElementById('stmtContactName').textContent = `كشف حساب: ${name}`;
  document.getElementById('stmtContactPhone').textContent = phone ? `هاتف: ${phone}` : '';
  const tbody = document.getElementById('statementTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">جاري تحميل كشف الحساب...</td></tr>';
  document.getElementById('statementModal').classList.add('active');

  try {
    const res = await fetch(`/api/contacts/${contactId}/statement`);
    const data = await res.json();
    if (data.success && data.statement) {
      const stmt = data.statement;
      document.getElementById('stmtTotalDebit').textContent = `${stmt.totalDebit.toFixed(2)} EGP`;
      document.getElementById('stmtTotalCredit').textContent = `${stmt.totalCredit.toFixed(2)} EGP`;
      document.getElementById('stmtCurrentBalance').textContent = `${stmt.closingBalance.toFixed(2)} EGP`;

      tbody.innerHTML = '';
      if (stmt.transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-dim)">لا توجد معاملات مسجلة في كشف الحساب</td></tr>';
        return;
      }

      stmt.transactions.forEach((t) => {
        const dateStr = new Date(t.createdAt).toLocaleDateString('ar-EG');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dateStr}</td>
          <td>${t.description}</td>
          <td><code>${t.referenceId || '-'}</code></td>
          <td style="color:var(--accent-cyan); font-weight:bold;">${t.debitAmount > 0 ? t.debitAmount.toFixed(2) : '-'}</td>
          <td style="color:var(--accent-emerald); font-weight:bold;">${t.creditAmount > 0 ? t.creditAmount.toFixed(2) : '-'}</td>
          <td style="font-weight:bold;">${t.cumulativeBalance.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--accent-red); text-align:center">فشل تحميل كشف الحساب</td></tr>';
  }
}

function closeStatementModal() {
  document.getElementById('statementModal').classList.remove('active');
}

// Payment Voucher Modal
let currentPaymentContactId = null;
let currentPaymentContactType = 'customer';

function openPaymentModal(contactId, name, type) {
  currentPaymentContactId = contactId;
  currentPaymentContactType = type;
  document.getElementById('pvTitle').textContent = type === 'customer' ? 'تسجيل سند قبض من عميل (+)' : 'تسجيل سند صرف لمورد (-)';
  document.getElementById('pvContactName').textContent = name;
  document.getElementById('pvAmount').value = '';
  document.getElementById('pvNotes').value = '';
  document.getElementById('paymentVoucherModal').classList.add('active');
}

function closePaymentModal() {
  currentPaymentContactId = null;
  document.getElementById('paymentVoucherModal').classList.remove('active');
}

async function submitPaymentVoucher() {
  if (!currentPaymentContactId) return;
  const amount = parseFloat(document.getElementById('pvAmount').value) || 0;
  const paymentMethod = document.getElementById('pvMethod').value;
  const notes = document.getElementById('pvNotes').value.trim();

  if (amount <= 0) {
    showToast('برجاء إدخال مبلغ صحيح.', 'warning');
    return;
  }

  const voucherType = currentPaymentContactType === 'customer' ? 'receipt' : 'payment';

  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: currentPaymentContactId,
        voucherType,
        amount,
        paymentMethod,
        notes,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم تسجيل وترحيل سند الدفعة بنجاح.', 'success');
      closePaymentModal();
      loadCrm(currentCrmTab);
    } else {
      showToast('خطأ أثناء تسجيل الدفعة: ' + (data.error || ''), 'error');
    }
  } catch (err) {
    showToast('فشل الاتصال بالسيرفر', 'error');
  }
}

// -------------------------------------------------------------
// Low Stock Alerts Hub
// -------------------------------------------------------------
async function loadLowStock() {
  try {
    const res = await fetch('/api/inventory/low-stock');
    const data = await res.json();
    if (data.success && data.lowStock) {
      const tbody = document.getElementById('lowStockTableBody');
      tbody.innerHTML = '';
      document.getElementById('lowStockCountBadge').textContent = data.lowStock.length;

      if (data.lowStock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--accent-emerald)">🎉 ممتاز! لا توجد نواقص في المخزن، جميع الأرصدة فوق حد الأمان.</td></tr>';
        return;
      }

      data.lowStock.forEach((p) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${p.barcode || p.sku}</code></td>
          <td style="font-weight:bold;">${p.name}</td>
          <td><span class="badge-stock ${p.stockQuantity <= 0 ? 'zero' : 'low'}">${p.stockQuantity}</span></td>
          <td><span style="color:var(--text-dim)">${p.minStockAlert}</span></td>
          <td class="price-text">${p.buyPrice.toFixed(2)} EGP</td>
          <td class="price-text" style="color:var(--accent-cyan)">${p.sellPriceRetail.toFixed(2)} EGP</td>
          <td>
            <div class="table-actions-group">
              <button class="btn-action btn-action-emerald" onclick="switchView('purchasesView'); openNewPurchaseModal();">🚚 طلب توريد</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {}
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// -------------------------------------------------------------
// Phase 4: AI Ad Generator Modal Logic
// -------------------------------------------------------------
let currentAiProductId = null;
let currentAiPreset = 'facebook_post';

async function openAiAdModal(productId, productName) {
  currentAiProductId = productId;
  document.getElementById('aiAdProductName').textContent = productName;
  document.getElementById('aiCustomPrompt').value = '';
  document.getElementById('aiAdResultText').value = 'جاري التوليد بالذكاء الاصطناعي...';
  selectAdPreset('facebook_post', false);
  document.getElementById('aiAdModal').classList.add('active');
  await generateAiAd();
}

function closeAiAdModal() {
  currentAiProductId = null;
  document.getElementById('aiAdModal').classList.remove('active');
}

function selectAdPreset(preset, autoGenerate = true) {
  currentAiPreset = preset;
  document.getElementById('btnPresetFacebook').classList.toggle('active', preset === 'facebook_post');
  document.getElementById('btnPresetWhatsapp').classList.toggle('active', preset === 'whatsapp_broadcast');
  document.getElementById('btnPresetFlash').classList.toggle('active', preset === 'flash_sale');
  document.getElementById('btnPresetTech').classList.toggle('active', preset === 'tech_review');
  if (autoGenerate) {
    generateAiAd();
  }
}

async function generateAiAd(isRegen = false) {
  if (!currentAiProductId) return;
  const textarea = document.getElementById('aiAdResultText');
  textarea.value = '⏳ جاري كتابة إعلان تسويقي مخصص بالذكاء الاصطناعي...';
  const customPrompt = document.getElementById('aiCustomPrompt').value.trim();

  try {
    const res = await fetch('/api/ai/generate-ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: currentAiProductId,
        preset: currentAiPreset,
        customPrompt: customPrompt || undefined,
      }),
    });
    const data = await res.json();
    if (data.success && data.adText) {
      textarea.value = data.adText;
    } else {
      textarea.value = 'تعذر توليد الإعلان: ' + (data.error || 'خطأ غير معروف');
    }
  } catch (err) {
    textarea.value = 'فشل الاتصال بسيرفر الذكاء الاصطناعي';
  }
}

function copyAiAdText() {
  const textarea = document.getElementById('aiAdResultText');
  if (!textarea || !textarea.value) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    const btn = document.getElementById('btnCopyAd');
    const old = btn.textContent;
    btn.textContent = '✅ تم النسخ!';
    setTimeout(() => {
      btn.textContent = old;
    }, 2000);
  });
}

function shareAiAdWhatsapp() {
  const textarea = document.getElementById('aiAdResultText');
  if (!textarea || !textarea.value) return;
  const encoded = encodeURIComponent(textarea.value);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

// =============================================================
// PHASE 5: Modular Settings, Machine Lock Licensing & Z-Report
// =============================================================

let appSettingsCache = {
  enable_shifts: 'false',
  enable_serials: 'true',
  enable_ai_ad: 'true',
  enable_whatsapp: 'true',
  enable_credit_ledgers: 'true',
  store_name: 'كويزلينك ستور للإلكترونيات والكمبيوتر',
  store_phone: '01000000000',
  store_address: 'القاهرة، مصر',
  receipt_footer: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً وفقاً لقانون حماية المستهلك',
  printer_width: '80mm',
};

let currentLicenseCache = null;
let currentActiveShift = null;
let currentShiftSummary = null;
let lastClosedZReportText = '';

// Subtab switcher in Settings
function switchSettingsSubtab(tabName) {
  const tabs = ['license', 'credits', 'sync', 'backups', 'store', 'modules', 'shifts', 'updates'];
  tabs.forEach((t) => {
    const btn = document.getElementById(`btnSubtab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`paneSettings${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.style.display = t === tabName ? 'flex' : 'none';
  });

  if (tabName === 'credits') {
    loadCreditWallet();
  } else if (tabName === 'sync') {
    loadSyncStatus();
  } else if (tabName === 'backups') {
    loadBackupsList();
  } else if (tabName === 'store') {
    loadStoreAndTaxSettings();
  } else if (tabName === 'shifts') {
    refreshShiftStatus();
    loadShiftsHistory();
  } else if (tabName === 'updates') {
    loadUpdatesTab();
  }
}

// -------------------------------------------------------------
// Auto-Updater & In-App Release Management Engine
// -------------------------------------------------------------
let cachedUpdateInfo = null;
let updateDownloadPollInterval = null;

async function autoCheckForUpdatesOnStartup() {
  try {
    const res = await fetch('/api/update/check');
    const data = await res.json();

    if (data.success && data.hasUpdate) {
      cachedUpdateInfo = data;

      // Update current version displays
      const curDisplay = document.getElementById('currentAppVerDisplay');
      if (curDisplay) curDisplay.textContent = data.currentVersion || '1.0.0';

      // 1. Show Top Floating Update Alert Banner
      const banner = document.getElementById('updateAlertBanner');
      const bannerVer = document.getElementById('bannerLatestVer');
      if (banner && bannerVer) {
        bannerVer.textContent = 'v' + data.latestVersion;
        banner.style.display = 'flex';
      }

      // 2. Show Update Badges on Navigation & Settings
      const navBadge = document.getElementById('navUpdateBadge');
      if (navBadge) navBadge.style.display = 'inline-block';

      const dot = document.getElementById('subtabUpdateDot');
      if (dot) dot.style.display = 'inline-block';

      // 3. Show Toast Notice
      showToast(`🚀 يتوفر إصدار جديد لبرنامج الكاشير (v${data.latestVersion})! تفضل بزيارة الإعدادات للتحديث.`, 'info');
    }
  } catch (err) {
    console.warn('[AutoUpdater] Silent background check skipped:', err);
  }
}

function dismissUpdateBanner() {
  const banner = document.getElementById('updateAlertBanner');
  if (banner) banner.style.display = 'none';
}

function loadUpdatesTab() {
  const curDisplay = document.getElementById('currentAppVerDisplay');
  if (curDisplay && cachedUpdateInfo?.currentVersion) {
    curDisplay.textContent = cachedUpdateInfo.currentVersion;
  }

  if (cachedUpdateInfo) {
    renderUpdateCard(cachedUpdateInfo);
  } else {
    manualCheckForUpdates(true);
  }
}

async function manualCheckForUpdates(silent = false) {
  const btn = document.getElementById('btnManualCheckUpdate');
  const btnText = document.getElementById('btnUpdateText');
  const btnSpinner = document.getElementById('btnUpdateSpinner');
  const statusCard = document.getElementById('updateStatusCard');

  if (btnText && !silent) btnText.textContent = 'جاري الفحص عبر منصة QuazLink والسحابة...';
  if (btnSpinner) btnSpinner.style.display = 'inline';

  try {
    const res = await fetch('/api/update/check');
    const data = await res.json();

    if (btnText) btnText.textContent = '🔄 التحقق من وجود تحديثات (Check for Update)';
    if (btnSpinner) btnSpinner.style.display = 'none';

    if (data.success) {
      cachedUpdateInfo = data;
      const curDisplay = document.getElementById('currentAppVerDisplay');
      if (curDisplay) curDisplay.textContent = data.currentVersion || '1.1.0';

      renderUpdateCard(data);

      if (data.hasUpdate) {
        if (!silent) showToast(`🚀 يتوفر تحديث جديد: v${data.latestVersion}`, 'success');
        const navBadge = document.getElementById('navUpdateBadge');
        if (navBadge) navBadge.style.display = 'inline-block';
        const dot = document.getElementById('subtabUpdateDot');
        if (dot) dot.style.display = 'inline-block';
      } else {
        if (!silent) showToast('✅ برنامج الكاشير محدث لأحدث إصدار رسمي!', 'success');
      }
    } else {
      if (statusCard) {
        statusCard.style.display = 'block';
        statusCard.innerHTML = `
          <div style="color: var(--accent-amber); font-size: 0.88rem;">
            ⚠️ تعذر الاتصال بخادم التحديثات: ${data.error || 'يرجى التحقق من اتصالك بالإنترنت.'}
          </div>
        `;
      }
    }
  } catch (err) {
    if (btnText) btnText.textContent = '🔄 التحقق من وجود تحديثات (Check for Update)';
    if (btnSpinner) btnSpinner.style.display = 'none';
    if (!silent) showToast('تعذر فحص التحديثات حالياً', 'error');
  }
}

function renderUpdateCard(data) {
  const card = document.getElementById('updateStatusCard');
  if (!card) return;
  card.style.display = 'block';

  if (data.hasUpdate) {
    const sizeMB = data.assetSize > 0 ? (data.assetSize / (1024 * 1024)).toFixed(1) + ' MB' : '153.6 MB';
    const pubDate = data.publishedAt ? new Date(data.publishedAt).toLocaleDateString('ar-EG') : 'اليوم';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 1.3rem;">🚀</span>
            <strong style="color: #fff; font-size: 1.05rem;">يتوفر إصدار جديد جاهز للتثبيت!</strong>
            <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-family: 'JetBrains Mono'; font-weight: 800; font-size: 0.85rem; padding: 2px 10px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.4);">
              الإصدار الجديد: v${data.latestVersion}
            </span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 10px;">
            📅 تاريخ الإطلاق: <b>${pubDate}</b> • 📦 حجم التحديث: <b>${sizeMB}</b>
          </div>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; max-width: 650px;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #fff; display: block; margin-bottom: 4px;">ملاحظات الإصدار والتحسينات الجديدة:</span>
            <p style="margin: 0; font-size: 0.76rem; color: var(--text-dim); line-height: 1.5; white-space: pre-line;">${data.releaseNotes || 'تحسينات عامة على سرعة الطباعة، حوكمة السيريالات، واستقرار النظام.'}</p>
          </div>
        </div>

        <button type="button" class="btn-checkout primary" style="width: auto; padding: 12px 26px; font-weight: 800; font-size: 0.95rem; background: linear-gradient(135deg, #10b981, #06b6d4);" onclick="startUpdateDownload()">
          ⚡ تحميل وتثبيت التحديث الآن
        </button>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 1.5rem;">✅</span>
        <div>
          <strong style="color: #fff; font-size: 0.95rem; display: block;">برنامج الكاشير محدث بالكامل (Up-to-Date)!</strong>
          <span style="font-size: 0.76rem; color: var(--text-dim);">أنت تستخدم أحدث إصدار رسمي معتمد (v${data.currentVersion || '1.0.0'}). لا توجد تحديثات معلقة.</span>
        </div>
      </div>
    `;
  }
}

async function startUpdateDownload() {
  const statusCard = document.getElementById('updateStatusCard');
  const progCard = document.getElementById('updateProgressCard');
  const progStats = document.getElementById('updateProgressStats');
  const progBar = document.getElementById('updateProgressBar');

  if (statusCard) statusCard.style.display = 'none';
  if (progCard) progCard.style.display = 'block';

  showToast('⚡ بدأ تحميل حزمة التحديث في الخلفية...', 'info');

  try {
    const res = await fetch('/api/update/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl: cachedUpdateInfo?.downloadUrl || '' }),
    });
    const data = await res.json();

    if (!data.success) {
      showToast('خطأ: ' + (data.error || 'تعذر بدء التنزيل'), 'error');
      if (statusCard) statusCard.style.display = 'block';
      if (progCard) progCard.style.display = 'none';
      return;
    }

    // Start polling download progress
    if (updateDownloadPollInterval) clearInterval(updateDownloadPollInterval);
    updateDownloadPollInterval = setInterval(async () => {
      try {
        const sRes = await fetch('/api/update/status');
        const sData = await sRes.json();

        if (sData.success) {
          const pct = sData.percent || 0;
          if (progBar) progBar.style.width = pct + '%';
          if (progStats) progStats.textContent = `${pct}% (${sData.downloadedMB || '0'} MB / ${sData.totalMB || '0'} MB)`;

          if (pct >= 100 || !sData.isDownloading) {
            clearInterval(updateDownloadPollInterval);
            if (progStats) progStats.textContent = '100% (اكتمل التنزيل)';
            showToast('✅ اكتمل تنزيل التحديث! جاري فتح المثبت وإعادة تشغيل البرنامج...', 'success');
          }
        }
      } catch (pollErr) {
        // Ignored during restart
      }
    }, 700);

  } catch (err) {
    showToast('تعذر تنزيل التحديث', 'error');
    if (statusCard) statusCard.style.display = 'block';
    if (progCard) progCard.style.display = 'none';
  }
}


// -------------------------------------------------------------
// Load Settings & License Info
// -------------------------------------------------------------
async function initAppSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      appSettingsCache = { ...appSettingsCache, ...data.settings };
      applyAppSettingsUI();
    }
  } catch (e) {}

  refreshShiftStatus();
}

function applyAppSettingsUI() {
  const shiftsEnabled = appSettingsCache.enable_shifts === 'true';

  // Toggle shift indicator in header & POS shortcut ribbon
  const shiftHeader = document.getElementById('shiftHeaderPill');
  const shiftShortcut = document.getElementById('posShiftShortcutBtn');
  if (shiftHeader) shiftHeader.style.display = shiftsEnabled ? 'flex' : 'none';
  if (shiftShortcut) shiftShortcut.style.display = shiftsEnabled ? 'inline-flex' : 'none';

  // Update modules switches in settings
  const toggleShifts = document.getElementById('setting_enable_shifts');
  const toggleSerials = document.getElementById('setting_enable_serials');
  const toggleAi = document.getElementById('setting_enable_ai_ad');
  const toggleWa = document.getElementById('setting_enable_whatsapp');
  const toggleLedgers = document.getElementById('setting_enable_credit_ledgers');

  if (toggleShifts) toggleShifts.checked = shiftsEnabled;
  if (toggleSerials) toggleSerials.checked = appSettingsCache.enable_serials !== 'false';
  if (toggleAi) toggleAi.checked = appSettingsCache.enable_ai_ad !== 'false';
  if (toggleWa) toggleWa.checked = appSettingsCache.enable_whatsapp !== 'false';
  if (toggleLedgers) toggleLedgers.checked = appSettingsCache.enable_credit_ledgers !== 'false';

  // Update Store fields
  const sName = document.getElementById('setting_store_name');
  const sPhone = document.getElementById('setting_store_phone');
  const sAddr = document.getElementById('setting_store_address');
  const sFooter = document.getElementById('setting_receipt_footer');
  const sWidth = document.getElementById('setting_printer_width');

  if (sName) sName.value = appSettingsCache.store_name || '';
  if (sPhone) sPhone.value = appSettingsCache.store_phone || '';
  if (sAddr) sAddr.value = appSettingsCache.store_address || '';
  if (sFooter) sFooter.value = appSettingsCache.receipt_footer || '';
  if (sWidth) sWidth.value = appSettingsCache.printer_width || '80mm';
}

async function loadSettingsAndLicense() {
  await Promise.all([
    initAppSettings(),
    loadLicenseData(),
    loadCreditWallet(),
    loadSyncStatus(),
    loadStoreAndTaxSettings(),
  ]);
  if (appSettingsCache.enable_shifts === 'true') {
    refreshShiftStatus();
    loadShiftsHistory();
  }
}

async function loadLicenseData() {
  try {
    const res = await fetch('/api/license');
    const data = await res.json();
    if (data.success && data.license) {
      currentLicenseCache = data.license;
      renderLicenseUI(data.license);
    }
  } catch (e) {}
}

function renderLicenseUI(lic) {
  const hwDisplay = document.getElementById('licenseHwDisplay');
  const statusBadge = document.getElementById('licStatusBadge');
  const tierName = document.getElementById('licTierName');
  const expDate = document.getElementById('licExpiryDate');
  const daysRem = document.getElementById('licDaysRemaining');

  if (hwDisplay) hwDisplay.textContent = lic.hardwareId;

  if (statusBadge) {
    if (lic.status === 'active') {
      statusBadge.textContent = '✅ مفعل رسمياً';
      statusBadge.style.color = 'var(--accent-emerald)';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
    } else if (lic.status === 'trial') {
      statusBadge.textContent = '⚡ تجريبي مفتوح (Trial)';
      statusBadge.style.color = 'var(--accent-cyan)';
      statusBadge.style.background = 'rgba(6, 182, 212, 0.15)';
    } else {
      statusBadge.textContent = '⚠️ يحتاج تفعيل';
      statusBadge.style.color = 'var(--accent-amber)';
      statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
    }
  }

  if (tierName) {
    tierName.textContent = lic.tier === 'lifetime'
      ? 'ترخيص دائم (Lifetime License)'
      : lic.tier === 'saas_subscription'
        ? 'اشتراك سحابي دوري (Cloud SaaS)'
        : 'نسخة تجريبية كاملة (Enterprise Trial)';
  }

  if (expDate) {
    expDate.textContent = lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('ar-EG') : 'دائم (غير محدد بأجل)';
  }

  if (daysRem) {
    daysRem.textContent = lic.daysRemaining !== null ? `${lic.daysRemaining} يوم متبقي` : 'مدى الحياة ∞';
  }
}

function copyHardwareId() {
  if (!currentLicenseCache?.hardwareId) return;
  navigator.clipboard.writeText(currentLicenseCache.hardwareId).then(() => {
    showToast('تم نسخ بصمة الجهاز بنجاح. ضعها في منصة QuazLink لاستخراج الكود.', 'success');
  });
}

async function submitActivateLicense() {
  const input = document.getElementById('licenseKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) {
    showToast('برجاء كتابة أو لصق مفتاح الترخيص.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'تم تفعيل الترخيص بنجاح!', 'success');
      if (input) input.value = '';
      loadLicenseData();
    } else {
      showToast(data.message || 'فشل التفعيل: مفتاح غير صالح', 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بخدمة التراخيص', 'error');
  }
}

async function generateDemoTrialLicense() {
  if (!currentLicenseCache?.hardwareId) return;
  try {
    // Trigger activation of generated trial key
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: currentLicenseCache.licenseKey }),
    });
    showToast('تم تجديد الصلاحية التجريبية لجميع ميزات النظام بنجاح!', 'success');
    loadLicenseData();
  } catch (e) {}
}

function onShiftToggleChanged() {
  const checked = document.getElementById('setting_enable_shifts')?.checked;
  if (checked) {
    showToast('تم تحديد تفعيل إدارة الورديات. اضغط "حفظ إعدادات الموديولات" لتطبيق التغيير.', 'info');
  } else {
    showToast('تم إلغاء تفعيل الورديات. سيتمكن الكاشير من البيع المباشر دون الحاجة لفتح وردية.', 'info');
  }
}

async function saveModuleSettings() {
  const enableShifts = document.getElementById('setting_enable_shifts')?.checked ? 'true' : 'false';
  const enableSerials = document.getElementById('setting_enable_serials')?.checked ? 'true' : 'false';
  const enableAi = document.getElementById('setting_enable_ai_ad')?.checked ? 'true' : 'false';
  const enableWa = document.getElementById('setting_enable_whatsapp')?.checked ? 'true' : 'false';
  const enableLedgers = document.getElementById('setting_enable_credit_ledgers')?.checked ? 'true' : 'false';

  const payload = {
    enable_shifts: enableShifts,
    enable_serials: enableSerials,
    enable_ai_ad: enableAi,
    enable_whatsapp: enableWa,
    enable_credit_ledgers: enableLedgers,
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      appSettingsCache = { ...appSettingsCache, ...data.settings };
      applyAppSettingsUI();
      showToast('تم حفظ وتطبيق تخصيص الموديولات بنجاح!', 'success');
      refreshShiftStatus();
    }
  } catch (e) {
    showToast('تعذر حفظ الإعدادات', 'error');
  }
}

// -------------------------------------------------------------
// Store, Business Profile & ETA Egyptian Tax Authority Settings
// -------------------------------------------------------------
async function loadStoreAndTaxSettings() {
  try {
    const [settingsRes, profileRes] = await Promise.all([
      fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
      fetch('/api/business-profile').then((r) => r.json()).catch(() => ({})),
    ]);

    const s = settingsRes.success ? settingsRes.settings : {};
    const p = profileRes.success ? profileRes.profile : {};

    const sName = document.getElementById('setting_store_name');
    const sTax = document.getElementById('setting_tax_number');
    const sPhone = document.getElementById('setting_store_phone');
    const sAddr = document.getElementById('setting_store_address');
    const sBranch = document.getElementById('setting_tax_branch');
    const sCurr = document.getElementById('setting_currency');
    const sFooter = document.getElementById('setting_receipt_footer');
    const sWidth = document.getElementById('setting_printer_width');
    const sEta = document.getElementById('setting_enable_eta_receipts');

    if (sName) sName.value = p?.business_name || s?.store_name || '';
    if (sTax) sTax.value = p?.tax_number || s?.tax_number || '';
    if (sPhone) sPhone.value = p?.phone || s?.store_phone || '';
    if (sAddr) sAddr.value = p?.address || s?.store_address || '';
    if (sBranch) sBranch.value = p?.branch_code || '0';
    if (sCurr) sCurr.value = p?.currency || 'EGP';
    if (sFooter) sFooter.value = p?.receipt_footer || s?.receipt_footer || '';
    if (sWidth) sWidth.value = s?.printer_width || '80mm';
    if (sEta) sEta.checked = s?.enable_eta_receipts !== 'false';
  } catch (e) {
    console.error('Error loading store & tax settings:', e);
  }
}

async function saveStoreSettings() {
  const sName = document.getElementById('setting_store_name')?.value.trim();
  const sTax = document.getElementById('setting_tax_number')?.value.trim();
  const sPhone = document.getElementById('setting_store_phone')?.value.trim();
  const sAddr = document.getElementById('setting_store_address')?.value.trim();
  const sBranch = document.getElementById('setting_tax_branch')?.value.trim();
  const sCurr = document.getElementById('setting_currency')?.value.trim();
  const sFooter = document.getElementById('setting_receipt_footer')?.value.trim();
  const sWidth = document.getElementById('setting_printer_width')?.value;
  const enableEta = document.getElementById('setting_enable_eta_receipts')?.checked ? 'true' : 'false';

  const settingsPayload = {
    store_name: sName || appSettingsCache.store_name,
    tax_number: sTax || '',
    store_phone: sPhone || appSettingsCache.store_phone,
    store_address: sAddr || appSettingsCache.store_address,
    receipt_footer: sFooter || appSettingsCache.receipt_footer,
    printer_width: sWidth || '80mm',
    enable_eta_receipts: enableEta,
  };

  const profilePayload = {
    businessName: sName || undefined,
    taxNumber: sTax || undefined,
    phone: sPhone || undefined,
    address: sAddr || undefined,
    receiptFooter: sFooter || undefined,
    currency: sCurr || 'EGP',
    branchCode: sBranch || '0',
  };

  try {
    const [resSet, resProf] = await Promise.all([
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload),
      }),
      fetch('/api/business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload),
      }),
    ]);

    const dataSet = await resSet.json();
    if (dataSet.success) {
      appSettingsCache = { ...appSettingsCache, ...dataSet.settings };
      showToast('✅ تم حفظ بيانات المنشأة والملف الضريبي ETA بنجاح!', 'success');
    }
  } catch (e) {
    showToast('تعذر حفظ بيانات المحل والملف الضريبي', 'error');
  }
}

// -------------------------------------------------------------
// Credit Wallet & Cloud Services Vouchers
// -------------------------------------------------------------
async function loadCreditWallet() {
  try {
    const res = await fetch('/api/credits');
    const data = await res.json();
    if (data.success && data.credits) {
      const ai = data.credits.ai_tokens || { balance: 0, totalConsumed: 0 };
      const wa = data.credits.whatsapp_messages || { balance: 0, totalConsumed: 0 };

      const aiEl = document.getElementById('creditsAiTokens');
      const aiConsEl = document.getElementById('creditsAiConsumed');
      const waEl = document.getElementById('creditsWaMessages');
      const waConsEl = document.getElementById('creditsWaConsumed');

      if (aiEl) aiEl.textContent = ai.balance;
      if (aiConsEl) aiConsEl.textContent = `${ai.totalConsumed || 0} توكن`;
      if (waEl) waEl.textContent = wa.balance;
      if (waConsEl) waConsEl.textContent = `${wa.totalConsumed || 0} رسالة`;
    }
  } catch (e) {
    console.error('Error loading credits:', e);
  }
}

async function submitRedeemVoucher() {
  const input = document.getElementById('voucherCodeInput');
  const voucher = input ? input.value.trim() : '';
  if (!voucher) {
    showToast('برجاء إدخال كود الكوبون للشحن.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/credits/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voucher }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || '✅ تم شحن الرصيد بنجاح!', 'success');
      if (input) input.value = '';
      loadCreditWallet();
    } else {
      showToast(data.message || 'كود الكوبون غير صالح أو تم استخدامه مسبقاً', 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بخدمة شحن الكريديت', 'error');
  }
}

async function generateDemoVoucher(type = 'ai') {
  const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
  const code = type === 'ai' ? `QLV-AI-50-${randomHex}` : `QLV-WA-100-${randomHex}`;
  const input = document.getElementById('voucherCodeInput');
  if (input) {
    input.value = code;
    showToast(`تم إدراج كود تجريبي: ${code}. اضغط "شحن الكوبون الآن" للتأكيد.`, 'info');
  }
}

// -------------------------------------------------------------
// Cloud Sync Engine & Offline-First Monitoring
// -------------------------------------------------------------
async function loadSyncStatus() {
  try {
    const res = await fetch('/api/sync/status');
    const data = await res.json();
    if (data.success) {
      const statusBadge = document.getElementById('syncCloudStatusBadge');
      const pendingBadge = document.getElementById('syncPendingCountBadge');
      const lastTimeDisplay = document.getElementById('syncLastTimeDisplay');
      const endpointInput = document.getElementById('setting_cloud_api_endpoint');
      const intervalInput = document.getElementById('setting_cloud_sync_interval_mins');
      const enabledToggle = document.getElementById('setting_cloud_sync_enabled');

      if (statusBadge) {
        if (data.online) {
          statusBadge.textContent = `🟢 متصل بالسحابة (${data.latencyMs}ms)`;
          statusBadge.style.color = 'var(--accent-emerald)';
          statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        } else {
          statusBadge.textContent = '🔴 وضع عدم الاتصال (Offline-First)';
          statusBadge.style.color = 'var(--accent-amber)';
          statusBadge.style.background = 'rgba(245, 158, 11, 0.15)';
        }
      }

      if (pendingBadge) {
        const count = data.pendingCounts?.invoices || 0;
        pendingBadge.textContent = `${count} فواتير`;
        pendingBadge.style.color = count > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)';
      }

      if (lastTimeDisplay) {
        lastTimeDisplay.textContent = data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ar-EG') : 'لم تتم بعد';
      }

      if (endpointInput && !endpointInput.value) {
        endpointInput.value = data.endpoint || 'https://api.quazlink.com/v1/pos';
      }
      if (intervalInput && !intervalInput.value) {
        intervalInput.value = data.autoSyncIntervalMins || 15;
      }
      if (enabledToggle) {
        enabledToggle.checked = data.autoSyncEnabled !== false;
      }

      renderSyncLog(data.syncLog || []);
    }
  } catch (e) {
    console.error('Error loading sync status:', e);
  }
}

function renderSyncLog(logs) {
  const tbody = document.getElementById('syncLogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:18px; color:var(--text-dim)">لا توجد عمليات مزامنة سابقة حتى الآن</td></tr>';
    return;
  }

  logs.forEach((log) => {
    const isSuccess = log.status === 'success';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-terminal">${log.sync_direction === 'push' ? '⬆️ رفع (Push)' : '⬇️ سحب (Pull)'}</span></td>
      <td><span class="badge-terminal" style="color: ${isSuccess ? 'var(--accent-emerald)' : 'var(--accent-red)'}">${isSuccess ? '✅ نجاح' : '❌ فشل'}</span></td>
      <td style="font-family:'JetBrains Mono'; color:var(--accent-cyan);">${log.pushed_count || 0}</td>
      <td style="font-family:'JetBrains Mono';">${log.pulled_count || 0}</td>
      <td style="font-family:'JetBrains Mono'; font-size:0.75rem;">${log.duration_ms || 0}ms</td>
      <td style="font-size:0.75rem; color:var(--text-muted);">${log.created_at ? new Date(log.created_at).toLocaleString('ar-EG') : '-'}</td>
      <td style="font-size:0.75rem; color:var(--text-dim);">${log.details || log.error_message || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function triggerManualSync() {
  showToast('جاري بدء المزامنة السحابية للفواتير والبيانات...', 'info');
  try {
    const res = await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || '✅ اكتملت المزامنة السحابية بنجاح!', 'success');
      loadSyncStatus();
    } else {
      showToast('خطأ أثناء المزامنة: ' + (data.message || 'تعذر الاتصال'), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بخادم المزامنة', 'error');
  }
}

async function testCloudConnection() {
  showToast('جاري فحص سرعة الاتصال بالسحابة...', 'info');
  try {
    const res = await fetch('/api/sync/status');
    const data = await res.json();
    if (data.success) {
      showToast(`فحص الاتصال: ${data.online ? 'متصل بنجاح 🟢' : 'غير متصل 🔴'} (زمن الاستجابة: ${data.latencyMs}ms)`, data.online ? 'success' : 'warning');
      loadSyncStatus();
    }
  } catch (e) {
    showToast('فشل فحص الاتصال بالسحابة', 'error');
  }
}

async function saveSyncSettings() {
  const endpoint = document.getElementById('setting_cloud_api_endpoint')?.value.trim();
  const interval = document.getElementById('setting_cloud_sync_interval_mins')?.value.trim();
  const enabled = document.getElementById('setting_cloud_sync_enabled')?.checked ? 'true' : 'false';

  const payload = {
    cloud_api_endpoint: endpoint || undefined,
    cloud_sync_interval_mins: interval || '15',
    cloud_sync_enabled: enabled,
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم حفظ إعدادات المزامنة السحابية بنجاح!', 'success');
      loadSyncStatus();
    }
  } catch (e) {
    showToast('تعذر حفظ إعدادات السحابة', 'error');
  }
}

// -------------------------------------------------------------
// Atomic Backups & Disaster Recovery (.qzbk)
// -------------------------------------------------------------
async function loadBackupsList() {
  const tbody = document.getElementById('backupsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/backups');
    const data = await res.json();
    tbody.innerHTML = '';

    if (!data.success || !data.backups || data.backups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--text-dim)">لا توجد نسخ احتياطية مسجلة على هذا الجهاز حتى الآن</td></tr>';
      return;
    }

    data.backups.forEach((b) => {
      const sizeKb = (b.fileSizeBytes / 1024).toFixed(1);
      const isCloud = b.backupType === 'cloud';
      const truncatedHash = b.checksumSha256 ? `${b.checksumSha256.substring(0, 8)}...${b.checksumSha256.substring(56)}` : '-';
      const createdStr = b.createdAt ? new Date(b.createdAt).toLocaleString('ar-EG') : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#fff; font-family:'JetBrains Mono'; font-size:0.8rem;">${b.id}</strong></td>
        <td><span class="badge-terminal" style="color:${isCloud ? 'var(--accent-cyan)' : 'var(--accent-emerald)'}">${isCloud ? '☁️ سحابية' : '💾 محلية'}</span></td>
        <td style="font-family:'JetBrains Mono'; font-size:0.8rem;">${sizeKb} KB</td>
        <td>
          <code title="${b.checksumSha256}" style="cursor:pointer;" onclick="navigator.clipboard.writeText('${b.checksumSha256}').then(() => showToast('تم نسخ بصمة SHA-256', 'info'))">${truncatedHash}</code>
        </td>
        <td style="font-size:0.75rem; color:var(--text-muted);">${createdStr}</td>
        <td style="font-size:0.75rem; color:var(--text-dim);">${b.notes || '-'}</td>
        <td>
          <div class="table-actions-group">
            <a href="/api/backups/${b.id}/download" download="quazlink_backup_${b.id}.qzbk" class="btn-action btn-action-cyan" style="text-decoration:none;" title="تحميل ملف النسخة">📥 تحميل</a>
            <button class="btn-action" style="border-color:var(--accent-amber); color:var(--accent-amber);" onclick="restoreBackupSubmit('${b.id}')" title="استعادة هذه النسخة">🔄 استعادة</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Error loading backups:', e);
  }
}

async function createBackupSubmit(type = 'local') {
  showToast(`جاري إنشاء نسخة احتياطية ${type === 'cloud' ? 'سحابية' : 'محلية'} مشفرة...`, 'info');
  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        notes: `نسخة ${type === 'cloud' ? 'سحابية' : 'محلية'} من واجهة المستخدم - ${new Date().toLocaleTimeString('ar-EG')}`,
      }),
    });
    const data = await res.json();
    if (data.success && data.backup) {
      showToast(`✅ تم إنشاء النسخة الاحتياطية بنجاح بنظام .qzbk (${(data.backup.fileSizeBytes / 1024).toFixed(1)} KB)`, 'success');
      loadBackupsList();
    } else {
      showToast('خطأ أثناء إنشاء النسخة: ' + (data.error || ''), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بالسيرفر لإنشاء النسخة الاحتياطية', 'error');
  }
}

async function restoreBackupSubmit(backupId) {
  if (!confirm('⚠️ تحذير أمان واستعادة:\nهل أنت متأكد من استعادة هذه النسخة الاحتياطية؟\nسيتم استبدال المنتجات والفواتير الحالية بما هو محفوظ بالنسخة.')) {
    return;
  }

  showToast('جاري استعادة قاعدة البيانات ذرياً وفك تشفير النسخة...', 'info');
  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: backupId }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ تمت استعادة قاعدة البيانات بنجاح واسترجاع كافة المنتجات والفواتير!', 'success');
      loadQuickProducts();
      refreshLowStockCount();
      loadSettingsAndLicense();
    } else {
      showToast('فشلت عملية الاستعادة: ' + (data.message || ''), 'error');
    }
  } catch (e) {
    showToast('تعذر إتمام عملية الاستعادة', 'error');
  }
}

function handleRestoreFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      if (!confirm('⚠️ تحذير:\nهل أنت متأكد من استعادة قاعدة البيانات من الملف المختار؟')) {
        event.target.value = '';
        return;
      }

      showToast('جاري معالجة واستعادة الملف...', 'info');
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: content }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ تمت استعادة النسخة من الملف بنجاح!', 'success');
        loadQuickProducts();
        refreshLowStockCount();
        loadSettingsAndLicense();
      } else {
        showToast('فشل الاستيراد: ' + (data.message || 'الملف تالف'), 'error');
      }
    } catch (err) {
      showToast('ملف غير صالح', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// Shift Management & Cash Drawer Reconciliation
// -------------------------------------------------------------
async function refreshShiftStatus() {
  try {
    const res = await fetch('/api/shifts/current');
    const data = await res.json();

    const indicator = document.getElementById('shiftStatusIndicator');
    const statusText = document.getElementById('shiftStatusText');
    const title = document.getElementById('shiftCurrentTitle');
    const sub = document.getElementById('shiftCurrentSubtitle');
    const btnGroup = document.getElementById('shiftActionsBtnGroup');

    if (data.success && data.hasActiveShift && data.shift) {
      currentActiveShift = data.shift;
      currentShiftSummary = data.summary;

      // Update header pill
      if (indicator) indicator.style.background = '#10b981';
      if (statusText) statusText.textContent = `وردية مفتوحة (#${data.shift.shift_number})`;

      // Update settings widget
      if (title) title.textContent = `الوردية الحالية: #${data.shift.shift_number} (${data.shift.cashier_name})`;
      if (sub) sub.textContent = `مفتوحة منذ: ${new Date(data.shift.opened_at).toLocaleString('ar-EG')}`;

      if (btnGroup) {
        btnGroup.innerHTML = `
          <button type="button" class="btn-sub" style="border-color:var(--accent-amber); color:var(--accent-amber);" onclick="openPettyExpenseModal()">💸 تسجيل مصروف نثري</button>
          <button type="button" class="btn-checkout primary" style="width:auto; padding:6px 16px;" onclick="openCloseShiftModal()">🔒 تقفيل الوردية Z-Report</button>
        `;
      }

      // Populate Live Drawer Matrix
      const s = data.summary;
      if (s) {
        document.getElementById('sdOpeningCash').textContent = `${s.openingAmount.toFixed(2)} EGP`;
        document.getElementById('sdSalesCash').textContent = `+${s.totalSalesCash.toFixed(2)} EGP`;
        document.getElementById('sdPaymentsIn').textContent = `+${s.totalPaymentsReceivedCash.toFixed(2)} EGP`;
        document.getElementById('sdReturnsOut').textContent = `-${s.totalReturnsCash.toFixed(2)} EGP`;
        document.getElementById('sdExpensesOut').textContent = `-${s.totalExpenses.toFixed(2)} EGP`;
        document.getElementById('sdExpectedDrawer').textContent = `${s.expectedDrawerAmount.toFixed(2)} EGP`;
      }
    } else {
      currentActiveShift = null;
      currentShiftSummary = null;

      if (indicator) indicator.style.background = '#ef4444';
      if (statusText) statusText.textContent = 'الوردية مغلقة';

      if (title) title.textContent = 'الخزينة مغلقة حالياً (لا توجد وردية مفتوحة)';
      if (sub) sub.textContent = 'افتح وردية كاشير جديدة لبدء تسجيل وحصر النقدية اليومية.';

      if (btnGroup) {
        btnGroup.innerHTML = `
          <button type="button" class="btn-primary" onclick="openOpenShiftModal()">+ فتح وردية كاشير جديدة</button>
        `;
      }

      const opEl = document.getElementById('sdOpeningCash');
      if (opEl) {
        document.getElementById('sdOpeningCash').textContent = '0.00 EGP';
        document.getElementById('sdSalesCash').textContent = '0.00 EGP';
        document.getElementById('sdPaymentsIn').textContent = '0.00 EGP';
        document.getElementById('sdReturnsOut').textContent = '0.00 EGP';
        document.getElementById('sdExpensesOut').textContent = '0.00 EGP';
        document.getElementById('sdExpectedDrawer').textContent = '0.00 EGP';
      }
    }
  } catch (e) {}
}

function openShiftControlModal() {
  if (!currentActiveShift) {
    openOpenShiftModal();
  } else {
    switchView('settingsView');
    switchSettingsSubtab('shifts');
  }
}

// 1. Open Shift Modal Logic
function openOpenShiftModal() {
  document.getElementById('openShiftCashierInput').value = 'الكاشير الرئيسي';
  document.getElementById('openShiftFloatInput').value = '0';
  document.getElementById('openShiftNotesInput').value = '';
  document.getElementById('openShiftModal').classList.add('active');
  setTimeout(() => document.getElementById('openShiftFloatInput').focus(), 60);
}

function closeOpenShiftModal() {
  document.getElementById('openShiftModal').classList.remove('active');
}

async function confirmOpenShiftSubmit() {
  const cashier = document.getElementById('openShiftCashierInput').value.trim();
  const floatVal = parseFloat(document.getElementById('openShiftFloatInput').value) || 0;
  const notes = document.getElementById('openShiftNotesInput').value.trim();

  try {
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openingAmount: floatVal,
        cashierName: cashier || undefined,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم فتح الوردية رقم #${data.shift.shift_number} بنجاح بعُهدة ${floatVal.toFixed(2)} EGP`, 'success');
      closeOpenShiftModal();
      refreshShiftStatus();
      loadShiftsHistory();
    } else {
      showToast('خطأ: ' + (data.error || 'تعذر فتح الوردية'), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بالسيرفر لفتح الوردية', 'error');
  }
}

// 2. Petty Expense Modal Logic
function openPettyExpenseModal() {
  document.getElementById('pettyExpenseAmountInput').value = '';
  document.getElementById('pettyExpenseReasonInput').value = '';
  document.getElementById('pettyExpenseModal').classList.add('active');
  setTimeout(() => document.getElementById('pettyExpenseAmountInput').focus(), 60);
}

function closePettyExpenseModal() {
  document.getElementById('pettyExpenseModal').classList.remove('active');
}

async function confirmPettyExpenseSubmit() {
  const amount = parseFloat(document.getElementById('pettyExpenseAmountInput').value) || 0;
  const category = document.getElementById('pettyExpenseCategorySelect').value;
  const reason = document.getElementById('pettyExpenseReasonInput').value.trim();

  if (amount <= 0 || !reason) {
    showToast('برجاء كتابة مبلغ المصروف والسبب بشكل صحيح.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/shifts/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, category, reason }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`تم تسجيل المصروف بقيمة ${amount.toFixed(2)} EGP وخصمه من الدرج`, 'success');
      closePettyExpenseModal();
      refreshShiftStatus();
    } else {
      showToast('خطأ: ' + (data.error || 'تعذر تسجيل المصروف'), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بالسيرفر', 'error');
  }
}

// 3. Close Shift Modal Logic (Z-Report)
async function openCloseShiftModal() {
  if (!currentActiveShift) {
    showToast('لا توجد وردية نشطة لتقفيلها حالياً.', 'warning');
    return;
  }

  await refreshShiftStatus();
  const summary = currentShiftSummary;
  const expectedVal = summary ? summary.expectedDrawerAmount : 0;

  document.getElementById('closeShiftSubtitle').textContent = `الوردية #${currentActiveShift.shift_number} — ${currentActiveShift.cashier_name}`;
  document.getElementById('closeShiftExpectedVal').textContent = `${expectedVal.toFixed(2)} EGP`;
  document.getElementById('closeShiftActualInput').value = expectedVal.toFixed(2);
  document.getElementById('closeShiftNotesInput').value = '';

  calcCloseShiftDifference();
  document.getElementById('closeShiftModal').classList.add('active');
  setTimeout(() => {
    const el = document.getElementById('closeShiftActualInput');
    if (el) {
      el.focus();
      el.select();
    }
  }, 60);
}

function closeCloseShiftModal() {
  document.getElementById('closeShiftModal').classList.remove('active');
}

function calcCloseShiftDifference() {
  const expected = currentShiftSummary ? currentShiftSummary.expectedDrawerAmount : 0;
  const actual = parseFloat(document.getElementById('closeShiftActualInput').value) || 0;
  const diff = Number((actual - expected).toFixed(2));

  const diffVal = document.getElementById('closeShiftDiffVal');
  const diffCard = document.getElementById('closeShiftDiffCard');

  if (diff === 0) {
    diffVal.textContent = '0.00 EGP (مطابق تماماً ✓)';
    diffVal.style.color = 'var(--accent-emerald)';
    diffCard.style.borderColor = 'rgba(16,185,129,0.4)';
    diffCard.style.background = 'rgba(16,185,129,0.1)';
  } else if (diff > 0) {
    diffVal.textContent = `+${diff.toFixed(2)} EGP (زيادة بالدرج 💰)`;
    diffVal.style.color = 'var(--accent-cyan)';
    diffCard.style.borderColor = 'rgba(6,182,212,0.4)';
    diffCard.style.background = 'rgba(6,182,212,0.1)';
  } else {
    diffVal.textContent = `${diff.toFixed(2)} EGP (عجز بالدرج ⚠️)`;
    diffVal.style.color = 'var(--accent-amber)';
    diffCard.style.borderColor = 'rgba(245,158,11,0.4)';
    diffCard.style.background = 'rgba(245,158,11,0.1)';
  }
}

async function confirmCloseShiftSubmit() {
  if (!currentActiveShift) return;
  const actual = parseFloat(document.getElementById('closeShiftActualInput').value) || 0;
  const notes = document.getElementById('closeShiftNotesInput').value.trim();

  try {
    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftId: currentActiveShift.id,
        actualCountedAmount: actual,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      closeCloseShiftModal();
      showToast(`تم إغلاق الوردية #${data.shift.shift_number} واعتماد تقرير Z-Report بنجاح!`, 'success');
      refreshShiftStatus();
      loadShiftsHistory();

      if (data.zReportText) {
        lastClosedZReportText = data.zReportText;
        openZReportModal(data.zReportText);
      }
    } else {
      showToast('خطأ أثناء تقفيل الوردية: ' + (data.error || ''), 'error');
    }
  } catch (e) {
    showToast('تعذر الاتصال بالسيرفر لتقفيل الوردية', 'error');
  }
}

// 4. Z-Report View & Print Modal
function openZReportModal(zReportText) {
  lastClosedZReportText = zReportText;
  const paper = document.getElementById('zReportPaper');
  if (paper) paper.textContent = zReportText;
  document.getElementById('zReportModal').classList.add('active');
}

function closeZReportModal() {
  document.getElementById('zReportModal').classList.remove('active');
}

async function printZReportThermal() {
  if (!lastClosedZReportText) return;
  try {
    const res = await fetch('/api/printer/print-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeName: appSettingsCache.store_name,
        invoiceNumber: 'Z-REPORT',
        dateStr: new Date().toLocaleString('ar-EG'),
        cashierName: 'POS MANAGER',
        currency: 'EGP',
        subtotal: 0,
        finalAmount: 0,
        paidAmount: 0,
        items: [{ name: 'Z-Report Daily Reconciliation', quantity: 1, unitPrice: 0, totalPrice: 0 }],
      }),
    });
    showToast('تم إرسال أمر طباعة تقرير Z-Report للطابعة الحرارية', 'success');
  } catch (e) {
    showToast('خطأ أثناء إرسال أمر الطباعة', 'error');
  }
}

async function loadShiftsHistory() {
  const tbody = document.getElementById('shiftsHistoryTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/shifts');
    const data = await res.json();
    tbody.innerHTML = '';

    if (!data.success || !data.shifts || data.shifts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:25px; color:var(--text-dim)">لا توجد ورديات مسجلة حتى الآن</td></tr>';
      return;
    }

    data.shifts.forEach((shift) => {
      const isClosed = shift.status === 'closed';
      const openTime = new Date(shift.opened_at).toLocaleString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const closeTime = shift.closed_at
        ? new Date(shift.closed_at).toLocaleString('ar-EG', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '<span style="color:var(--accent-emerald)">مفتوحة حالياً</span>';

      const diff = shift.difference_amount !== null && shift.difference_amount !== undefined ? shift.difference_amount : null;
      let diffHtml = '<span style="color:var(--text-dim);">-</span>';
      if (diff !== null) {
        if (diff === 0) diffHtml = '<span style="color:var(--accent-emerald); font-weight:700;">0.00 EGP ✓</span>';
        else if (diff > 0) diffHtml = `<span style="color:var(--accent-cyan); font-weight:700;">+${diff.toFixed(2)} EGP</span>`;
        else diffHtml = `<span style="color:var(--accent-amber); font-weight:700;">${diff.toFixed(2)} EGP</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:#fff;">#${shift.shift_number}</strong></td>
        <td>${shift.cashier_name}</td>
        <td style="font-size:0.75rem; color:var(--text-muted);">${openTime}</td>
        <td style="font-size:0.75rem;">${closeTime}</td>
        <td class="price-text">${shift.opening_amount.toFixed(2)} EGP</td>
        <td class="price-text" style="color:var(--accent-emerald);">${(shift.total_sales_cash || 0).toFixed(2)} EGP</td>
        <td class="price-text">${(shift.expected_amount || 0).toFixed(2)} EGP</td>
        <td class="price-text">${(shift.closing_amount !== null && shift.closing_amount !== undefined) ? `${shift.closing_amount.toFixed(2)} EGP` : '-'}</td>
        <td>${diffHtml}</td>
        <td>
          <div class="table-actions-group">
            ${isClosed ? `<button class="btn-action btn-action-cyan" onclick="viewHistoricalZReport('${shift.id}')">📊 عرض Z-Report</button>` : '<span class="badge-stock in-stock">نشطة</span>'}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {}
}

async function viewHistoricalZReport(shiftId) {
  try {
    const res = await fetch(`/api/shifts/${shiftId}/summary`);
    const data = await res.json();
    if (data.success && data.zReportText) {
      openZReportModal(data.zReportText);
    }
  } catch (e) {
    showToast('تعذر جلب تقرير الوردية', 'error');
  }
}

