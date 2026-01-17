import { ApiError } from '../api';
import { syncPendingInvoices } from '../sync';

jest.mock('../database', () => ({
  getPendingInvoices: jest.fn(),
  updateInvoiceStatus: jest.fn(),
  markInvoiceSynced: jest.fn(),
  setInvoiceRetryMetadata: jest.fn()
}));

jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return {
    ...actual,
    createInvoice: jest.fn()
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../database');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const api = require('../api');

describe('syncPendingInvoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('schedules retry (deferred) on retryable API errors without blocking', async () => {
    db.getPendingInvoices.mockResolvedValue([
      {
        id: 'inv-1',
        serverId: null,
        customerName: 'Walk-in',
        status: 'queued',
        subtotal: 0,
        vat: 0,
        total: 0,
        items: '[]',
        createdAt: new Date().toISOString(),
        synced: 0,
        attempts: 0,
        nextRetry: null
      }
    ]);

    api.createInvoice.mockRejectedValueOnce(new ApiError(503, 'API error 503: Service unavailable'));

    const res = await syncPendingInvoices();

    expect(res).toEqual({ synced: 0, failed: 0, deferred: 1 });
    expect(db.updateInvoiceStatus).toHaveBeenCalledWith('inv-1', 'processing');
    expect(db.updateInvoiceStatus).toHaveBeenCalledWith('inv-1', 'queued');
    expect(db.setInvoiceRetryMetadata).toHaveBeenCalledWith(
      'inv-1',
      1,
      expect.any(String)
    );
    expect(db.markInvoiceSynced).not.toHaveBeenCalled();
  });

  it('marks invoice failed on non-retryable API errors', async () => {
    db.getPendingInvoices.mockResolvedValue([
      {
        id: 'inv-2',
        serverId: null,
        customerName: 'Walk-in',
        status: 'queued',
        subtotal: 0,
        vat: 0,
        total: 0,
        items: '[]',
        createdAt: new Date().toISOString(),
        synced: 0,
        attempts: 0,
        nextRetry: null
      }
    ]);

    api.createInvoice.mockRejectedValueOnce(new ApiError(400, 'API error 400: Validation error'));

    const res = await syncPendingInvoices();

    expect(res).toEqual({ synced: 0, failed: 1, deferred: 0 });
    expect(db.updateInvoiceStatus).toHaveBeenCalledWith('inv-2', 'failed');
    expect(db.setInvoiceRetryMetadata).toHaveBeenCalledWith('inv-2', 1, null);
  });
});
