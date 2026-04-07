import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { logComplianceEvent } from './complianceEventService';
import { offlineQueue } from './offlineQueue';
import type { DraftReceipt, ReceiptRecord } from '../types/receipt';

function generateId(): string {
  return typeof Crypto.randomUUID === 'function'
    ? Crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Error thrown when a receipt image hash already exists locally.
 */
export class DuplicateReceiptError extends Error {
  constructor(public readonly imageHash: string) {
    super(`Duplicate receipt: ${imageHash}`);
    this.name = 'DuplicateReceiptError';
  }
}

export const RECEIPT_FALLBACK_BUSINESS_ID = 'local-business';

/**
 * Receipt persistence and stats service backed by SQLite.
 */
export const receiptService = {
  async isDuplicate(imageHash: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM receipts WHERE image_hash = ? LIMIT 1',
      [imageHash]
    );
    return row !== null;
  },

  async saveReceipt(draft: DraftReceipt, businessId: string): Promise<ReceiptRecord> {
    const resolvedBusinessId = businessId || RECEIPT_FALLBACK_BUSINESS_ID;
    const id = generateId();
    const now = new Date().toISOString();
    const db = await getDatabase();

    if (draft.imageHash && await this.isDuplicate(draft.imageHash)) {
      throw new DuplicateReceiptError(draft.imageHash);
    }

    const record: ReceiptRecord = {
      ...draft,
      id,
      serverId: null,
      businessId: resolvedBusinessId,
      status: 'pending',
      vatCreditId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO receipts
        (id, business_id, vendor_name, vendor_tin, amount_ngn,
         vat_amount_ngn, date, category, image_hash, raw_ocr_text,
         status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        resolvedBusinessId,
        draft.vendorName,
        draft.vendorTin,
        draft.amountNgn,
        draft.vatAmountNgn,
        draft.date,
        draft.category,
        draft.imageHash,
        draft.rawOcrText,
        'pending',
        now,
        now,
      ]
    );

    if (draft.vatAmountNgn > 0) {
      const creditId = generateId();
      const date = new Date(draft.date);
      await db.runAsync(
        `INSERT INTO vat_credits
          (id, receipt_id, business_id, amount_ngn, period_month, period_year, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          creditId,
          id,
          resolvedBusinessId,
          draft.vatAmountNgn,
          date.getMonth() + 1,
          date.getFullYear(),
          'unverified',
          now,
          now,
        ]
      );
      await db.runAsync('UPDATE receipts SET vat_credit_id = ? WHERE id = ?', [creditId, id]);
      record.vatCreditId = creditId;
    }

    await logComplianceEvent(
      'receipt_scanned',
      'Receipt scanned and saved locally',
      'info',
      { receiptId: id },
      { businessId: resolvedBusinessId }
    );

    await offlineQueue.enqueue('RECEIPT_SUBMIT', {
      client_receipt_id: id,
      business_id: resolvedBusinessId,
      vendor_name: draft.vendorName,
      vendor_tin: draft.vendorTin,
      amount_ngn: draft.amountNgn,
      vat_amount_ngn: draft.vatAmountNgn,
      date: draft.date,
      category: draft.category,
      image_hash: draft.imageHash,
      raw_ocr_text: draft.rawOcrText,
    });

    return record;
  },

  async markServerConfirmed(clientId: string, serverId: string, serverVatCreditNgn?: number): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE receipts SET server_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [serverId, 'synced', now, clientId]
    );

    if (typeof serverVatCreditNgn === 'number') {
      await db.runAsync(
        `UPDATE vat_credits
         SET amount_ngn = ?, status = 'verified', updated_at = ?
         WHERE receipt_id = ?`,
        [serverVatCreditNgn, now, clientId]
      );
    }
  },

  async markFlagged(clientId: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE receipts SET status = ?, updated_at = ? WHERE id = ?',
      ['flagged', now, clientId]
    );
  },

  async markDuplicate(clientId: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE receipts SET status = ?, updated_at = ? WHERE id = ?',
      ['duplicate', now, clientId]
    );
  },

  async getStats(businessId: string, month: number, year: number): Promise<{
    count: number;
    totalAmountNgn: number;
    totalVatCreditNgn: number;
  }> {
    const resolvedBusinessId = businessId || RECEIPT_FALLBACK_BUSINESS_ID;
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number; total: number | null; vat: number | null }>(
      `SELECT
         COUNT(r.id) as cnt,
         SUM(r.amount_ngn) as total,
         COALESCE(SUM(vc.amount_ngn), 0) as vat
       FROM receipts r
       LEFT JOIN vat_credits vc ON vc.receipt_id = r.id
         AND vc.period_month = ? AND vc.period_year = ?
       WHERE r.business_id = ?
         AND r.status != 'duplicate'
         AND strftime('%m', r.date) = printf('%02d', ?)
         AND strftime('%Y', r.date) = ?`,
      [month, year, resolvedBusinessId, month, String(year)]
    );

    return {
      count: row?.cnt ?? 0,
      totalAmountNgn: row?.total ?? 0,
      totalVatCreditNgn: row?.vat ?? 0,
    };
  },

  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM receipts WHERE status = 'pending'"
    );
    return row?.c ?? 0;
  },
};
