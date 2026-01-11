/**
 * OCR Receipt Extraction Service
 * 
 * This service integrates with the mobile app to extract data from receipt images.
 * Current implementation uses regex patterns for MVP validation.
 * For production: integrate Tesseract.js or TensorFlow Lite.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createLogger } from '../lib/logger';
import { performOCR } from '../lib/performOCR';

const logger = createLogger('ocr');

const OCRRequestSchema = z.object({
  image: z.string(),
  mimeType: z.string()
});

const OCRResponseSchema = z.object({
  amount: z.number().optional(),
  date: z.string().optional(),
  items: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() })).optional(),
  confidence: z.number()
});

/**
 * POST /api/v1/ocr/extract
 * 
 * Extracts receipt data from an image using OCR
 * 
 * Request:
 * {
 *   image: string (base64 encoded image)
 *   mimeType: string (e.g., "image/jpeg", "image/png")
 * }
 * 
 * Response:
 * {
 *   amount: number (extracted total amount)
 *   date: string (ISO format date if found)
 *   items?: Array<{
 *     description: string
 *     quantity: number
 *     unitPrice: number
 *   }>
 *   confidence: number (0.0 to 1.0 confidence score)
 * }
 */
export default async function ocrRoutes(app: FastifyInstance) {
  app.post(
    '/api/v1/ocr/extract',
    {
      schema: {
        body: OCRRequestSchema,
        response: {
          200: OCRResponseSchema,
          400: z.object({ error: z.string() }),
          500: z.object({ error: z.string() })
        }
      }
    },
    async (req, reply) => {
      const startTime = Date.now();
      const requestId = (req.headers['x-request-id'] as string) || `ocr-${Date.now()}`;
      
      try {
        const { image, mimeType } = req.body as z.infer<typeof OCRRequestSchema>;

        // Validate image size (max 5MB)
        const imageSizeInBytes = image.length * (3 / 4); // Rough estimate for base64
        if (imageSizeInBytes > 5 * 1024 * 1024) {
          logger.warn('OCR request rejected: image too large', { 
            requestId, 
            sizeBytes: imageSizeInBytes 
          });
          return reply.status(400).send({ error: 'Image too large (max 5MB)' });
        }

        logger.info('OCR processing started', { 
          requestId, 
          mimeType, 
          imageSizeKB: Math.round(imageSizeInBytes / 1024) 
        });

        // Process OCR
        const result = await performOCR(image, mimeType);
        
        const processingTime = Date.now() - startTime;
        logger.info('OCR processing completed', { 
          requestId,
          processingTimeMs: processingTime,
          confidence: result.confidence,
          hasAmount: result.amount !== undefined,
          hasDate: result.date !== undefined,
          itemCount: result.items?.length || 0
        });

        // Add performance header
        reply.header('X-Processing-Time-Ms', processingTime.toString());
        reply.header('X-Request-Id', requestId);

        return reply.send(result);
      } catch (error) {
        const processingTime = Date.now() - startTime;
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('OCR extraction failed', { 
          requestId,
          processingTimeMs: processingTime,
          err: error 
        });
        return reply.status(500).send({ error: 'Failed to process image', message });
      }
    }
  );
}

// Graceful cleanup: terminate the tesseract worker if created when the process exits
(function setupWorkerCleanup() {
  const performOCRFunc = performOCR as any;
  const maybe = performOCRFunc._workerPromise;
  if (!maybe) return;

  // If a worker promise exists, ensure we terminate the worker on exit signals
  const terminateWorker = async () => {
    try {
      const worker = await performOCRFunc._workerPromise;
      if (worker && typeof worker.terminate === 'function') {
        await worker.terminate();
        logger.info('Tesseract worker terminated on shutdown');
      }
    } catch (err) {
      // best-effort
      logger.warn('Error terminating tesseract worker during shutdown');
    }
  };

  process.on('SIGINT', () => {
    void terminateWorker().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void terminateWorker().then(() => process.exit(0));
  });
  process.on('exit', () => {
    void terminateWorker();
  });
})();
