import * as FileSystem from 'expo-file-system';
import type { InvoiceItem } from '../types/invoice';

export interface OCRResult {
  vendor?: string;
  amount?: number;
  date?: string;
  items?: InvoiceItem[];
  confidence: number;
}

export type OCRWarningCode =
  | 'lowConfidence'
  | 'noAmountOrItems'
  | 'invalidAmount'
  | 'invalidDate'
  | 'unparseableDate';

export interface OCROptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<OCROptions> = {
  timeoutMs: 30000,
  maxRetries: 2,
  retryDelayMs: 1000,
};

/**
 * Extract receipt data from an image using the backend OCR service
 * For MVP: delegates to backend with TensorFlow Lite or Tesseract
 * Includes retry logic for network failures and timeout handling
 */
export async function extractReceiptData(
  image: string,
  apiBaseUrl: string,
  options: OCROptions = {}
): Promise<OCRResult> {
  const { timeoutMs, maxRetries, retryDelayMs } = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // If `image` looks like a file URI, read and convert to base64
      let base64: string;
      if (image.startsWith('file://') || image.startsWith('/') || image.startsWith('content://')) {
        base64 = await FileSystem.readAsStringAsync(image, { encoding: 'base64' });
      } else {
        base64 = image;
      }

      // Validate image size (max 5MB base64 ~ 6.7MB raw)
      const estimatedSizeBytes = base64.length * (3 / 4);
      if (estimatedSizeBytes > 5 * 1024 * 1024) {
        const error = new Error('IMAGE_TOO_LARGE');
        error.name = 'OCRError';
        throw error;
      }

      // Detect MIME type from base64 or default to JPEG
      const mimeType = detectMimeType(base64) || 'image/jpeg';

      // Call backend OCR endpoint
      const response = await fetch(`${apiBaseUrl}/api/v1/ocr/extract`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          mimeType,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OCR service error: ${response.status}${errorBody ? ` - ${errorBody}` : ''}`);
        }
        
        // Retry on server errors (5xx)
        throw new RetryableError(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        vendor: data.vendor,
        amount: data.amount,
        date: data.date,
        items: data.items,
        confidence: data.confidence ?? 0.8,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error('OCR_TIMEOUT');
        timeoutError.name = 'OCRError';
        lastError = timeoutError;
        // Retry on timeout
        if (attempt < maxRetries) {
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
      } else if (error instanceof RetryableError) {
        lastError = error;
        if (attempt < maxRetries) {
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
      } else {
        // Non-retryable error
        if (__DEV__) console.error('OCR extraction failed:', error);
        const extractError = new Error('OCR_EXTRACTION_FAILED');
        extractError.name = 'OCRError';
        throw extractError;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // All retries exhausted
  if (lastError) {
    throw lastError;
  }
  const retriesError = new Error('OCR_RETRIES_EXHAUSTED');
  retriesError.name = 'OCRError';
  throw retriesError;
}

/**
 * Custom error class for retryable errors
 */
class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect MIME type from base64 string magic bytes
 */
function detectMimeType(base64: string): string | null {
  try {
    // Check first few characters for magic bytes
    const header = base64.substring(0, 20);
    
    if (header.startsWith('/9j/')) return 'image/jpeg';
    if (header.startsWith('iVBORw')) return 'image/png';
    if (header.startsWith('R0lGOD')) return 'image/gif';
    if (header.startsWith('UklGR')) return 'image/webp';
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate OCR results and suggest confidence thresholds
 */
export function validateOCRResult(result: OCRResult, minConfidence: number = 0.7): {
  isValid: boolean;
  warnings: OCRWarningCode[];
} {
  const warnings: OCRWarningCode[] = [];

  if (result.confidence < minConfidence) {
    warnings.push('lowConfidence');
  }

  if (!result.amount && (!result.items || result.items.length === 0)) {
    warnings.push('noAmountOrItems');
  }

  if (result.amount && result.amount <= 0) {
    warnings.push('invalidAmount');
  }

  if (result.date) {
    try {
      const d = new Date(result.date);
      if (isNaN(d.getTime())) {
        warnings.push('invalidDate');
      }
    } catch {
      warnings.push('unparseableDate');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
