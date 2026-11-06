import type * as SQLite from 'expo-sqlite';

export interface LocalPaymentResult {
  gateway: 'paystack' | 'flutterwave' | 'remita';
  rrr: string;
  amount: number;
}

export type LocalPaymentDatabase = SQLite.SQLiteDatabase;

/**
 * Persist a server-authoritative payment result exactly once locally.
 *
 * The SQLite schema has a partial unique index on idempotency_key. This helper
 * must receive the same key used for the server request so safe network retries
 * and server response recovery do not create duplicate local payment entries.
 */
export async function persistLocalPayment(
  db: LocalPaymentDatabase,
  payment: LocalPaymentResult,
  idempotencyKey: string,
): Promise<void> {
  if (idempotencyKey.trim().length < 16 || idempotencyKey.length > 200) {
    throw new Error('A valid payment idempotency key is required');
  }
  if (!payment.rrr || !Number.isFinite(payment.amount) || payment.amount <= 0) {
    throw new Error('Invalid server payment result');
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO tax_payments (
       provider, provider_ref, remita_rrr, amount, currency, status, idempotency_key
     ) VALUES (?, ?, ?, ?, 'NGN', 'pending', ?)`,
    [
      payment.gateway,
      payment.rrr,
      payment.gateway === 'remita' ? payment.rrr : null,
      payment.amount,
      idempotencyKey,
    ],
  );
}
