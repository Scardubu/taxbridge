import type { FastifyInstance } from 'fastify';

// Lazy-loaded to avoid startup cost when OCR endpoint not in use
let visionClient: any = null;
async function getVisionClient() {
  if (visionClient) return visionClient;
  if (!process.env.GOOGLE_CLOUD_KEY_FILE) return null;
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  visionClient = new ImageAnnotatorClient({ keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE });
  return visionClient;
}

// ─── Nigerian expense categories (NTA 2025) ──────────────────────────────────

const CATEGORIES: Record<string, string[]> = {
  fuel:                  ['petrol', 'diesel', 'fuel', 'nnpc', 'conoil', 'oando', 'total', 'ardova'],
  meals_entertainment:   ['restaurant', 'eatery', 'cafe', 'food', 'chicken', 'suya', 'bukka', 'mr biggs'],
  office_supplies:       ['stationery', 'printer', 'paper', 'pen', 'office', 'shoprite', 'spar'],
  transportation:        ['uber', 'bolt', 'taxi', 'danfo', 'okada', 'transport', 'bus', 'flight', 'dana'],
  utilities:             ['nepa', 'ekedc', 'ikedc', 'aedc', 'phcn', 'electricity', 'water', 'dstv', 'gotv', 'startimes'],
  telecoms:              ['mtn', 'airtel', 'glo', '9mobile', 'etisalat', 'smile', 'spectranet', 'ipnx'],
  professional_services: ['consulting', 'legal', 'accounting', 'audit', 'lawyer', 'counsel', 'advisory'],
  rent:                  ['rent', 'lease', 'tenancy', 'property', 'estate', 'landlord', 'property'],
  repairs_maintenance:   ['repair', 'maintenance', 'generator', 'service', 'mechanic', 'spare', 'parts'],
  medical:               ['pharmacy', 'hospital', 'clinic', 'drugstore', 'medplus', 'healthplus', 'drugs'],
  banking_charges:       ['bank', 'commission', 'charges', 'transfer fee', 'access', 'gtb', 'zenith', 'uba', 'fidelity', 'sterling', 'polaris'],
  advertising:           ['advertising', 'marketing', 'print', 'design', 'flyer', 'banner', 'social media'],
  general:               [],
};

// ─── Image extraction ────────────────────────────────────────────────────────

async function extractWithVision(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const client = await getVisionClient();
  if (!client) throw new Error('Vision client unavailable');

  const [result] = await client.textDetection({ image: { content: buffer.toString('base64') } });
  const annotation = result.textAnnotations?.[0];
  return {
    text: annotation?.description ?? '',
    confidence: annotation?.confidence ?? 0.75, // Vision doesn't always return confidence
  };
}

async function extractWithTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const Tesseract = await import('tesseract.js');
  const { data } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} });
  return { text: data.text, confidence: data.confidence / 100 };
}

async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .toBuffer();
}

// ─── Parser ──────────────────────────────────────────────────────────────────

function parseReceipt(rawText: string) {
  const text = rawText;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Amount extraction: ₦, NGN, or "Total" patterns
  const amountRegex = /(?:₦|NGN|N)\s*([\d,]+(?:\.\d{2})?)|(?:[Tt]otal|TOTAL|Amount|AMOUNT)[:\s]+([\d,]+(?:\.\d{2})?)/g;
  const amounts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountRegex.exec(text)) !== null) {
    const raw = (m[1] || m[2]).replace(/,/g, '');
    const v = parseFloat(raw);
    if (v > 0 && v < 100_000_000) amounts.push(v);
  }

  // Date extraction
  const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  const dates = [...text.matchAll(dateRegex)].map((dm) => {
    const [, d, mo, y] = dm;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  });

  // VAT detection
  const vatMatch = text.match(/VAT[:\s]+([\d,]+(?:\.\d{2})?)/i);
  const vatAmount = vatMatch ? parseFloat(vatMatch[1].replace(/,/g, '')) : null;

  // Merchant name (first non-empty line)
  const merchantName = lines[0] ?? 'Unknown Merchant';

  // Category detection
  const lowerText = text.toLowerCase();
  let category = 'general';
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      category = cat;
      break;
    }
  }

  // Line items (lines that look like: description   amount)
  const itemRegex = /^(.+?)\s+([\d,]+(?:\.\d{2})?)$/;
  const items: { description: string; amount: number }[] = [];
  for (const line of lines.slice(1, -3)) {
    const itemMatch = line.match(itemRegex);
    if (itemMatch) {
      const amount = parseFloat(itemMatch[2].replace(/,/g, ''));
      if (amount > 0 && amount < 10_000_000) {
        items.push({ description: itemMatch[1].trim(), amount });
      }
    }
  }

  return {
    merchantName,
    amount: amounts.length > 0 ? Math.max(...amounts) : 0,
    date: dates[0] ?? new Date().toISOString().split('T')[0],
    vatAmount,
    category,
    items: items.slice(0, 20), // Cap at 20 line items
  };
}

function buildWarnings(
  parsed: ReturnType<typeof parseReceipt>,
  confidence: number
): string[] {
  const w: string[] = [];
  if (confidence < 0.6) w.push('ocr.lowConfidence');
  if (parsed.amount === 0) w.push('ocr.noAmount');
  if (parsed.merchantName === 'Unknown Merchant') w.push('ocr.noMerchant');
  if (!parsed.vatAmount && parsed.amount > 1_000) w.push('ocr.vatNotDetected');
  if (parsed.items.length === 0) w.push('ocr.noLineItems');
  return w;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default async function ocrRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/v1/ocr/extract',
    { preHandler: [(fastify as any).authenticate] },
    async (req, reply) => {
      const { image, imageType = 'base64' } = req.body as {
        image: string;
        imageType?: 'base64' | 'url';
      };

      if (!image) {
        return reply.code(400).send({ success: false, error: 'image field required' });
      }

      // 5 MB limit
      if (imageType === 'base64' && image.length > 7_000_000) {
        return reply.code(413).send({ success: false, error: 'Image exceeds 5MB limit' });
      }

      let buffer: Buffer;
      if (imageType === 'url') {
        const res = await fetch(image);
        buffer = Buffer.from(await res.arrayBuffer());
      } else {
        buffer = Buffer.from(image, 'base64');
      }

      // Enhance first
      const enhanced = await enhanceImage(buffer).catch(() => buffer);

      // Try Vision → fallback to Tesseract
      let extracted: { text: string; confidence: number };
      try {
        extracted = await extractWithVision(enhanced);
        fastify.log.info('[OCR] Used Google Vision');
      } catch {
        extracted = await extractWithTesseract(enhanced);
        fastify.log.info('[OCR] Fell back to Tesseract');
      }

      const parsed = parseReceipt(extracted.text);
      const warnings = buildWarnings(parsed, extracted.confidence);

      return reply.send({
        success: true,
        data: {
          ...parsed,
          confidence: extracted.confidence,
          validationWarnings: warnings,
          rawText: extracted.text,
          engine: visionClient ? 'google-vision' : 'tesseract',
        },
      });
    }
  );
}
