import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './database';
import { apiRequest } from './api';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const RECOVERABLE_STATES = ['STAGED', 'INTENT_CREATED', 'UPLOADING', 'UPLOAD_RETRY', 'VERIFY_PENDING'] as const;

export type ReceiptEvidenceStatus =
  | 'PENDING_UPLOAD' | 'UPLOADED' | 'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'INFECTED'
  | 'SCAN_FAILED' | 'ATTACHED' | 'REJECTED' | 'EXPIRED';

export interface ReceiptUploadSession {
  client_upload_id: string;
  business_id: string;
  filename: string;
  content_type: string;
  local_uri: string;
  byte_size: number;
  sha256: string;
  server_receipt_id: string | null;
  status: string;
  server_status: string | null;
  review_status: string | null;
  scan_verdict: string | null;
  ocr_status: string | null;
  retry_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReceiptUploadIntent {
  receiptEvidenceId: string;
  uploadUrl?: string;
  requiredHeaders?: Record<string, string>;
  expiresAt?: string;
  maxBytes?: number;
  status?: ReceiptEvidenceStatus;
  alreadyProcessed?: boolean;
}

interface ReceiptUploadResult {
  clientUploadId: string;
  receiptEvidenceId: string;
  status: ReceiptEvidenceStatus;
  verifiedAt?: string | null;
}

interface ReceiptEvidenceServerStatus {
  receiptEvidenceId: string;
  status: ReceiptEvidenceStatus;
  reviewStatus?: 'PENDING' | 'REQUIRED' | 'ACCEPTED' | 'REJECTED';
  verifiedAt: string | null;
  malwareScan: { verdict: 'CLEAN' | 'INFECTED'; engine: string; engineVersion: string; scannedAt: string } | null;
  ocr: { status: 'SUCCEEDED' | 'FAILED' | 'UNAVAILABLE'; extractedText: string | null; meanConfidence: number | null; provider: string; createdAt: string } | null;
}

function bytesFromBase64(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

async function sha256File(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytesFromBase64(base64));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/[^\s)]+/gi, '[redacted-url]').slice(0, 500);
}

function validateInput(input: { filename: string; contentType: string }): void {
  if (!MIME_TYPES.has(input.contentType)) throw new Error('Unsupported receipt file type');
  if (!input.filename.trim() || input.filename.length > 255 || /[\\/\\0-\\x1f\\x7f]/.test(input.filename)) {
    throw new Error('Receipt filename is invalid');
  }
}

async function updateSession(clientUploadId: string, values: Record<string, unknown>): Promise<void> {
  const db = await getDatabase();
  const allowed = new Set([
    'server_receipt_id','status','server_status','review_status','scan_verdict','ocr_status',
    'retry_count','next_attempt_at','last_error','updated_at',
  ]);
  const entries = Object.entries(values).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  await db.runAsync(
    `UPDATE receipt_upload_sessions SET ${assignments}, updated_at = datetime('now') WHERE client_upload_id = ?`,
    [...entries.map(([, value]) => value ?? null), clientUploadId],
  );
}

async function getSession(clientUploadId: string): Promise<ReceiptUploadSession> {
  const db = await getDatabase();
  const session = await db.getFirstAsync<ReceiptUploadSession>(
    'SELECT * FROM receipt_upload_sessions WHERE client_upload_id = ?',
    [clientUploadId],
  );
  if (!session) throw new Error('Receipt upload session was not found on this device');
  return session;
}

async function applyServerStatus(clientUploadId: string, status: ReceiptEvidenceServerStatus): Promise<void> {
  const localStatus = status.status === 'PENDING_UPLOAD' ? 'UPLOAD_RETRY' : status.status === 'UPLOADED' ? 'QUARANTINED' : status.status;
  await updateSession(clientUploadId, {
    status: localStatus,
    server_status: status.status === 'UPLOADED' ? 'QUARANTINED' : status.status,
    review_status: status.reviewStatus ?? null,
    scan_verdict: status.malwareScan?.verdict ?? null,
    ocr_status: status.ocr?.status ?? null,
    last_error: null,
    next_attempt_at: null,
  });
  if (status.verifiedAt && status.status !== 'PENDING_UPLOAD') {
    const session = await getSession(clientUploadId);
    await FileSystem.deleteAsync(session.local_uri, { idempotent: true }).catch(() => undefined);
  }
}

async function fetchServerStatus(receiptEvidenceId: string): Promise<ReceiptEvidenceServerStatus> {
  return apiRequest<ReceiptEvidenceServerStatus>(`/api/v1/receipts/${receiptEvidenceId}/status`);
}

/**
 * Copies the selected file into app-private persistent storage and records a
 * durable local session before any network request is made.
 */
