import Fastify, { type FastifyInstance } from 'fastify';

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);
const mockPaymentInitialize = jest.fn();
const mockEmitTransactionCreated = jest.fn().mockResolvedValue(undefined);
const mockPrisma = {
  invoice: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  idempotencyCache: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../../queue/client', () => ({
  getInvoiceSyncQueue: () => ({ add: mockQueueAdd }),
  getPaymentQueue: () => null,
  getRedisConnection: () => null,
}));
jest.mock('../../services/event-bus', () => ({
  emitTransactionCreated: (...args: unknown[]) => mockEmitTransactionCreated(...args),
}));
jest.mock('../../services/payment-gateway', () => ({
  paymentGateway: { initializePayment: (...args: unknown[]) => mockPaymentInitialize(...args) },
}));
jest.mock('../../integrations/remita/adapter', () => ({
  remitaAdapter: { verifyWebhookSignature: jest.fn().mockReturnValue(false) },
}));
jest.mock('../../integrations/paystack/adapter', () => ({
  paystackAdapter: { verifyWebhookSignature: jest.fn().mockReturnValue(false) },
}));
jest.mock('../../integrations/flutterwave/adapter', () => ({
  flutterwaveAdapter: { verifyWebhookSignature: jest.fn().mockReturnValue(false) },
}));
jest.mock('../../services/metrics', () => ({
  metrics: { recordRemitaWebhook: jest.fn() },
}));
jest.mock('../../lib/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));
jest.mock('../dashboard-composite', () => ({
  invalidateDashboardCache: jest.fn().mockResolvedValue(undefined),
}));

import invoicesRoutes from '../invoices';
import paymentRoutes from '../payments';

function authenticateAsPrincipal(app: FastifyInstance): void {
  (app as any).decorate('authenticate', async (request: any, reply: any) => {
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    const userId = authorization.slice('Bearer '.length);
    if (!userId) return reply.code(401).send({ error: 'UNAUTHORIZED' });
    request.user = { userId, orgId: 'org-' + userId, role: 'OWNER', roleVersion: 0 };
  });
}

async function createInvoiceApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  authenticateAsPrincipal(app);
  await app.register(invoicesRoutes as any, { prisma: mockPrisma as any });
  await app.ready();
  return app;
}

async function createPaymentApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  authenticateAsPrincipal(app);
  await app.register(paymentRoutes as any, { prisma: mockPrisma as any });
  await app.ready();
  return app;
}

