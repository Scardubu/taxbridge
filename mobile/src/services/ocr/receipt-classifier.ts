/**
 * Receipt Classifier & OCR Service
 * 
 * Uses AI-powered classification to:
 * 1. Detect receipt type (purchase, expense, invoice)
 * 2. Extract structured data (items, amounts, merchant)
 * 3. Auto-populate invoice fields
 * 
 * Offline-first with local ML models + optional cloud enhancement
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptData {
  merchantName?: string;
  date?: string;
  items: ReceiptItem[];
  subtotal?: number;
  vat?: number;
  total?: number;
  confidence: number; // 0-1 confidence score
  receiptType: 'purchase' | 'expense' | 'invoice' | 'unknown';
}

export interface OCRResult {
  success: boolean;
  data?: ReceiptData;
  error?: string;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const VAT_RATE = 0.075; // 7.5% Nigeria VAT
const CONFIDENCE_THRESHOLD = 0.7;
const MAX_ITEMS = 50;
const MAX_PROCESSING_TIME_MS = 30000; // 30 seconds timeout

// Common Nigerian merchant patterns
const NIGERIAN_MERCHANT_PATTERNS = [
  /shoprite/i,
  /spar/i,
  /game/i,
  /jumia/i,
  /konga/i,
  /supermarket/i,
  /pharmacy/i,
  /restaurant/i,
];

// ============================================================================
// Main Classifier
// ============================================================================

/**
 * Processes receipt image and extracts structured data
 * 
 * @param imageUri - Local file URI of captured receipt image
 * @returns OCR result with extracted data and confidence score
 */
export async function classifyReceipt(imageUri: string): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // Validate image exists
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      return {
        success: false,
        error: 'Image file not found',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Read image as base64 (required for ML processing)
    const base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Run OCR + Classification
    const extractedData = await performOCR(base64Image);
    
    // Apply business rules and validation
    const validatedData = validateAndEnhance(extractedData);

    // Check confidence threshold
    if (validatedData.confidence < CONFIDENCE_THRESHOLD) {
      return {
        success: false,
        error: `Low confidence (${(validatedData.confidence * 100).toFixed(0)}%). Please try again with better lighting.`,
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      data: validatedData,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR processing failed',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// OCR Engine (Simplified for MVP)
// ============================================================================

/**
 * Performs OCR on base64 image
 * 
 * In production, this would use:
 * - Google ML Kit for on-device OCR
 * - Azure Computer Vision for cloud enhancement
 * - Custom-trained Nigerian receipt model
 * 
 * For MVP, we simulate realistic extraction
 */
async function performOCR(base64Image: string): Promise<ReceiptData> {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  // In production, this would call real OCR APIs:
  // 1. Google ML Kit Text Recognition (on-device)
  // 2. Azure Computer Vision (cloud fallback)
  // 3. Custom-trained receipt parser

  // For now, return simulated realistic data
  return {
    merchantName: 'Shoprite Palms',
    date: new Date().toISOString().split('T')[0],
    items: [
      { description: 'Golden Penny Flour 2kg', quantity: 2, unitPrice: 1200 },
      { description: 'Peak Milk Tin', quantity: 3, unitPrice: 450 },
      { description: 'Indomie Noodles 40pk', quantity: 1, unitPrice: 2800 },
    ],
    subtotal: 6750,
    vat: 506.25,
    total: 7256.25,
    confidence: 0.85,
    receiptType: 'purchase',
  };
}

// ============================================================================
// Validation & Enhancement
// ============================================================================

/**
 * Validates and enhances extracted data with business rules
 */
function validateAndEnhance(data: ReceiptData): ReceiptData {
  // Validate items
  const validItems = data.items
    .filter(item => 
      item.description && 
      item.description.length > 0 &&
      item.quantity > 0 &&
      item.unitPrice >= 0
    )
    .slice(0, MAX_ITEMS); // Limit items

  // Recalculate totals if missing
  let subtotal = data.subtotal;
  if (!subtotal && validItems.length > 0) {
    subtotal = validItems.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice), 0
    );
  }

  // Calculate VAT if missing
  let vat = data.vat;
  if (!vat && subtotal) {
    vat = subtotal * VAT_RATE;
  }

  // Calculate total
  let total = data.total;
  if (!total && subtotal && vat) {
    total = subtotal + vat;
  }

  // Classify receipt type
  const receiptType = classifyReceiptType(data.merchantName, validItems);

  // Adjust confidence based on data quality
  let confidence = data.confidence;
  if (!data.merchantName) confidence *= 0.9;
  if (validItems.length === 0) confidence *= 0.5;
  if (!subtotal || !total) confidence *= 0.8;

  return {
    ...data,
    items: validItems,
    subtotal,
    vat,
    total,
    confidence: Math.min(confidence, 1),
    receiptType,
  };
}

/**
 * Classifies receipt type based on merchant and items
 */
function classifyReceiptType(
  merchantName?: string,
  items: ReceiptItem[] = []
): 'purchase' | 'expense' | 'invoice' | 'unknown' {
  // Check merchant patterns
  if (merchantName) {
    const matchesKnownMerchant = NIGERIAN_MERCHANT_PATTERNS.some(pattern =>
      pattern.test(merchantName)
    );
    if (matchesKnownMerchant) {
      return 'purchase';
    }
  }

  // Check item descriptions for keywords
  const itemText = items.map(i => i.description.toLowerCase()).join(' ');
  
  if (itemText.includes('invoice') || itemText.includes('bill')) {
    return 'invoice';
  }
  
  if (itemText.includes('service') || itemText.includes('consultation')) {
    return 'expense';
  }

  // Default to purchase if we have items
  return items.length > 0 ? 'purchase' : 'unknown';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats extracted data for CreateInvoice screen
 */
export function formatForInvoice(data: ReceiptData) {
  return {
    customerName: data.merchantName || '',
    items: data.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    subtotal: data.subtotal || 0,
    vat: data.vat || 0,
    total: data.total || 0,
  };
}

/**
 * Returns user-friendly confidence message
 */
export function getConfidenceMessage(confidence: number): string {
  if (confidence >= 0.9) return 'Excellent scan quality';
  if (confidence >= 0.8) return 'Good scan quality';
  if (confidence >= 0.7) return 'Acceptable scan quality';
  return 'Poor scan quality - please retake';
}

/**
 * Checks if device supports on-device OCR
 */
export function supportsOnDeviceOCR(): boolean {
  // In production, check for Google ML Kit availability
  // For now, assume all devices support it
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
