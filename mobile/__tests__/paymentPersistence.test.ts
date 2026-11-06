import { persistLocalPayment } from '../services/paymentPersistence';

describe('persistLocalPayment', () => {
  const payment = {
    gateway: 'paystack' as const,
    rrr: 'TB-20261106-ABC123',
    amount: 25000,
  };

  it('inserts the server result with its request idempotency key', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }) };

    await persistLocalPayment(db, payment, 'taxbridge-payment-attempt-000001');

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls[0][0]).toContain('INSERT OR IGNORE');
    expect(db.runAsync.mock.calls[0][0]).toContain('idempotency_key');
    expect(db.runAsync.mock.calls[0][1]).toEqual([
      'paystack',
      'TB-20261106-ABC123',
      null,
      25000,
      'taxbridge-payment-attempt-000001',
    ]);
  });

  it('uses the RRR in the legacy Remita column only for Remita payments', async () => {
    const db = { runAsync: jest.fn().mockResolvedValue({ changes: 1 }) };

    await persistLocalPayment(
      db,
      { gateway: 'remita', rrr: '123456789012', amount: 9000 },
      'taxbridge-remita-payment-attempt-00001',
    );

    expect(db.runAsync.mock.calls[0][1]).toEqual([
      'remita',
      '123456789012',
      '123456789012',
      9000,
      'taxbridge-remita-payment-attempt-00001',
    ]);
  });

  it('rejects invalid idempotency keys before touching SQLite', async () => {
    const db = { runAsync: jest.fn() };

    await expect(persistLocalPayment(db, payment, 'short')).rejects.toThrow(
      'A valid payment idempotency key is required',
    );
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('rejects malformed server payment results', async () => {
    const db = { runAsync: jest.fn() };

    await expect(
      persistLocalPayment(db, { ...payment, amount: Number.NaN }, 'taxbridge-payment-attempt-000001'),
    ).rejects.toThrow('Invalid server payment result');
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
