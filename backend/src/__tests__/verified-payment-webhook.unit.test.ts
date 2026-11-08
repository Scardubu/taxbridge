import type { PrismaClient } from '@prisma/client';
import { settleVerifiedPayment } from '../services/verifiedPaymentWebhook';

function makePrisma(overrides?: {
  payment?: Record<string, jest.Mock>;
  transactionPayment?: Record<string, jest.Mock>;
  invoice?: Record<string, jest.Mock>;
}) {
  const payment = {
    id: 'payment-1',
    invoiceId: 'invoice-1',
    gateway: 'paystack',
    rrr: 'TB-REFERENCE-0001',
    amount: { toString: () => '2500.00' },
    status: 'pending',
    ...overrides?.payment,
  };
  const tx = {
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ status: 'paid' }),
      ...overrides?.transactionPayment,
    },
    invoice: {
      update: jest.fn().mockResolvedValue({ id: 'invoice-1', status: 'paid' }),
      ...overrides?.invoice,
    },
  };
  const prisma = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(payment),
      ...overrides?.payment,
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, tx };
}

const validInput = {
  gateway: 'paystack' as const,
  reference: 'TB-REFERENCE-0001',
  gatewayRef: 'provider-txn-17',
  amountNgn: 2500,
  currency: 'NGN',
  channel: 'card',
};

describe('settleVerifiedPayment', () => {
  test('atomically marks the provider payment and invoice paid after verification', async () => {
    const { prisma, tx } = makePrisma();

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('updated');

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { in: ['pending', 'processing'] } },
      data: expect.objectContaining({
        status: 'paid',
        gatewayRef: 'provider-txn-17',
        channel: 'card',
      }),
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: 'paid' },
    });
  });

  test('does not settle a payment from another gateway', async () => {
    const { prisma } = makePrisma({ payment: { gateway: 'flutterwave' } });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('gateway_mismatch');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('rejects a non-NGN currency and an amount below the reserved invoice amount', async () => {
    const { prisma } = makePrisma();

    await expect(settleVerifiedPayment(prisma, { ...validInput, currency: 'USD' })).resolves.toBe('currency_mismatch');
    await expect(settleVerifiedPayment(prisma, { ...validInput, amountNgn: 2499.99 })).resolves.toBe('amount_mismatch');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('allows Flutterwave overpayment but still rejects underpayment', async () => {
    const { prisma } = makePrisma({ payment: { gateway: 'flutterwave' } });

    await expect(settleVerifiedPayment(prisma, {
      ...validInput,
      gateway: 'flutterwave',
      amountNgn: 2500.01,
      allowOverpayment: true,
    })).resolves.toBe('updated');
    await expect(settleVerifiedPayment(prisma, {
      ...validInput,
      gateway: 'flutterwave',
      amountNgn: 2499.99,
      allowOverpayment: true,
    })).resolves.toBe('amount_mismatch');
  });

  test('treats a duplicate notification as already paid without reopening the transaction', async () => {
    const { prisma } = makePrisma({ payment: { status: 'paid' } });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('already_paid');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('handles concurrent duplicate webhook deliveries idempotently', async () => {
    const { prisma } = makePrisma({
      transactionPayment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      payment: { status: 'pending' },
    });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('already_paid');
  });
});
