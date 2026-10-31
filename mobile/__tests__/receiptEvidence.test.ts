import { getDatabase } from '../services/database';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { apiRequest } from '../services/api';
import {
  prepareReceiptEvidence,
  resumeReceiptEvidenceUpload,
  type ReceiptUploadSession,
} from '../services/receiptEvidence';

jest.mock('../services/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../services/api', () => ({ apiRequest: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
  digest: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock-docs/',
  cacheDirectory: '/mock-cache/',
  EncodingType: { Base64: 'base64' },
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  uploadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: false, isInternetReachable: false })) },
}));

const mockDb = {
  runAsync: jest.fn(async () => ({ changes: 1 })),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

const validSession: ReceiptUploadSession = {
  client_upload_id: 'client-upload-uuid',
  business_id: 'business-uuid',
  filename: 'receipt.jpg',
  content_type: 'image/jpeg',
  local_uri: '/mock-docs/receipt-evidence/client-upload-uuid',
  byte_size: 4,
  sha256: '0'.repeat(64),
  server_receipt_id: null,
  status: 'STAGED',
  server_status: null,
  review_status: null,
  scan_verdict: null,
  ocr_status: null,
  retry_count: 0,
  next_attempt_at: null,
  last_error: null,
  created_at: '2026-10-30 10:00:00',
  updated_at: '2026-10-30 10:00:00',
};

describe('Phase 1C.5 durable receipt evidence upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
    (Crypto.randomUUID as jest.Mock).mockReturnValue('client-upload-uuid');
    (Crypto.digest as jest.Mock).mockResolvedValue(new Uint8Array(32));
    (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: 4 });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('AQIDBA==');
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('persists a private app-local copy and upload metadata before network activity', async () => {
    const clientUploadId = await prepareReceiptEvidence({
      uri: 'content://picked/receipt',
      filename: 'receipt.jpg',
      contentType: 'image/jpeg',
      businessId: 'business-uuid',
    });

    expect(clientUploadId).toBe('client-upload-uuid');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'content://picked/receipt',
      to: '/mock-docs/receipt-evidence/client-upload-uuid',
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO receipt_upload_sessions'),
      expect.arrayContaining(['client-upload-uuid', 'business-uuid', 'receipt.jpg', 'image/jpeg', '/mock-docs/receipt-evidence/client-upload-uuid', 4, '0'.repeat(64)]),
    );
  });

  it('rejects unsupported media before copying it into persistent storage', async () => {
    await expect(prepareReceiptEvidence({
      uri: 'file:///tmp/receipt.heic',
      filename: 'receipt.heic',
      contentType: 'image/heic',
      businessId: 'business-uuid',
    })).rejects.toThrow('Unsupported receipt file type');
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('reuses a stable upload identity and records quarantine after verified completion', async () => {
    mockDb.getFirstAsync.mockResolvedValue(validSession);
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValue({ status: 200 });
    (apiRequest as jest.Mock)
      .mockResolvedValueOnce({
        receiptEvidenceId: 'server-receipt-uuid',
        uploadUrl: 'https://storage.example/signed-put',
        requiredHeaders: { 'content-type': 'image/jpeg', 'x-amz-meta-sha256': '0'.repeat(64) },
      })
      .mockResolvedValueOnce({ receiptEvidenceId: 'server-receipt-uuid', status: 'QUARANTINED' })
      .mockResolvedValueOnce({
        receiptEvidenceId: 'server-receipt-uuid',
        status: 'QUARANTINED',
        reviewStatus: 'PENDING',
        verifiedAt: '2026-10-30T10:01:00.000Z',
        malwareScan: null,
        ocr: null,
      });

    const result = await resumeReceiptEvidenceUpload('client-upload-uuid');

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/v1/receipts/upload-intents', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"clientUploadId":"client-upload-uuid"'),
    }));
    expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
      'https://storage.example/signed-put',
      validSession.local_uri,
      expect.objectContaining({ httpMethod: 'PUT' }),
    );
    expect(result).toMatchObject({ clientUploadId: 'client-upload-uuid', receiptEvidenceId: 'server-receipt-uuid', status: 'QUARANTINED' });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(validSession.local_uri, { idempotent: true });
  });
  it('retains the staged file and schedules a retry when the object PUT fails', async () => {
    mockDb.getFirstAsync.mockResolvedValue(validSession);
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      receiptEvidenceId: 'server-receipt-uuid',
      uploadUrl: 'https://storage.example/signed-put',
      requiredHeaders: { 'content-type': 'image/jpeg', 'x-amz-meta-sha256': '0'.repeat(64) },
    });
    (FileSystem.uploadAsync as jest.Mock).mockRejectedValue(new Error('network disconnected'));

    await expect(resumeReceiptEvidenceUpload('client-upload-uuid')).rejects.toThrow('saved for retry');
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('status = ?'),
      expect.arrayContaining(['UPLOAD_RETRY']),
    );
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('does not upload again when the server already verified the evidence', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ ...validSession, server_receipt_id: 'server-receipt-uuid' });
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      receiptEvidenceId: 'server-receipt-uuid',
      status: 'QUARANTINED',
      reviewStatus: 'PENDING',
      verifiedAt: '2026-10-30T10:01:00.000Z',
      malwareScan: null,
      ocr: null,
    });

    const result = await resumeReceiptEvidenceUpload('client-upload-uuid');

    expect(result.status).toBe('QUARANTINED');
    expect(FileSystem.uploadAsync).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

});
