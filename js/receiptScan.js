let tesseractModulePromise = null;
const TESSERACT_BASE = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist';
const TESSERACT_CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js';

async function loadTesseractModule() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import(`${TESSERACT_BASE}/tesseract.esm.min.js`);
  }
  return tesseractModulePromise;
}

function normalizePrice(raw) {
  const cleaned = raw.replace(/[^0-9.,]/g, '');
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const value = parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

function parseSignedAmount(rawMatch, digits, forceNegative = false) {
  const raw = rawMatch || '';
  const value = normalizePrice(digits || rawMatch);
  if (value == null) return null;
  const hasParens = raw.includes('(') && raw.includes(')');
  const hasLeadingMinus = /^\s*-/.test(raw);
  const hasTrailingMinus = /-\s*$/.test(raw);
  const negative = forceNegative || hasParens || hasLeadingMinus || hasTrailingMinus;
  return negative ? -Math.abs(value) : Math.abs(value);
}

function cleanItemName(raw) {
  let name = raw.trim();
  name = name.replace(/^[0-9]+\s*(x|@)\s*/i, '');
  name = name.replace(/^[0-9]+\s+/g, '');
  name = name.replace(/[-:]+$/g, '').trim();
  return name || 'Item';
}

function parseReceiptLines(lines) {
  const ignoreItemLine = /(?:change|cash|credit|debit|visa|mastercard|amex|discover|balance|tender|amount due|payment|paid|auth|approval|ref|card)/i;
  const totalLine = /\btotal\b/i;
  const subtotalLine = /sub\s*total/i;
  const taxLine = /\b(tax|vat|gst|hst|pst|sales tax)\b/i;
  const discountLine = /\b(discount|coupon|promo|promotion|savings|save|member|loyalty|deal|markdown)\b/i;
  const feeLine = /\b(service|surcharge|gratuity|tip|svc|service charge)\b/i;
  const priceRegex = /(?:\$|usd|us\$)?\s*[-(]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))\s*\)?-?/gi;

  const items = [];
  let detectedTotal = null;
  let pendingName = '';

  for (const line of lines) {
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) continue;
    const isSubtotal = subtotalLine.test(compact);
    const isTotal = totalLine.test(compact) && !isSubtotal;
    if (isTotal || isSubtotal) {
      pendingName = '';
    }
    const matches = Array.from(compact.matchAll(priceRegex));
    if (!matches.length) {
      if (/[a-z]/i.test(compact) && !ignoreItemLine.test(compact)) {
        pendingName = pendingName ? `${pendingName} ${compact}` : compact;
        if (pendingName.length > 120) {
          pendingName = pendingName.slice(0, 120);
        }
      }
      continue;
    }

    const lastMatch = matches[matches.length - 1];
    const isTax = taxLine.test(compact);
    const isDiscount = discountLine.test(compact);
    const isFee = feeLine.test(compact);
    const priceValue = parseSignedAmount(lastMatch[0], lastMatch[1], isDiscount);
    if (priceValue == null) continue;

    if (isTotal && priceValue > 0) {
      if (detectedTotal == null || priceValue > detectedTotal) {
        detectedTotal = priceValue;
      }
    }

    if (isSubtotal) continue;
    if (ignoreItemLine.test(compact) && !isTax && !isDiscount && !isFee) continue;
    if (!/[a-z]/i.test(compact) && !isTax && !isDiscount && !isFee && !pendingName) continue;

    const namePart = compact.slice(0, lastMatch.index).trim() || compact.replace(lastMatch[0], '').trim();
    let name = cleanItemName(namePart);
    if ((!namePart || name === 'Item') && pendingName) {
      name = cleanItemName(pendingName);
    }
    if (isTax && name === 'Item') name = 'Tax';
    if (isDiscount && name === 'Item') name = 'Discount';
    if (isFee && name === 'Item') name = 'Service';
    const type = isTax ? 'tax' : isDiscount ? 'discount' : isFee ? 'fee' : 'item';
    items.push({ name, price: priceValue, type, raw: compact });
    pendingName = '';
  }

  return { items, detectedTotal };
}

export async function scanReceiptImage(file, onProgress) {
  let createWorker;
  try {
    const mod = await loadTesseractModule();
    createWorker = mod?.createWorker || mod?.default?.createWorker || mod?.default;
  } catch (err) {
    throw new Error('OCR library failed to load. Check your network or host Tesseract locally.');
  }
  if (typeof createWorker !== 'function') {
    throw new Error('OCR library did not expose createWorker. Try reloading or use a local bundle.');
  }
  const worker = await createWorker({
    logger: (msg) => {
      if (msg?.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(msg.progress || 0);
      }
    },
    workerPath: `${TESSERACT_BASE}/worker.min.js`,
    corePath: TESSERACT_CORE
  });

  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data } = await worker.recognize(file);
  await worker.terminate();

  const text = data?.text || '';
  const lines = text.split(/\r?\n/);
  const { items, detectedTotal } = parseReceiptLines(lines);
  const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
  return { text, items, detectedTotal, itemsTotal };
}
