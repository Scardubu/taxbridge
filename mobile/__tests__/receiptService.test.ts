import type { DraftReceipt } from '../types/receipt';
import { DuplicateReceiptError, RECEIPT_FALLBACK_BUSINESS_ID, receiptService } from '../services/receiptService';
import { getDatabase } from '../services/database';
import { logComplianceEvent } from '../services/complianceEventService';
import { offlineQueue } from '../services/offlineQueue';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('../services/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../services/complianceEventService', () => ({
  logComplianceEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/offlineQueue', () => ({
  offlineQueue: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockRandomUuid = jest.requireMock('expo-crypto').randomUUID as jest.Mock;
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockLogComplianceEvent = logComplianceEvent as jest.MockedFunction<typeof logComplianceEvent>;
const mockEnqueue = offlineQueue.enqueue as jest.MockedFunction<typeof offlineQueue.enqueue>;

const draftReceipt: DraftReceipt = {
  vendorName: 'Eko Fuel Station',
  vendorTin: 'TIN-4455',
  amountNgn: 24_000,
  vatAmountNgn: 1_800,
  date: '2026-03-18',
  category: 'transport',
  rawOcrText: 'Eko Fuel Station 24000 VAT 1800',
  imageHash: 'sha-256-1',
  capturedAt: '2026-03-18T09:00:00.000Z',
};

describe('receiptService', () => {
  const db = {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDatabase.mockResolvedValue(db as never);
    db.getFirstAsync.mockReset();
    db.runAsync.mockReset();
  });

  test('saves a receipt, creates VAT credit, logs compliance, and enqueues sync', async () => {
    db.getFirstAsync.mockResolvedValueOnce(null);
    mockRandomUuid.mockReturnValueOnce('receipt-1').mockReturnValueOnce('credit-1');

    const result = await receiptService.saveReceipt(draftReceipt, 'biz-123');

    expect(result.id).toBe('receipt-1');
    expect(result.businessId).toBe('biz-123');
    expect(result.status).toBe('pending');
    expect(result.vatCreditId).toBe('credit-1');

    expect(db.runAsync).toHaveBeenCalledTimes(3);
    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO receipts'),
      expect.arrayContaining(['receipt-1', 'biz-123', 'Eko Fuel Station'])
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO vat_credits'),
      expect.arrayContaining(['credit-1', 'receipt-1', 'biz-123', 1_800, 3, 2026])
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      'UPDATE receipts SET vat_credit_id = ? WHERE id = ?',
      ['credit-1', 'receipt-1']
    );

    expect(mockLogComplianceEvent).toHaveBeenCalledWith(
      'receipt_scanned',
      'Receipt scanned and saved locally',
      'info',
      { receiptId: 'receipt-1' },
      { businessId: 'biz-123' }
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      'RECEIPT_SUBMIT',
      expect.objectContaining({
        client_receipt_id: 'receipt-1',
        business_id: 'biz-123',
        amount_ngn: 24_000,
        vat_amount_ngn: 1_800,
      })
    );
  });

  test('rejects duplicate receipt image hashes before inserting', async () => {
    db.getFirstAsync.mockResolvedValueOnce({ id: 'existing-receipt' });
    mockRandomUuid.mockReturnValue('receipt-duplicate');

    await expect(receiptService.saveReceipt(draftReceipt, 'biz-123')).rejects.toBeInstanceOf(DuplicateReceiptError);

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  test('falls back to the local business id when stats are requested without a server id', async () => {
    db.getFirstAsync.mockResolvedValueOnce({ cnt: 2, total: 49_500, vat: 3_600 });

    const stats = await receiptService.getStats('', 3, 2026);

    expect(stats).toEqual({
      count: 2,
      totalAmountNgn: 49_500,
      totalVatCreditNgn: 3_600,
    });
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('FROM receipts r'),
      [3, 2026, RECEIPT_FALLBACK_BUSINESS_ID, 3, '2026']
    );
  });
});