describe('Invoice and payment route security boundaries', () => {
  let invoiceApp: FastifyInstance;
  let paymentApp: FastifyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
    mockEmitTransactionCreated.mockResolvedValue(undefined);
    mockPaymentInitialize.mockReset();
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyCache.create.mockResolvedValue({});
    mockPrisma.idempotencyCache.delete.mockResolvedValue({});
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.findUnique.mockResolvedValue(null);
    mockPrisma.invoice.update.mockResolvedValue({});
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockPrisma.payment.create.mockResolvedValue({ id: 'payment-reservation' });
    mockPrisma.payment.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      invoice: mockPrisma.invoice,
      payment: mockPrisma.payment,
    }));
  });

  afterEach(async () => {
    if (invoiceApp) await invoiceApp.close();
    if (paymentApp) await paymentApp.close();
  });

  it('rejects invoice creation without an authenticated principal', async () => {
    invoiceApp = await createInvoiceApp();
    const response = await invoiceApp.inject({
      method: 'POST',
      url: '/api/v1/invoices',
      payload: {
        customerName: 'Buyer',
        items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it('scopes invoice idempotency keys by authenticated user', async () => {
    invoiceApp = await createInvoiceApp();
    mockPrisma.invoice.create
      .mockResolvedValueOnce({ id: 'invoice-a', status: 'queued' })
      .mockResolvedValueOnce({ id: 'invoice-b', status: 'queued' });

    const payload = {
      customerName: 'Buyer',
      items: [{ description: 'Service', quantity: 1, unitPrice: 1000 }],
    };

    const first = await invoiceApp.inject({
      method: 'POST',
      url: '/api/v1/invoices',
      headers: { authorization: 'Bearer user-a', 'idempotency-key': 'same-client-key' },
      payload,
    });
    const second = await invoiceApp.inject({
      method: 'POST',
      url: '/api/v1/invoices',
      headers: { authorization: 'Bearer user-b', 'idempotency-key': 'same-client-key' },
      payload,
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(mockPrisma.idempotencyCache.create.mock.calls.map(([call]) => call.data.key)).toEqual([
      'invoice:user-a:same-client-key',
      'invoice:user-b:same-client-key',
    ]);
    expect(mockPrisma.invoice.create.mock.calls[0][0].data.userId).toBe('user-a');
    expect(mockPrisma.invoice.create.mock.calls[1][0].data.userId).toBe('user-b');
  });

  it('filters invoice detail by both invoice ID and authenticated owner', async () => {
    invoiceApp = await createInvoiceApp();
    const response = await invoiceApp.inject({
      method: 'GET',
      url: '/api/v1/invoices/invoice-owned-by-another-user',
      headers: { authorization: 'Bearer user-a' },
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'invoice-owned-by-another-user', userId: 'user-a' },
    });
  });

  it('rejects payment initiation without an authenticated principal', async () => {
    paymentApp = await createPaymentApp();
    const response = await paymentApp.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      payload: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        payerName: 'Payer',
        payerEmail: 'payer@example.com',
        payerPhone: '08000000000',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mockPaymentInitialize).not.toHaveBeenCalled();
  });

  it('does not expose another user invoice to payment initiation', async () => {
    paymentApp = await createPaymentApp();
    mockPrisma.invoice.findFirst.mockResolvedValue(null);

    const response = await paymentApp.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-a' },
      payload: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        payerName: 'Payer',
        payerEmail: 'payer@example.com',
        payerPhone: '08000000000',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e', userId: 'user-a' },
    });
    expect(mockPaymentInitialize).not.toHaveBeenCalled();
  });

  it('rejects a second payment while an existing attempt is pending', async () => {
    paymentApp = await createPaymentApp();
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
      userId: 'user-a',
      status: 'stamped',
      total: { toString: () => '1250.00' },
    });
    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      status: 'pending',
    });

    const response = await paymentApp.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-a' },
      payload: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        payerName: 'Payer',
        payerEmail: 'payer@example.com',
        payerPhone: '08000000000',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe('PAYMENT_ALREADY_PENDING');
    expect(mockPaymentInitialize).not.toHaveBeenCalled();
  });

  it('reserves the invoice before contacting the gateway and blocks concurrent attempts', async () => {
    paymentApp = await createPaymentApp();
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
      userId: 'user-a',
      status: 'stamped',
      total: { toString: () => '1250.00' },
    });

    let releaseProvider: ((value: {
      success: boolean;
      gateway: 'remita';
      reference: string;
      paymentUrl: string;
    }) => void) | undefined;
    let providerStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { providerStarted = resolve; });
    const providerResult = new Promise<{
      success: boolean;
      gateway: 'remita';
      reference: string;
      paymentUrl: string;
    }>((resolve) => { releaseProvider = resolve; });
    mockPaymentInitialize.mockImplementation(() => {
      providerStarted?.();
      return providerResult;
    });

    const firstRequest = paymentApp.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-a', 'idempotency-key': 'attempt-one' },
      payload: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        payerName: 'Payer',
        payerEmail: 'payer@example.com',
        payerPhone: '08000000000',
      },
    });

    await started;
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'processing' }),
    }));

    mockPrisma.payment.findFirst.mockResolvedValue({
      id: 'payment-reservation',
      status: 'processing',
    });
    const secondResponse = await paymentApp.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-a', 'idempotency-key': 'attempt-two' },
      payload: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        payerName: 'Payer',
        payerEmail: 'payer@example.com',
        payerPhone: '08000000000',
      },
    });

    expect(secondResponse.statusCode).toBe(409);
    expect(mockPaymentInitialize).toHaveBeenCalledTimes(1);

    releaseProvider?.({
      success: true,
      gateway: 'remita',
      reference: 'rrr-concurrent',
      paymentUrl: 'https://payments.example/concurrent',
    });
    const firstResponse = await firstRequest;
    expect(firstResponse.statusCode).toBe(200);
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'payment-reservation' },
      data: expect.objectContaining({ status: 'pending', rrr: 'rrr-concurrent' }),
    }));
  });

  it('requires ownership to read payment status', async () => {
    paymentApp = await createPaymentApp();
    const anonymous = await paymentApp.inject({
      method: 'GET',
      url: '/api/v1/payments/f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e/status',
    });
    expect(anonymous.statusCode).toBe(401);

    mockPrisma.payment.findFirst.mockResolvedValue(null);
    const response = await paymentApp.inject({
      method: 'GET',
      url: '/api/v1/payments/f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e/status',
      headers: { authorization: 'Bearer user-a' },
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({
      where: {
        invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
        invoice: { userId: 'user-a' },
      },
      orderBy: { createdAt: 'desc' },
      include: { invoice: true },
    });
  });

  it('scopes payment idempotency keys by authenticated user', async () => {
    paymentApp = await createPaymentApp();
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
      userId: 'user-a',
      status: 'stamped',
      total: { toString: () => '1250.00' },
    });
    mockPaymentInitialize
      .mockResolvedValueOnce({
        success: true, gateway: 'remita', reference: 'rrr-user-a',
        paymentUrl: 'https://payments.example/a',
      })
      .mockResolvedValueOnce({
        success: true, gateway: 'remita', reference: 'rrr-user-b',
        paymentUrl: 'https://payments.example/b',
      });
    mockPrisma.invoice.findFirst
      .mockResolvedValueOnce({
        id: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e', userId: 'user-a',
        status: 'stamped', total: { toString: () => '1250.00' },
      })
      .mockResolvedValueOnce({
        id: 'a20fceaa-c7c4-4d9a-b15b-c2b2f9c9097e', userId: 'user-b',
        status: 'stamped', total: { toString: () => '1250.00' },
      });

    const payload = {
      invoiceId: 'f10fceaa-c7c4-4d9a-b15b-c2b2f9c9097e',
      payerName: 'Payer',
      payerEmail: 'payer@example.com',
      payerPhone: '08000000000',
    };
    const first = await paymentApp.inject({
      method: 'POST', url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-a', 'idempotency-key': 'same-client-key' },
      payload,
    });
    expect(first.statusCode).toBe(200);
    const second = await paymentApp.inject({
      method: 'POST', url: '/api/v1/payments/generate',
      headers: { authorization: 'Bearer user-b', 'idempotency-key': 'same-client-key' },
      payload: { ...payload, invoiceId: 'a20fceaa-c7c4-4d9a-b15b-c2b2f9c9097e' },
    });
    expect(second.statusCode).toBe(200);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.payment.create.mock.calls.every(([call]) => call.data.status === 'processing')).toBe(true);
    expect(mockPrisma.payment.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.idempotencyCache.create.mock.calls.map(([call]) => call.data.key)).toEqual([
      'payment:user-a:same-client-key',
      'payment:user-b:same-client-key',
    ]);
  });
});
