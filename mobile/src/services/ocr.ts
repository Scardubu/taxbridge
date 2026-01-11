import * as FileSystem from 'expo-file-system';
import type { InvoiceItem } from '../types/invoice';

export interface OCRResult {
  amount?: number;
  date?: string;
  items?: InvoiceItem[];
  confidence: number;
}

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
        throw new Error('Image too large (max 5MB). Please use a smaller image.');
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
        amount: data.amount,
        date: data.date,
        items: data.items,
        confidence: data.confidence ?? 0.8,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('OCR request timed out. Please try again with a clearer image.');
        // Retry on timeout
        if (attempt < maxRetries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
      } else if (error instanceof RetryableError) {
        lastError = error;
        if (attempt < maxRetries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
      } else {
        // Non-retryable error
        console.error('OCR extraction failed:', error);
        throw new Error(`Failed to extract receipt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('OCR extraction failed after all retries');
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
  warnings: string[];
} {
  const warnings: string[] = [];

  if (result.confidence < minConfidence) {
    warnings.push(`Low confidence score: ${(result.confidence * 100).toFixed(0)}%`);
  }

  if (!result.amount && (!result.items || result.items.length === 0)) {
    warnings.push('No amount or items detected');
  }

  if (result.amount && result.amount <= 0) {
    warnings.push('Invalid amount detected');
  }

  if (result.date) {
    try {
      const d = new Date(result.date);
      if (isNaN(d.getTime())) {
        warnings.push('Invalid date format');
      }
    } catch {
      warnings.push('Could not parse date');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