export async function prepareReceiptEvidence(input: {
  uri: string;
  filename: string;
  contentType: string;
  businessId: string;
}): Promise<string> {
  validateInput(input);
  if (!FileSystem.documentDirectory) throw new Error('Persistent app document storage is unavailable');
  const clientUploadId = Crypto.randomUUID();
  const directory = `${FileSystem.documentDirectory}receipt-evidence/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const localUri = `${directory}${clientUploadId}`;
  await FileSystem.copyAsync({ from: input.uri, to: localUri });

  try {
    const info = await FileSystem.getInfoAsync(localUri, { size: true });
    if (!info.exists || typeof info.size !== 'number' || info.size <= 0 || info.size > MAX_RECEIPT_BYTES) {
      throw new Error('Receipt file is missing, empty, or exceeds the 10 MiB limit');
    }
    const sha256 = await sha256File(localUri);
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO receipt_upload_sessions
       (client_upload_id,business_id,filename,content_type,local_uri,byte_size,sha256,status)
       VALUES (?,?,?,?,?,?,?,'STAGED')`,
      [clientUploadId, input.businessId, input.filename.trim(), input.contentType, localUri, info.size, sha256],
    );
    return clientUploadId;
  } catch (error) {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Replays a complete single-PUT upload safely. The 10 MiB object is uploaded
 * atomically; interrupted transfers restart from byte zero using a newly
 * signed URL bound to the same server evidence ID and SHA-256.
 */
export async function resumeReceiptEvidenceUpload(clientUploadId: string): Promise<ReceiptUploadResult> {
  let session = await getSession(clientUploadId);
  if (session.server_receipt_id) {
    try {
      const existing = await fetchServerStatus(session.server_receipt_id);
      if (existing.status !== 'PENDING_UPLOAD') {
        await applyServerStatus(clientUploadId, existing);
        return { clientUploadId, receiptEvidenceId: existing.receiptEvidenceId, status: existing.status, verifiedAt: existing.verifiedAt };
      }
      // A PUT may have completed just before process death. Try server-side
      // verification before sending the same bounded object again.
      await apiRequest<ReceiptUploadResult>(`/api/v1/receipts/${session.server_receipt_id}/complete`, { method: 'POST' }).catch(() => undefined);
      const afterCompletion = await fetchServerStatus(session.server_receipt_id);
      if (afterCompletion.status !== 'PENDING_UPLOAD') {
        await applyServerStatus(clientUploadId, afterCompletion);
        return { clientUploadId, receiptEvidenceId: afterCompletion.receiptEvidenceId, status: afterCompletion.status, verifiedAt: afterCompletion.verifiedAt };
      }
    } catch {
      // A transient status/verification lookup must not erase the durable local recovery record.
    }
  }

  const info = await FileSystem.getInfoAsync(session.local_uri, { size: true });
  if (!info.exists || info.size !== session.byte_size) {
    await updateSession(clientUploadId, { status: 'FAILED', last_error: 'LOCAL_EVIDENCE_FILE_MISSING' });
    throw new Error('The saved receipt file is unavailable; capture or select it again');
  }
  const actualHash = await sha256File(session.local_uri);
  if (actualHash !== session.sha256) {
    await updateSession(clientUploadId, { status: 'FAILED', last_error: 'LOCAL_EVIDENCE_DIGEST_MISMATCH' });
    throw new Error('The saved receipt file changed after capture; it cannot be uploaded');
  }

  const intent = await apiRequest<ReceiptUploadIntent>('/api/v1/receipts/upload-intents', {
    method: 'POST',
    body: JSON.stringify({
      clientUploadId,
      businessId: session.business_id,
      filename: session.filename,
      contentType: session.content_type,
      byteSize: session.byte_size,
      sha256: session.sha256,
    }),
  });
  if (!intent.receiptEvidenceId) throw new Error('Receipt upload intent response is incomplete');
  await updateSession(clientUploadId, { server_receipt_id: intent.receiptEvidenceId });

  if (intent.alreadyProcessed || !intent.uploadUrl || !intent.requiredHeaders) {
    const serverStatus = await fetchServerStatus(intent.receiptEvidenceId);
    await applyServerStatus(clientUploadId, serverStatus);
    return { clientUploadId, receiptEvidenceId: serverStatus.receiptEvidenceId, status: serverStatus.status, verifiedAt: serverStatus.verifiedAt };
  }

  session = await getSession(clientUploadId);
  await updateSession(clientUploadId, { status: 'UPLOADING', last_error: null, retry_count: session.retry_count + 1 });
  try {
    const upload = await FileSystem.uploadAsync(intent.uploadUrl, session.local_uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: intent.requiredHeaders,
    });
    if (upload.status < 200 || upload.status >= 300) {
      throw new Error(`Receipt object upload failed with status ${upload.status}`);
    }
  } catch (error) {
    await updateSession(clientUploadId, { status: 'UPLOAD_RETRY', last_error: safeErrorMessage(error), next_attempt_at: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, 5000 * (2 ** Math.min(session.retry_count + 1, 12)))).toISOString() });
    throw new Error(`Receipt upload is saved for retry. Recovery ID: ${clientUploadId}. ${safeErrorMessage(error)}`);
  }

  await updateSession(clientUploadId, { status: 'VERIFY_PENDING' });
  try {
    await apiRequest<ReceiptUploadResult>(`/api/v1/receipts/${intent.receiptEvidenceId}/complete`, { method: 'POST' });
  } catch (error) {
    try {
      const serverStatus = await fetchServerStatus(intent.receiptEvidenceId);
      if (serverStatus.status !== 'PENDING_UPLOAD') {
        await applyServerStatus(clientUploadId, serverStatus);
        return { clientUploadId, receiptEvidenceId: serverStatus.receiptEvidenceId, status: serverStatus.status, verifiedAt: serverStatus.verifiedAt };
      }
    } catch {
      // Preserve local evidence and server ID for an explicit or automatic retry.
    }
    await updateSession(clientUploadId, { status: 'VERIFY_PENDING', last_error: String(error), next_attempt_at: new Date(Date.now() + Math.min(6 * 60 * 60 * 1000, 5000 * (2 ** Math.min(session.retry_count + 1, 12)))).toISOString() });
    throw new Error(`Receipt verification is pending. Recovery ID: ${clientUploadId}. ${String(error)}`);
  }

  const serverStatus = await fetchServerStatus(intent.receiptEvidenceId);
  await applyServerStatus(clientUploadId, serverStatus);
  return { clientUploadId, receiptEvidenceId: serverStatus.receiptEvidenceId, status: serverStatus.status, verifiedAt: serverStatus.verifiedAt };
}

