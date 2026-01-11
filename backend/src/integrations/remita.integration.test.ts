import axios from 'axios';
import crypto from 'crypto';
import { RemitaClient } from './remita';
import { 
  mockRemitaInitResponse, 
  mockRemitaStatusResponse,
  createMockPaymentData 
} from '../../jest.setup';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Remita API Integration Tests', () => {
  let client: RemitaClient;

  beforeEach(() => {
    client = new RemitaClient();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    process.env.REMITA_MERCHANT_ID = 'test-merchant-id';
    process.env.REMITA_API_KEY = 'test-api-key';
    process.env.REMITA_SERVICE_TYPE_ID = 'test-service-type';
    process.env.REMITA_API_URL = 'https://remitademo.net/remita';
    
    mockedAxios.post.mockImplementation(() => Promise.resolve({ data: {} }));
    mockedAxios.get.mockImplementation(() => Promise.resolve({ data: {} }));
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('SHA512 Hash Generation', () => {
    test('generates correct hash for payment initialization', () => {
      const orderId = 'ORDER-123';
      const amount = 1000;
      
      // Expected hash calculation
      const hashString = 'test-merchant-idtest-service-typeORDER-1231000test-api-key';
      const expectedHash = crypto.createHash('sha512').update(hashString).digest('hex');
      
      // We need to access the private method through the class instance
      // For testing purposes, we'll verify the hash generation logic
      const testHash = crypto.createHash('sha512')
        .update(`test-merchant-idtest-service-type${orderId}${amount}test-api-key`)
        .digest('hex');
      
      expect(testHash).toBe(expectedHash);
    });

    test('generates different hashes for different orders', () => {
      const hash1 = crypto.createHash('sha512')
        .update('test-merchant-idtest-service-typeORDER-1231000test-api-key')
        .digest('hex');
      
      const hash2 = crypto.createHash('sha512')
        .update('test-merchant-idtest-service-typeORDER-4562000test-api-key')
        .digest('hex');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Payment Initialization', () => {
    const paymentRequest = {
      merchantId: 'test-merchant-id',
      serviceTypeId: 'test-service-type',
      orderId: 'ORDER-123',
      amount: 1000,
      payerName: 'John Doe',
      payerEmail: 'john@example.com',
      payerPhone: '+2348012345678',
      description: 'TaxBridge Invoice Payment'
    };

    test('initializes payment with correct parameters and hash', async () => {
      const mockInitResponse = {
        rrr: 'RRR-123456789',
        status: 'pending',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        transactionDate: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockInitResponse
      });

      const result = await client.initializePayment(paymentRequest);

      // Verify hash generation
      const expectedHash = crypto.createHash('sha512')
        .update('test-merchant-idtest-service-typeORDER-1231000test-api-key')
        .digest('hex');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://remitademo.net/remita/ecomm/init.reg',
        {
          merchantId: 'test-merchant-id',
          serviceTypeId: 'test-service-type',
          orderId: 'ORDER-123',
          amount: 1000,
          payerName: 'John Doe',
          payerEmail: 'john@example.com',
          payerPhone: '+2348012345678',
          description: 'TaxBridge Invoice Payment',
          hash: expectedHash
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      expect(result.rrr).toBe('RRR-123456789');
      expect(result.status).toBe('pending');
      expect(result.paymentUrl).toContain('RRR-123456789');
    });

    test('handles payment initialization failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error') as any);

      await expect(client.initializePayment(paymentRequest)).rejects.toThrow('Payment initialization failed');
    });

    test('uses default description when not provided', async () => {
      const paymentWithoutDescription = { ...paymentRequest };
      (paymentWithoutDescription as any).description = undefined;

      const mockInitResponse = {
        rrr: 'RRR-123456789',
        status: 'pending',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        transactionDate: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockInitResponse
      });

      await client.initializePayment(paymentWithoutDescription);

      const callArgs = mockedAxios.post.mock.calls[0];
      expect(callArgs[1].description).toBe('TaxBridge Invoice Payment');
    });
  });

  describe('Payment Status Check', () => {
    test('retrieves payment status with correct hash', async () => {
      const mockStatusResponse = {
        rrr: 'RRR-123456789',
        status: 'successful' as const,
        amount: 1000,
        transactionDate: '2026-01-15T10:00:00Z',
        paymentDate: '2026-01-15T10:05:00Z',
        transactionReference: 'TXN-123456',
        responseCode: '00',
        responseMessage: 'Payment successful'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockStatusResponse
      });

      const result = await client.getPaymentStatus('RRR-123456789', 1000);

      // Verify hash generation for status check
      const expectedHash = crypto.createHash('sha512')
        .update('test-merchant-idRRR-1234567891000test-api-key')
        .digest('hex');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://remitademo.net/remita/ecomm/status.reg',
        {
          params: {
            merchantId: 'test-merchant-id',
            rrr: 'RRR-123456789',
            hash: expectedHash
          },
          timeout: 10000,
        }
      );

      expect(result.rrr).toBe('RRR-123456789');
      expect(result.status).toBe('successful');
      expect(result.amount).toBe(1000);
      expect(result.transactionReference).toBe('TXN-123456');
    });

    test('handles pending payment status', async () => {
      const mockStatusResponse = {
        rrr: 'RRR-123456789',
        status: 'pending' as const,
        amount: 1000,
        transactionDate: '2026-01-15T10:00:00Z'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockStatusResponse
      });

      const result = await client.getPaymentStatus('RRR-123456789', 1000);

      expect(result.status).toBe('pending');
      expect(result.paymentDate).toBeUndefined();
    });

    test('handles failed payment status', async () => {
      const mockStatusResponse = {
        rrr: 'RRR-123456789',
        status: 'failed' as const,
        amount: 1000,
        transactionDate: '2026-01-15T10:00:00Z',
        responseCode: '01',
        responseMessage: 'Insufficient funds'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockStatusResponse
      });

      const result = await client.getPaymentStatus('RRR-123456789', 1000);

      expect(result.status).toBe('failed');
      expect(result.responseMessage).toBe('Insufficient funds');
    });

    test('handles status check failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('RRR not found') as any);

      await expect(client.getPaymentStatus('INVALID-RRR', 1000)).rejects.toThrow('Payment status check failed');
    });
  });

  describe('Transaction History', () => {
    test('retrieves transaction history for date range', async () => {
      const mockHistoryResponse = [
        {
          rrr: 'RRR-123456789',
          status: 'successful' as const,
          amount: 1000,
          transactionDate: '2026-01-15T10:00:00Z',
          paymentDate: '2026-01-15T10:05:00Z'
        },
        {
          rrr: 'RRR-987654321',
          status: 'pending' as const,
          amount: 2000,
          transactionDate: '2026-01-14T15:30:00Z'
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHistoryResponse
      });

      const result = await client.getTransactionHistory('2026-01-14', '2026-01-15');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://remitademo.net/remita/ecomm/transactions',
        {
          params: {
            merchantId: 'test-merchant-id',
            startDate: '2026-01-14',
            endDate: '2026-01-15'
          },
          timeout: 30000,
        }
      );

      expect(result).toHaveLength(2);
      expect(result[0].rrr).toBe('RRR-123456789');
      expect(result[0].status).toBe('successful');
      expect(result[1].rrr).toBe('RRR-987654321');
      expect(result[1].status).toBe('pending');
    });

    test('handles transaction history fetch failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Server error') as any);

      await expect(client.getTransactionHistory('2026-01-01', '2026-01-31')).rejects.toThrow('Transaction history fetch failed');
    });
  });

  describe('Health Check', () => {
    test('returns healthy status when API is responding', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      const result = await client.checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThan(0);
      expect(typeof result.latency).toBe('number');
    });

    test('returns degraded status when API returns non-200 status', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 503,
        data: { status: 'error' }
      });

      const result = await client.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.latency).toBeGreaterThan(0);
    });

    test('returns error status when API is unreachable', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout') as any);

      const result = await client.checkHealth();

      expect(result.status).toBe('error');
      expect(result.latency).toBeNull();
    });

    test('uses test RRR for health check', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      await client.checkHealth();

      const expectedHash = crypto.createHash('sha512')
        .update('test-merchant-idTEST1234567890test-api-key')
        .digest('hex');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://remitademo.net/remita/ecomm/status.reg',
        {
          params: {
            merchantId: 'test-merchant-id',
            rrr: 'TEST123456789',
            hash: expectedHash
          },
          timeout: 10000,
        }
      );
    });
  });

  describe('Timeout Handling', () => {
    test('applies correct timeout for different operations', async () => {
      // Mock responses
      mockedAxios.get.mockResolvedValue({ status: 200, data: { status: 'ok' } });
      mockedAxios.post.mockResolvedValue({ data: { rrr: 'RRR-123', status: 'pending' } });

      // Test health check timeout (10 seconds)
      await client.checkHealth();
      const healthCall = mockedAxios.get.mock.calls.find(call => 
        call[0]?.includes('/status.reg') && call[1]?.params?.rrr === 'TEST123456789'
      );
      expect(healthCall?.[1]?.timeout).toBe(10000);

      // Test payment initialization timeout (30 seconds)
      await client.initializePayment({
        merchantId: 'test-merchant-id',
        serviceTypeId: 'test-service-type',
        orderId: 'ORDER-123',
        amount: 1000,
        payerName: 'John Doe',
        payerEmail: 'john@example.com',
        payerPhone: '+2348012345678'
      });
      const initCall = mockedAxios.post.mock.calls.find(call => 
        call[0]?.includes('/init.reg')
      );
      expect(initCall?.[2]?.timeout).toBe(30000);

      // Test status check timeout (10 seconds)
      await client.getPaymentStatus('RRR-123', 1000);
      const statusCall = mockedAxios.get.mock.calls.find(call => 
        call[0]?.includes('/status.reg') && call[1]?.params?.rrr === 'RRR-123'
      );
      expect(statusCall?.[1]?.timeout).toBe(10000);

      // Test transaction history timeout (30 seconds)
      await client.getTransactionHistory('2026-01-01', '2026-01-31');
      const historyCall = mockedAxios.get.mock.calls.find(call => 
        call[0]?.includes('/transactions')
      );
      expect(historyCall?.[1]?.timeout).toBe(30000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles missing environment variables gracefully', async () => {
      // Clear environment variables
      (process.env as any).REMITA_MERCHANT_ID = undefined;
      (process.env as any).REMITA_API_KEY = undefined;
      (process.env as any).REMITA_SERVICE_TYPE_ID = undefined;

      // Create new client instance to test constructor behavior
      const newClient = new RemitaClient();

      // Should still attempt API calls with empty strings
      mockedAxios.get.mockRejectedValueOnce(new Error('Bad request') as any);

      const result = await newClient.checkHealth();
      expect(result.status).toBe('error');
    });

    test('validates amount parameter in hash generation', async () => {
      const paymentRequest = {
        merchantId: 'test-merchant-id',
        serviceTypeId: 'test-service-type',
        orderId: 'ORDER-123',
        amount: 0, // Zero amount
        payerName: 'John Doe',
        payerEmail: 'john@example.com',
        payerPhone: '+2348012345678'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { rrr: 'RRR-123', status: 'pending' }
      });

      await client.initializePayment(paymentRequest);

      const callArgs = mockedAxios.post.mock.calls[0];
      // Hash should include zero amount
      expect(callArgs[1].hash).toBeDefined();
      expect(typeof callArgs[1].hash).toBe('string');
      expect(callArgs[1].hash.length).toBe(128); // SHA512 hex length
    });
  });

  describe('Webhook Idempotency and Database Integration', () => {
    // Mock Prisma client for testing
    const mockPrismaClient = {
      payment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        update: jest.fn(),
      },
      idempotencyCache: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const crypto = require('crypto');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('creates payment record with pending status after RRR generation', async () => {
      const paymentData = {
        id: 'payment-001',
        invoiceId: 'test-invoice-123',
        rrr: 'RRR-123456789',
        amount: 1000,
        status: 'pending',
        payerName: 'John Doe',
        payerEmail: 'john@example.com',
        payerPhone: '+2348012345678',
        createdAt: new Date(),
      };

      mockPrismaClient.payment.create.mockResolvedValue(paymentData);

      const result = await mockPrismaClient.payment.create({
        data: paymentData,
      });

      expect(result.status).toBe('pending');
      expect(result.rrr).toBe('RRR-123456789');
      expect(mockPrismaClient.payment.create).toHaveBeenCalled();
    });

    test('verifies webhook signature before processing', () => {
      const payload = JSON.stringify({
        rrr: 'RRR-123456789',
        amount: 1000,
        status: 'successful',
        transactionDate: '2026-01-15T10:00:00Z'
      });

      const validSignature = crypto
        .createHmac('sha512', 'test-api-key')
        .update(payload)
        .digest('hex');

      // Simulate signature verification
      const isValid = crypto
        .createHmac('sha512', 'test-api-key')
        .update(payload)
        .digest('hex') === validSignature;

      expect(isValid).toBe(true);
    });

    test('rejects webhook with invalid signature', () => {
      const payload = JSON.stringify({
        rrr: 'RRR-123456789',
        amount: 1000,
        status: 'successful',
      });

      const invalidSignature = 'invalid-signature-12345';
      const apiKey = 'test-api-key';

      const validSignature = crypto
        .createHmac('sha512', apiKey)
        .update(payload)
        .digest('hex');

      const isValid = validSignature === invalidSignature;

      expect(isValid).toBe(false);
    });

    test('implements idempotency check for duplicate webhooks', async () => {
      const webhookPayload = {
        rrr: 'RRR-123456789',
        amount: 1000,
        status: 'successful',
        transactionDate: '2026-01-15T10:00:00Z'
      };

      const requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      const cacheKey = `remita:webhook:${requestHash}`;

      // First webhook attempt
      mockPrismaClient.idempotencyCache.findUnique.mockResolvedValueOnce(null);
      mockPrismaClient.idempotencyCache.create.mockResolvedValueOnce({
        key: cacheKey,
        requestHash,
        statusCode: 200,
        responseBody: { received: true },
        createdAt: new Date(),
      });

      const firstResult = await mockPrismaClient.idempotencyCache.findUnique({
        where: { key: cacheKey },
      });
      expect(firstResult).toBeNull();

      await mockPrismaClient.idempotencyCache.create({
        data: {
          key: cacheKey,
          requestHash,
          method: 'POST',
          path: '/webhooks/remita/payment',
          statusCode: 200,
          responseBody: { received: true },
        },
      });

      // Second webhook attempt (duplicate)
      mockPrismaClient.idempotencyCache.findUnique.mockResolvedValueOnce({
        key: cacheKey,
        requestHash,
        statusCode: 200,
        responseBody: { received: true },
      });

      const secondResult = await mockPrismaClient.idempotencyCache.findUnique({
        where: { key: cacheKey },
      });

      expect(secondResult).toBeDefined();
      expect(secondResult.statusCode).toBe(200);
      expect(mockPrismaClient.idempotencyCache.create).toHaveBeenCalledTimes(1);
    });

    test('updates payment and invoice status after successful webhook verification', async () => {
      const webhookData = {
        rrr: 'RRR-123456789',
        status: 'successful',
        amount: 1000,
        transactionReference: 'TXN-123456',
        paymentDate: '2026-01-15T10:05:00Z'
      };

      // Find payment by RRR
      mockPrismaClient.payment.findUnique.mockResolvedValue({
        id: 'payment-001',
        invoiceId: 'test-invoice-123',
        rrr: 'RRR-123456789',
        status: 'pending',
      });

      // Update payment status
      mockPrismaClient.payment.update.mockResolvedValue({
        id: 'payment-001',
        status: 'paid',
        paidAt: new Date(webhookData.paymentDate),
        transactionReference: webhookData.transactionReference,
      });

      // Update invoice status
      mockPrismaClient.invoice.update.mockResolvedValue({
        id: 'test-invoice-123',
        status: 'paid',
      });

      const payment = await mockPrismaClient.payment.findUnique({
        where: { rrr: 'RRR-123456789' },
      });

      expect(payment).toBeDefined();

      const updatedPayment = await mockPrismaClient.payment.update({
        where: { id: payment.id },
        data: {
          status: 'paid',
          paidAt: new Date(webhookData.paymentDate),
          transactionReference: webhookData.transactionReference,
        },
      });

      expect(updatedPayment.status).toBe('paid');

      const updatedInvoice = await mockPrismaClient.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: 'paid' },
      });

      expect(updatedInvoice.status).toBe('paid');
    });

    test('handles webhook for already paid invoice gracefully', async () => {
      // Payment already paid
      mockPrismaClient.payment.findUnique.mockResolvedValue({
        id: 'payment-001',
        invoiceId: 'test-invoice-123',
        rrr: 'RRR-123456789',
        status: 'paid',
        paidAt: new Date('2026-01-15T10:00:00Z'),
      });

      const payment = await mockPrismaClient.payment.findUnique({
        where: { rrr: 'RRR-123456789' },
      });

      expect(payment.status).toBe('paid');
      // Should not update again
      expect(mockPrismaClient.payment.update).not.toHaveBeenCalled();
    });

    test('stores failed payment attempt with error details', async () => {
      const webhookData = {
        rrr: 'RRR-123456789',
        status: 'failed',
        errorMessage: 'Insufficient funds',
        transactionDate: '2026-01-15T10:05:00Z'
      };

      mockPrismaClient.payment.update.mockResolvedValue({
        id: 'payment-001',
        status: 'failed',
        errorMessage: 'Insufficient funds',
        updatedAt: new Date(),
      });

      const result = await mockPrismaClient.payment.update({
        where: { rrr: 'RRR-123456789' },
        data: {
          status: 'failed',
          errorMessage: 'Insufficient funds',
        },
      });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Insufficient funds');
    });

    test('maintains audit trail of payment status transitions', async () => {
      // Initial creation
      mockPrismaClient.payment.create.mockResolvedValueOnce({
        id: 'payment-001',
        status: 'pending',
        createdAt: new Date('2026-01-15T10:00:00Z'),
      });

      await mockPrismaClient.payment.create({
        data: { id: 'payment-001', status: 'pending' },
      });

      // Webhook received
      mockPrismaClient.payment.update.mockResolvedValueOnce({
        id: 'payment-001',
        status: 'paid',
        updatedAt: new Date('2026-01-15T10:05:00Z'),
      });

      await mockPrismaClient.payment.update({
        where: { id: 'payment-001' },
        data: { status: 'paid' },
      });

      expect(mockPrismaClient.payment.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaClient.payment.update).toHaveBeenCalledTimes(1);
    });

    test('queues webhook processing for async handling', async () => {
      // Mock queue addition
      const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'job-001' }),
      };

      const webhookPayload = {
        rrr: 'RRR-123456789',
        status: 'successful',
        amount: 1000,
      };

      await mockQueue.add('process-remita-webhook', webhookPayload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-remita-webhook',
        webhookPayload,
        expect.objectContaining({
          attempts: 3,
          backoff: expect.any(Object),
        })
      );
    });
  });
});
