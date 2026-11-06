import Fastify from 'fastify';

const mockInitializePayment = jest.fn();
const mockGetAvailableGateways = jest.fn();
const mockPrisma = {
  invoice: { findFirst: jest.fn() },
  payment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  idempotencyCache: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock('../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../services/payment-gateway', () => ({
  paymentGateway: {
    initializePayment: mockInitializePayment,
    getAvailableGateways: mockGetAvailableGateways,
  },
}));
jest.mock('../lib/redis', () => ({ redis: {} }));
jest.mock('../queue/client', () => ({ getPaymentQueue: jest.fn(() => null), getRedisConnection: jest.fn(() => null) }));
jest.mock('../services/metrics', () => ({ metrics: {} }));
jest.mock('../routes/dashboard-composite', () => ({ invalidateDashboardCache: jest.fn() }));

import paymentRoutes from '../routes/payments';

const invoiceId = '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55';
const userId = 'd48c8d8e-106a-4f70-9501-1cfadd4e2185';
const idempotencyHeader = 'taxbridge-payment-attempt-00000001';
const paymentRequest = {
  invoiceId,
  payerName: 'Test Merchant',
  payerEmail: 'merchant@example.invalid',
  payerPhone: '+2348012345678',
  gateway: 'paystack',
};

describe('payment initiation idempotency and recovery', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetAvailableGateways.mockReturnValue(['paystack']);
    mockInitializePayment.mockResolvedValue({
      success: true,
      gateway: 'paystack',
      reference: 'TB-20261106-abc123',
      paymentUrl: 'https://checkout.paystack.com/mock/TB-20261106-abc123',
    });
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: invoiceId,
      userId,
      status: 'stamped',
      total: '25000.00',
    });
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockPrisma.payment.findUnique.mockResolvedValue(null);
    mockPrisma.payment.create.mockResolvedValue({ id: 'payment-row-1' });
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyCache.create.mockResolvedValue({});
    mockPrisma.idempotencyCache.update.mockResolvedValue({});
    mockPrisma.idempotencyCache.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));

    app = Fastify();
    app.decorate('authenticate', async (request: any) => {
      request.user = { userId, orgId: 'a6f6e9f4-94d7-4864-a760-f6f83a5fb73d', role: 'ACCOUNTANT', roleVersion: 0 };
    });
    app.decorate('resolveOrgContext', async (request: any) => {
      request.orgContext = {
        orgId: 'a6f6e9f4-94d7-4864-a760-f6f83a5fb73d',
        role: 'ACCOUNTANT',
        memberId: 'c6a3cbb9-6163-43f3-b43d-4a79d88a1a10',
      };
    });
    await app.register(paymentRoutes, { prisma: mockPrisma as any });
  });

  afterEach(async () => {
    await app.close();
  });

  async function submitPayment() {
    return app.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { 'Idempotency-Key': idempotencyHeader },
      payload: paymentRequest,
    });
  }

  it('persists a reservation before the external call and stores provider result before payment completion', async () => {
    const response = await submitPayment();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      rrr: 'TB-20261106-abc123',
      amount: 25000,
      gateway: 'paystack',
    });
    expect(mockPrisma.idempotencyCache.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.idempotencyCache.create.mock.invocationCallOrder[0])
      .toBeLessThan(mockInitializePayment.mock.invocationCallOrder[0]);

    const reservationUpdates = mockPrisma.idempotencyCache.update.mock.calls
      .map((call: any[]) => call[0].data.responseBody.state);
    expect(reservationUpdates).toEqual(['provider_initialized', 'complete']);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('replays the completed payment response without calling the provider again', async () => {
    const first = await submitPayment();
    expect(first.statusCode).toBe(200);

    const requestHash = mockPrisma.idempotencyCache.create.mock.calls[0][0].data.requestHash;
    const completedState = mockPrisma.idempotencyCache.update.mock.calls[1][0].data.responseBody;
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      requestHash,
      responseBody: completedState,
      statusCode: 200,
    });

    const second = await submitPayment();
    expect(second.statusCode).toBe(200);
    expect(second.json().rrr).toBe('TB-20261106-abc123');
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('persists unknown provider outcomes and blocks automatic retry', async () => {
    mockInitializePayment.mockResolvedValue({
      success: false,
      gateway: 'paystack',
      reference: '',
      paymentUrl: null,
      error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
    });

    const first = await submitPayment();
    expect(first.statusCode).toBe(409);
    expect(first.json()).toMatchObject({
      code: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
      retryable: false,
    });

    const requestHash = mockPrisma.idempotencyCache.create.mock.calls[0][0].data.requestHash;
    const unknownState = mockPrisma.idempotencyCache.update.mock.calls[0][0].data.responseBody;
    expect(unknownState.state).toBe('unknown');
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      requestHash,
      responseBody: unknownState,
      statusCode: 409,
    });

    const second = await submitPayment();
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe('PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN');
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
  });

  it('recovers a provider reference from the reservation without starting a second provider transaction', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('temporary local database failure'));
    const first = await submitPayment();
    expect(first.statusCode).toBe(503);

    const requestHash = mockPrisma.idempotencyCache.create.mock.calls[0][0].data.requestHash;
    const providerInitialized = mockPrisma.idempotencyCache.update.mock.calls[0][0].data.responseBody;
    expect(providerInitialized.state).toBe('provider_initialized');
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      requestHash,
      responseBody: providerInitialized,
      statusCode: 202,
    });

    const second = await submitPayment();
    expect(second.statusCode).toBe(200);
    expect(second.json().rrr).toBe('TB-20261106-abc123');
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('rejects missing idempotency keys before invoking a provider', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      payload: paymentRequest,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it('does not create a reservation when no gateway is configured', async () => {
    mockGetAvailableGateways.mockReturnValue([]);

    const response = await submitPayment();
    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe('PAYMENT_GATEWAY_UNAVAILABLE');
    expect(mockPrisma.idempotencyCache.create).not.toHaveBeenCalled();
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it('rejects a different idempotency key for an invoice that already has a reservation', async () => {
    const first = await submitPayment();
    expect(first.statusCode).toBe(200);

    const requestHash = mockPrisma.idempotencyCache.create.mock.calls[0][0].data.requestHash;
    const completedState = mockPrisma.idempotencyCache.update.mock.calls[1][0].data.responseBody;
    mockPrisma.idempotencyCache.findUnique.mockResolvedValue({
      requestHash,
      responseBody: completedState,
      statusCode: 200,
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/generate',
      headers: { 'Idempotency-Key': 'a-different-payment-key-0000001' },
      payload: paymentRequest,
    });

    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(mockInitializePayment).toHaveBeenCalledTimes(1);
  });

});

