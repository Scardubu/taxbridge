import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { apiRequest } from './api';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

interface ReceiptUploadIntent {
  receiptEvidenceId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

interface ReceiptUploadResult {
  receiptEvidenceId: string;
  status: 'UPLOADED';
  verifiedAt?: string;
}

function bytesFromBase64(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

async function sha256File(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytesFromBase64(base64));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads a receipt to the private evidence vault and asks the API to verify
 * its actual bytes before returning the server-issued evidence identifier.
 * The presigned storage request deliberately carries no application bearer token.
 */
export async function uploadReceiptEvidence(input: {
  uri: string;
  filename: string;
  contentType: string;
  businessId: string;
}): Promise<ReceiptUploadResult> {
  if (!MIME_TYPES.has(input.contentType)) {
    throw new Error('Unsupported receipt file type');
  }

  const info = await FileSystem.getInfoAsync(input.uri, { size: true });
  if (!info.exists || typeof info.size !== 'number' || info.size <= 0 || info.size > MAX_RECEIPT_BYTES) {
    throw new Error('Receipt file is missing, empty, or exceeds the 10 MiB limit');
  }

  const sha256 = await sha256File(input.uri);
  const intent = await apiRequest<ReceiptUploadIntent>('/api/v1/receipts/upload-intents', {
    method: 'POST',
    body: JSON.stringify({
      businessId: input.businessId,
      filename: input.filename,
      contentType: input.contentType,
      byteSize: info.size,
      sha256,
    }),
  });

  if (!intent.receiptEvidenceId || !intent.uploadUrl || !intent.requiredHeaders) {
    throw new Error('Receipt upload intent response is incomplete');
  }

  const upload = await FileSystem.uploadAsync(intent.uploadUrl, input.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: intent.requiredHeaders,
  });
  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`Receipt object upload failed with status ${upload.status}`);
  }

  return apiRequest<ReceiptUploadResult>(`/api/v1/receipts/${intent.receiptEvidenceId}/complete`, {
    method: 'POST',
  });
}
