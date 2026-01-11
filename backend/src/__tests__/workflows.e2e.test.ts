import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../server';
import { 
  mockDuploTokenResponse, 
  mockDuploSubmitResponse, 
  mockDuploStatusResponse,
  mockRemitaInitResponse, 
  mockRemitaStatusResponse,
  createMockInvoiceData,
  createMockPaymentData
} from '../jest.setup';
import axios from 'axios';

// Mock external APIs
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TaxBridge E2E Workflows', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Invoice to Payment Workflow', () => {
    test('full workflow: invoice creation -> UBL generation -> Duplo submission -> Remita payment -> completion', async () => {
      const invoiceData = createMockInvoiceData();
      const paymentData = createMockPaymentData();

      // Mock Duplo authentication
      mockedAxios.post.mockResolvedValue({
        data: mockDuploTokenResponse,
        status: 200
      });

      // Mock Duplo e-invoice submission
      mockedAxios.post.mockResolvedValueOnce({
        data: mockDuploSubmitResponse,
        status: 200
      });

      // Mock Remita payment initialization
      mockedAxios.post.mockResolvedValueOnce({
        data: mockRemitaInitResponse,
        status: 200
      });

      // Mock Duplo status check (stamped)
      mockedAxios.get.mockResolvedValueOnce({
        data: mockDuploStatusResponse,
        status: 200
      });

      // Mock Remita payment status (successful)
      mockedAxios.get.mockResolvedValueOnce({
        data: mockRemitaStatusResponse,
        status: 200
      });

      // Step 1: Create invoice
      const createResponse = await request(app.server)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      const invoice = createResponse.body;
      expect(invoice.id).toBeDefined();
      expect(invoice.status).toBe('draft');

      // Step 2: Generate UBL and submit to Duplo
      const submitResponse = await request(app.server)
        .post(`/api/invoices/${invoice.id}/submit`)
        .expect(200);

      expect(submitResponse.body.irn).toBe(mockDuploSubmitResponse.irn);
      expect(submitResponse.body.status).toBe('submitted');

      // Step 3: Check Duplo status
      const statusResponse = await request(app.server)
        .get(`/api/invoices/${invoice.id}/status`)
        .expect(200);

      expect(statusResponse.body.status).toBe('stamped');
      expect(statusResponse.body.nrsReference).toBe(mockDuploStatusResponse.irn);

      // Step 4: Initialize Remita payment
      const paymentResponse = await request(app.server)
        .post(`/api/invoices/${invoice.id}/pay`)
        .send(paymentData)
        .expect(201);

      expect(paymentResponse.body.rrr).toBe(mockRemitaInitResponse.rrr);
      expect(paymentResponse.body.status).toBe('pending');

      // Step 5: Check payment status
      const paymentStatusResponse = await request(app.server)
        .get(`/api/payments/${mockRemitaInitResponse.rrr}/status`)
        .expect(200);

      expect(paymentStatusResponse.body.status).toBe('successful');
      expect(paymentStatusResponse.body.amount).toBe(paymentData.amount);

      // Step 6: Verify final invoice status
      const finalInvoiceResponse = await request(app.server)
        .get(`/api/invoices/${invoice.id}`)
        .expect(200);

      expect(finalInvoiceResponse.body.status).toBe('paid');
      expect(finalInvoiceResponse.body.paymentReference).toBe(mockRemitaInitResponse.rrr);

      // Verify API calls were made correctly
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // Duplo token, Duplo submit, Remita init
      expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Duplo status, Remita status
    });

    test('handles workflow failure at Duplo submission stage', async () => {
      const invoiceData = createMockInvoiceData();

      // Mock Duplo authentication
      mockedAxios.post.mockResolvedValue({
        data: mockDuploTokenResponse,
        status: 200
      });

      // Mock Duplo submission failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid XML format'));

      // Step 1: Create invoice
      const createResponse = await request(app.server)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      const invoice = createResponse.body;

      // Step 2: Attempt submission (should fail)
      const submitResponse = await request(app.server)
        .post(`/api/invoices/${invoice.id}/submit`)
        .expect(500);

      expect(submitResponse.body.error).toContain('E-invoice submission failed');

      // Verify invoice status remains draft
      const statusResponse = await request(app.server)
        .get(`/api/invoices/${invoice.id}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('draft');
    });

    test('handles payment failure after successful Duplo submission', async () => {
      const invoiceData = createMockInvoiceData();
      const paymentData = createMockPaymentData();

      // Mock Duplo authentication and submission
      mockedAxios.post
        .mockResolvedValueOnce({ data: mockDuploTokenResponse, status: 200 })
        .mockResolvedValueOnce({ data: mockDuploSubmitResponse, status: 200 });

      // Mock Duplo status
      mockedAxios.get.mockResolvedValueOnce({
        data: mockDuploStatusResponse,
        status: 200
      });

      // Mock Remita payment failure
      mockedAxios.post.mockRejectedValueOnce(new Error('Payment gateway unavailable'));

      // Step 1: Create and submit invoice
      const createResponse = await request(app.server)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      const invoice = createResponse.body;

      await request(app.server)
        .post(`/api/invoices/${invoice.id}/submit`)
        .expect(200);

      // Step 2: Attempt payment (should fail)
      const paymentResponse = await request(app.server)
        .post(`/api/invoices/${invoice.id}/pay`)
        .send(paymentData)
        .expect(500);

      expect(paymentResponse.body.error).toContain('Payment initialization failed');

      // Verify invoice status remains stamped (not paid)
      const statusResponse = await request(app.server)
        .get(`/api/invoices/${invoice.id}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('stamped');
    });
  });

  describe('Invoice Status Tracking Workflow', () => {
    test('tracks invoice through all status transitions', async () => {
      const invoiceData = createMockInvoiceData();

      // Mock Duplo authentication
      mockedAxios.post.mockResolvedValue({
        data: mockDuploTokenResponse,
        status: 200
      });

      // Create invoice
      const createResponse = await request(app.server)
        .post('/api/invoices')
        .send(invoiceData)
        .expect(201);

      const invoice = createResponse.body;
      expect(invoice.status).toBe('draft');

      // Check initial status
      const initialStatus = await request(app.server)
        .get(`/api/invoices/${invoice.id}/status`)
        .expect(200);

      expect(initialStatus.body.status).toBe('draft');

      // Mock Duplo submission
      mockedAxios.post.mockResolvedValueOnce({
        data: mockDuploSubmitResponse,
        status: 200
      });

      // Submit to Duplo
      await request(app.server)
        .post(`/api/invoices/${invoice.id}/submit`)
        .expect(200);

      // Check submitted status
      const submittedStatus = await request(app.server)
        .get(`/api/invoices/${invoice.id}/status`)
        .expect(200);

      expect(submittedStatus.body.status).toBe('submitted');

      // Mock pending status
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          irn: mockDuploSubmitResponse.irn,
          status: 'pending',
          timestamp: '2026-01-15T10:00:00Z'
        },
        status: 200
      });

      // Check pending status
      const pendingStatus = await request(app.server)
        .get(`/api/invoices/${invoice.id}/status`)
        .expect(200);

      expect(pendingStatus.body.status).toBe('pending');

      // Mock stamped status
      mockedAxios.get.mockResolvedValueOnce({
        data: mockDuploStatusResponse,
        status: 200
      });

      // Check stamped status
      const stampedStatus = await request(app.server)
        .get(`/api/invoices/${invoice.id}/status`)
        .expect(200);

      expect(stampedStatus.body.status).toBe('stamped');
      expect(stampedStatus.body.nrsReference).toBe(mockDuploStatusResponse.irn);
    });
  });

  describe('Payment Status Tracking Workflow', () => {
    test('tracks payment through status transitions', async () => {
      const paymentData = createMockPaymentData();

      // Mock Remita payment initialization
      mockedAxios.post.mockResolvedValueOnce({
        data: mockRemitaInitResponse,
        status: 200
      });

      // Initialize payment
      const initResponse = await request(app.server)
        .post('/api/payments/initialize')
        .send(paymentData)
        .expect(201);

      expect(initResponse.body.rrr).toBe(mockRemitaInitResponse.rrr);
      expect(initResponse.body.status).toBe('pending');

      // Check initial payment status
      const initialStatus = await request(app.server)
        .get(`/api/payments/${mockRemitaInitResponse.rrr}/status`)
        .expect(200);

      expect(initialStatus.body.status).toBe('pending');

      // Mock processing status
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ...mockRemitaStatusResponse,
          status: 'processing',
          transactionDate: '2026-01-15T10:00:00Z'
        },
        status: 200
      });

      // Check processing status
      const processingStatus = await request(app.server)
        .get(`/api/payments/${mockRemitaInitResponse.rrr}/status`)
        .expect(200);

      expect(processingStatus.body.status).toBe('processing');

      // Mock successful status
      mockedAxios.get.mockResolvedValueOnce({
        data: mockRemitaStatusResponse,
        status: 200
      });

      // Check successful status
      const successStatus = await request(app.server)
        .get(`/api/payments/${mockRemitaInitResponse.rrr}/status`)
        .expect(200);

      expect(successStatus.body.status).toBe('successful');
      expect(successStatus.body.paymentDate).toBe(mockRemitaStatusResponse.paymentDate);
    });

    test('handles payment failure and retry scenarios', async () => {
      const paymentData = createMockPaymentData();

      // Mock Remita payment initialization
      mockedAxios.post.mockResolvedValueOnce({
        data: mockRemitaInitResponse,
        status: 200
      });

      // Initialize payment
      const initResponse = await request(app.server)
        .post('/api/payments/initialize')
        .send(paymentData)
        .expect(201);

      // Mock failed status
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          rrr: mockRemitaInitResponse.rrr,
          status: 'failed',
          amount: paymentData.amount,
          transactionDate: '2026-01-15T10:00:00Z',
          responseCode: '01',
          responseMessage: 'Insufficient funds'
        },
        status: 200
      });

      // Check failed status
      const failedStatus = await request(app.server)
        .get(`/api/payments/${mockRemitaInitResponse.rrr}/status`)
        .expect(200);

      expect(failedStatus.body.status).toBe('failed');
      expect(failedStatus.body.responseMessage).toBe('Insufficient funds');

      // Mock retry success
      mockedAxios.post.mockResolvedValueOnce({
        data: { ...mockRemitaInitResponse, rrr: 'RETRY-RRR-123' },
        status: 200
      });

      // Retry payment
      const retryResponse = await request(app.server)
        .post(`/api/payments/${mockRemitaInitResponse.rrr}/retry`)
        .expect(200);

      expect(retryResponse.body.rrr).toBe('RETRY-RRR-123');
    });
  });

  describe('Health Check and System Status', () => {
    test('system health check includes all external services', async () => {
      // Mock all external service health checks
      mockedAxios.post.mockResolvedValue({
        data: mockDuploTokenResponse,
        status: 200
      });

      mockedAxios.get
        .mockResolvedValueOnce({ data: { status: 'ok' }, status: 200 }) // Duplo health
        .mockResolvedValueOnce({ data: { status: 'ok' }, status: 200 }); // Remita health

      const healthResponse = await request(app.server)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services).toBeDefined();
      expect(healthResponse.body.services.duplo).toBeDefined();
      expect(healthResponse.body.services.remita).toBeDefined();
      expect(healthResponse.body.services.database).toBeDefined();
    });

    test('graceful degradation when external services are unavailable', async () => {
      // Mock service failures
      mockedAxios.post.mockRejectedValue(new Error('Service unavailable'));
      mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));

      const healthResponse = await request(app.server)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('degraded');
      expect(healthResponse.body.services.duplo.status).toBe('error');
      expect(healthResponse.body.services.remita.status).toBe('error');
    });
  });

  describe('Error Handling and Validation', () => {
    test('validates invoice data before processing', async () => {
      const invalidInvoice = {
        id: '', // Empty ID
        issueDate: 'invalid-date',
        supplierTIN: '', // Empty TIN
        supplierName: '',
        items: [], // Empty items
        subtotal: -100, // Negative amount
        vat: -10,
        total: -110
      };

      const response = await request(app.server)
        .post('/api/invoices')
        .send(invalidInvoice)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.validationErrors).toBeDefined();
    });

    test('validates payment data before processing', async () => {
      const invalidPayment = {
        merchantId: '',
        serviceTypeId: '',
        orderId: '',
        amount: -100, // Negative amount
        payerName: '',
        payerEmail: 'invalid-email',
        payerPhone: ''
      };

      const response = await request(app.server)
        .post('/api/payments/initialize')
        .send(invalidPayment)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.validationErrors).toBeDefined();
    });

    test('handles concurrent requests gracefully', async () => {
      const invoiceData = createMockInvoiceData();

      // Mock successful operations
      mockedAxios.post.mockResolvedValue({
        data: mockDuploTokenResponse,
        status: 200
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: mockDuploSubmitResponse,
        status: 200
      });

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        request(app.server)
          .post('/api/invoices')
          .send(invoiceData)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      // Verify all invoices have unique IDs
      const ids = responses.map(r => r.body.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
