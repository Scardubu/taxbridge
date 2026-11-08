import type { PrismaClient } from '@prisma/client';
import { settleVerifiedPayment } from '../services/verifiedPaymentWebhook';

function makePrisma(options: {
  paymentRecord?: Record<string, unknown>;
  updateCount?: number;
  statusAfterConcurrentUpdate?: string;
} = {}) {
  const paymentRecord = {
    id: 'payment-1',
    invoiceId: 'invoice-1',
    gateway: 'paystack',
    rrr: 'TB-REFERENCE-0001',
    amount: { toString: () => '2500.00' },
    status: 'pending',
    ...options.paymentRecord,
  };

  const transactionClient = {
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.updateCount ?? 1 }),
      findUnique: jest.fn().mockResolvedValue({
        status: options.statusAfterConcurrentUpdate ?? 'paid',
      }),
    },
    invoice: {
      update: jest.fn().mockResolvedValue({ id: 'invoice-1', status: 'paid' }),
    },
  };

  const prisma = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(paymentRecord),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    ),
  };

  return { prisma: prisma as unknown as PrismaClient, transactionClient };
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
    const { prisma, transactionClient } = makePrisma();

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('updated');

    expect(transactionClient.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-1', status: { in: ['pending', 'processing'] } },
      data: expect.objectContaining({
        status: 'paid',
        gatewayRef: 'provider-txn-17',
        channel: 'card',
      }),
    });
    expect(transactionClient.invoice.update).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      data: { status: 'paid' },
    });
  });

  test('does not settle a payment belonging to another gateway', async () => {
    const { prisma } = makePrisma({ paymentRecord: { gateway: 'flutterwave' } });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('gateway_mismatch');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('rejects non-NGN currency and an amount below the reserved invoice amount', async () => {
    const { prisma } = makePrisma();

    await expect(settleVerifiedPayment(prisma, { ...validInput, currency: 'USD' })).resolves.toBe('currency_mismatch');
    await expect(settleVerifiedPayment(prisma, { ...validInput, amountNgn: 2499.99 })).resolves.toBe('amount_mismatch');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('allows Flutterwave overpayment but still rejects underpayment', async () => {
    const { prisma } = makePrisma({ paymentRecord: { gateway: 'flutterwave' } });

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

  test('treats an existing paid payment as an idempotent duplicate', async () => {
    const { prisma } = makePrisma({ paymentRecord: { status: 'paid' } });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('already_paid');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('handles concurrent duplicate webhook deliveries idempotently', async () => {
    const { prisma } = makePrisma({
      updateCount: 0,
      statusAfterConcurrentUpdate: 'paid',
    });

    await expect(settleVerifiedPayment(prisma, validInput)).resolves.toBe('already_paid');
  });
});
