import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createLogger } from '../lib/logger';
import { config } from '../lib/config';

const logger = createLogger('ocr');

const OCRRequestSchema = z.object({
  image: z.string(),
  imageType: z.enum(['base64', 'url']).optional().default('base64'),
  mimeType: z.string().optional(),
});

const NIGERIAN_CATEGORIES: Record<string, string[]> = {
  fuel: ['petrol', 'diesel', 'fuel', 'nnpc', 'conoil', 'oando', 'total'],
  meals_entertainment: ['restaurant', 'eatery', 'cafe', 'food', 'chicken', 'suya', 'bukka'],
  office_supplies: ['stationery', 'printer', 'paper', 'pen', 'office', 'shoprite'],
  transportation: ['uber', 'bolt', 'taxi', 'danfo', 'okada', 'transport'],
  utilities: ['nepa', 'ekedc', 'ikedc', 'electricity', 'water', 'dstv', 'startimes'],
  telecoms: ['mtn', 'airtel', 'glo', '9mobile', 'smile', 'spectranet'],
  professional_services: ['consulting', 'legal', 'accounting', 'audit', 'lawyer'],
  rent: ['rent', 'lease', 'property', 'estate', 'landlord'],
  repairs_maintenance: ['repair', 'maintenance', 'generator', 'service', 'mechanic'],
  medical: ['pharmacy', 'hospital', 'clinic', 'drugs', 'medplus'],
  banking_charges: ['bank', 'commission', 'charges', 'transfer', 'access', 'gtb', 'zenith', 'uba'],
  advertising: ['advertising', 'marketing', 'print', 'design', 'flyer', 'social'],
  general: [],
};

let visionClient: any = null;

async function getVisionClient() {
  if (visionClient) return visionClient;
  if (!process.env.GOOGLE_CLOUD_KEY_FILE) return null;

  const vision = await (new Function('return import("@google-cloud/vision")')() as Promise<any>);
  visionClient = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
  });

  return visionClient;
}

async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return sharp(buffer).grayscale().normalize().sharpen().toBuffer();
  } catch {
    return buffer;
  }
}

async function extractText(buffer: Buffer): Promise<{ fullText: string; confidence: number; engine: 'google-vision' | 'tesseract' }> {
  const enhanced = await enhanceImage(buffer);

  const client = await getVisionClient();
  if (client) {
    try {
      const [result] = await client.textDetection({ image: { content: enhanced } });
      const annotation = result.textAnnotations?.[0];
      return {
        fullText: annotation?.description ?? '',
        confidence: typeof annotation?.confidence === 'number' ? annotation.confidence : 0.75,
        engine: 'google-vision',
      };
    } catch (error) {
      logger.warn('Vision OCR failed, falling back to Tesseract', { err: error });
    }
  }

  const Tesseract = await import('tesseract.js');
  const { data } = await Tesseract.recognize(enhanced, 'eng');
  return {
    fullText: data.text,
    confidence: data.confidence / 100,
    engine: 'tesseract',
  };
}

function parseNigerianReceipt(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  const amountRegex = /(?:₦|NGN|N)\s*([\d,]+(?:\.\d{2})?)|[Tt]otal[:\s]+([\d,]+(?:\.\d{2})?)/g;
  const amounts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = amountRegex.exec(text)) !== null) {
    const raw = (match[1] || match[2]).replace(/,/g, '');
    const parsed = parseFloat(raw);
    if (parsed > 0 && parsed < 100_000_000) amounts.push(parsed);
  }

  const dateRegex = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  const dates = [...text.matchAll(dateRegex)].map(dateMatch => {
    const [, day, month, year] = dateMatch;
    return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });

  const vatMatch = text.match(/VAT[:\s]+([\d,]+(?:\.\d{2})?)/i);
  const vatAmount = vatMatch ? parseFloat(vatMatch[1].replace(/,/g, '')) : null;

  const lowerText = text.toLowerCase();
  let category = 'general';
  for (const [candidate, keywords] of Object.entries(NIGERIAN_CATEGORIES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      category = candidate;
      break;
    }
  }

  return {
    merchantName: lines[0] ?? 'Unknown Merchant',
    amount: amounts.length > 0 ? Math.max(...amounts) : 0,
    date: dates[0] ?? new Date().toISOString().split('T')[0],
    vatAmount,
    category,
    items: [] as Array<{ description: string; amount: number }>,
  };
}

function buildWarnings(parsed: ReturnType<typeof parseNigerianReceipt>, confidence: number): string[] {
  const warnings: string[] = [];
  if (confidence < 0.6) warnings.push('ocr.lowConfidence');
  if (parsed.amount === 0) warnings.push('ocr.noAmount');
  if (parsed.merchantName === 'Unknown Merchant') warnings.push('ocr.noMerchant');
  if (!parsed.vatAmount && parsed.amount > 1000) warnings.push('ocr.vatNotDetected');
  return warnings;
}

export default async function ocrRoutes(app: FastifyInstance) {
  app.post('/api/v1/ocr/extract', async (req, reply) => {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || `ocr-${Date.now()}`;

    try {
      if (!config.features.enableOCR) {
        return reply.status(404).send({ error: 'OCR feature is disabled' });
      }

      const body = OCRRequestSchema.parse(req.body);

      if (body.imageType === 'base64' && body.image.length > 7_000_000) {
        return reply.code(413).send({ success: false, error: 'Image exceeds 5MB limit' });
      }

      const buffer =
        body.imageType === 'base64'
          ? Buffer.from(body.image, 'base64')
          : Buffer.from((await fetch(body.image).then(res => res.arrayBuffer())) as ArrayBuffer);

      const { fullText, confidence, engine } = await extractText(buffer);
      const parsed = parseNigerianReceipt(fullText);
      const validationWarnings = buildWarnings(parsed, confidence);

      const requiresReview = confidence < 0.7 || parsed.amount === 0;
      const reviewReason = requiresReview
        ? [
            confidence < 0.7 ? 'Low OCR confidence (<70%)' : null,
            parsed.amount === 0 ? 'No amount detected' : null,
          ]
            .filter(Boolean)
            .join('; ')
        : undefined;

      const processingTime = Date.now() - startTime;
      reply.header('X-Processing-Time-Ms', processingTime.toString());
      reply.header('X-Request-Id', requestId);

      return reply.send({
        success: true,
        data: {
          ...parsed,
          confidence,
          validationWarnings,
          rawText: fullText,
          engine,
        },
        amount: parsed.amount,
        date: parsed.date,
        confidence,
        items: parsed.items.map(item => ({
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
        })),
        requiresReview,
        reviewReason,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('OCR extraction failed', {
        requestId,
        processingTimeMs: processingTime,
        err: error,
      });
      return reply.status(500).send({ error: 'Failed to process image', message });
    }
  });
}
