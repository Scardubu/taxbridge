import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { DraftReceipt } from '../types/receipt';

async function prepareImage(uri: string): Promise<{ processedUri: string; imageHash: string }> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  const imageHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, uri);
  return { processedUri: resized.uri, imageHash };
}

async function runOcr(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return result.text ?? '';
}

function parseOcrText(text: string, capturedAt: string): DraftReceipt {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const vendorName = lines.find((line) => line.length > 3 && !/^\d+$/.test(line)) ?? '';
  const tinMatch = text.match(/\b(\d{8}-\d{4})\b/);
  const vendorTin = tinMatch ? tinMatch[1] : null;

  const amountPatterns = [
    /₦\s*([\d,]+(?:\.\d{2})?)/i,
    /TOTAL[:\s]+([\d,]+(?:\.\d{2})?)/i,
    /AMOUNT[:\s]+([\d,]+(?:\.\d{2})?)/i,
    /GRAND TOTAL[:\s]+([\d,]+(?:\.\d{2})?)/i,
  ];

  let amountNgn = 0;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amountNgn = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  const vatPatterns = [
    /VAT[:\s]+([\d,]+(?:\.\d{2})?)/i,
    /7\.5%[:\s]+([\d,]+(?:\.\d{2})?)/i,
    /OUTPUT VAT[:\s]+([\d,]+(?:\.\d{2})?)/i,
  ];

  let vatAmountNgn = 0;
  for (const pattern of vatPatterns) {
    const match = text.match(pattern);
    if (match) {
      vatAmountNgn = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  const datePatterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{2})-(\d{2})-(\d{4})/,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
  ];

  let date = capturedAt.split('T')[0];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match?.[3]?.length === 4) {
      date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      break;
    }
  }

  return {
    vendorName,
    vendorTin,
    amountNgn,
    vatAmountNgn,
    date,
    category: 'other',
    rawOcrText: text,
    imageHash: null,
    capturedAt,
  };
}

/**
 * Process a captured receipt image on-device and return a draft payload.
 */
export async function processReceiptImage(uri: string): Promise<{
  draft: DraftReceipt;
  imageHash: string;
  ocrText: string;
}> {
  const capturedAt = new Date().toISOString();
  const { processedUri, imageHash } = await prepareImage(uri);
  const ocrText = await runOcr(processedUri);
  const draft = parseOcrText(ocrText, capturedAt);

  return {
    draft: { ...draft, imageHash },
    imageHash,
    ocrText,
  };
}