/** Stages first, then attempts upload. Failures retain the durable local session. */
export async function uploadReceiptEvidence(input: {
  uri: string;
  filename: string;
  contentType: string;
  businessId: string;
}): Promise<ReceiptUploadResult> {
  const clientUploadId = await prepareReceiptEvidence(input);
  try {
    return await resumeReceiptEvidenceUpload(clientUploadId);
  } catch (error) {
    throw new Error(`Receipt upload recovery ID: ${clientUploadId}. ${safeErrorMessage(error)}`);
  }
}

export async function resumePendingReceiptEvidenceUploads(): Promise<void> {
  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable === false) return;
  const db = await getDatabase();
  const placeholders = RECOVERABLE_STATES.map(() => '?').join(',');
  const sessions = await db.getAllAsync<{ client_upload_id: string }>(
    `SELECT client_upload_id FROM receipt_upload_sessions
     WHERE status IN (${placeholders})
       AND (next_attempt_at IS NULL OR datetime(next_attempt_at) <= datetime('now'))
     ORDER BY created_at ASC LIMIT 10`,
    [...RECOVERABLE_STATES],
  );
  for (const session of sessions) {
    await resumeReceiptEvidenceUpload(session.client_upload_id).catch(() => undefined);
  }
}

export async function listReceiptEvidenceUploads(businessId?: string): Promise<ReceiptUploadSession[]> {
  const db = await getDatabase();
  if (businessId) {
    return db.getAllAsync<ReceiptUploadSession>(
      'SELECT * FROM receipt_upload_sessions WHERE business_id = ? ORDER BY created_at DESC LIMIT 100',
      [businessId],
    );
  }
  return db.getAllAsync<ReceiptUploadSession>(
    'SELECT * FROM receipt_upload_sessions ORDER BY created_at DESC LIMIT 100',
  );
}

export async function refreshReceiptEvidenceStatus(clientUploadId: string): Promise<ReceiptEvidenceServerStatus> {
  const session = await getSession(clientUploadId);
  if (!session.server_receipt_id) throw new Error('Receipt has not yet received a server evidence ID');
  const status = await fetchServerStatus(session.server_receipt_id);
  await applyServerStatus(clientUploadId, status);
  return status;
}


export async function getReceiptEvidencePreviewUrl(clientUploadId: string): Promise<string> {
  const session = await getSession(clientUploadId);
  if (!session.server_receipt_id) throw new Error('Receipt is not available for review yet');
  const response = await apiRequest<{ url: string; expiresInSeconds: number }>(
    `/api/v1/receipts/${session.server_receipt_id}/download`,
  );
  if (!response.url || response.expiresInSeconds <= 0) throw new Error('Receipt preview URL is unavailable');
  return response.url;
}

export async function reviewReceiptEvidence(
  clientUploadId: string,
  decision: 'ACCEPT' | 'REJECT',
): Promise<{ receiptEvidenceId: string; reviewStatus: 'ACCEPTED' | 'REJECTED' }> {
  const session = await getSession(clientUploadId);
  if (!session.server_receipt_id) throw new Error('Receipt is not available for review yet');
  const result = await apiRequest<{ receiptEvidenceId: string; reviewStatus: 'ACCEPTED' | 'REJECTED' }>(
    `/api/v1/receipts/${session.server_receipt_id}/review`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
  await updateSession(clientUploadId, { review_status: result.reviewStatus });
  return result;
}

/** Attach only after the backend confirms a clean scan and explicit acceptance. */
export async function queueReceiptAttachment(receiptEvidenceId: string, expenseId: string): Promise<void> {
  const status = await fetchServerStatus(receiptEvidenceId);
  if (status.status !== 'CLEAN' || status.reviewStatus !== 'ACCEPTED') {
    throw new Error('Receipt must pass malware scanning and explicit human review before attachment');
  }
  const { offlineQueue } = await import('./offlineQueue');
  await offlineQueue.enqueue('RECEIPT_ATTACH', { receiptEvidenceId, expenseId });
}
