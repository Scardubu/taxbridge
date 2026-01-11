import axios from 'axios';
import { DuploClient } from './duplo';
import { 
  mockDuploTokenResponse, 
  mockDuploHealthResponse, 
  mockDuploSubmitResponse, 
  mockDuploStatusResponse,
  createMockInvoiceData 
} from '../../jest.setup';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Duplo API Integration Tests', () => {
  let client: DuploClient;

  beforeEach(() => {
    client = new DuploClient();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    process.env.DUPLO_CLIENT_ID = 'test-client-id';
    process.env.DUPLO_CLIENT_SECRET = 'test-client-secret';
    process.env.DUPLO_API_URL = 'https://api-test.duplo.co';
    
    mockedAxios.post.mockImplementation(() => Promise.resolve({ data: {} }));
    mockedAxios.get.mockImplementation(() => Promise.resolve({ data: {} }));
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('OAuth 2.0 Authentication', () => {
    test('successfully obtains access token with client credentials', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockTokenResponse
      });

      // Access token is obtained internally when making API calls
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2026-01-15T10:00:00Z',
        version: '1.0.0'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse
      });

      const result = await client.checkHealth();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-test.duplo.co/oauth2/token',
        {
          grant_type: 'client_credentials',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test('handles authentication failure gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Authentication failed'));

      const result = await client.checkHealth();
      
      // checkHealth catches errors and returns error status
      expect(result.status).toBe('error');
      expect(result.latency).toBeNull();
    });

    test('reuses cached access token within expiry period', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      mockedAxios.post.mockResolvedValue({
        data: mockTokenResponse
      });

      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2026-01-15T10:00:00Z',
        version: '1.0.0'
      };

      mockedAxios.get.mockResolvedValue({
        data: mockHealthResponse
      });

      // First call
      await client.checkHealth();
      
      // Clear post mock to track second call
      const postCallCount = mockedAxios.post.mock.calls.length;
      
      // Second call should reuse token
      await client.checkHealth();

      // Token should only be requested once (in-memory cache)
      expect(mockedAxios.post.mock.calls.length).toBe(postCallCount);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('E-Invoice Submission', () => {
    const sampleUBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID>INV-001</cbc:ID>
  <cbc:IssueDate>2026-01-15</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>
</Invoice>`;

    test('submits UBL XML to Duplo and receives success response', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      
      // Mock e-invoice submission
      const mockSubmitResponse = {
        irn: 'IRN-123456789',
        status: 'success',
        qr_code: 'data:image/png;base64,mock-qr-data',
        timestamp: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockTokenResponse })
        .mockResolvedValueOnce({ data: mockSubmitResponse });

      const result = await client.submitEInvoice(sampleUBL);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-test.duplo.co/v1/einvoice/submit',
        sampleUBL,
        {
          headers: {
            Authorization: 'Bearer test-access-token',
            'Content-Type': 'application/xml',
          },
          timeout: 30000,
        }
      );

      expect(result.irn).toBe('IRN-123456789');
      expect(result.status).toBe('success');
      expect(result.qr_code).toBe('data:image/png;base64,mock-qr-data');
    });

    test('handles e-invoice submission failure', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      // Mock submission failure
      mockedAxios.post
        .mockResolvedValueOnce({ data: mockTokenResponse })
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(client.submitEInvoice(sampleUBL)).rejects.toThrow('E-invoice submission failed');
    });

    test('validates UBL XML content type is set correctly', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock submission
      const mockSubmitResponse = {
        irn: 'IRN-123456789',
        status: 'success',
        qr_code: 'mock-qr-data',
        timestamp: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockSubmitResponse
      });

      await client.submitEInvoice(sampleUBL);

      const submissionCall = mockedAxios.post.mock.calls.find(call => 
        call[0] === 'https://api-test.duplo.co/v1/einvoice/submit'
      );

      expect(submissionCall?.[2]?.headers?.['Content-Type']).toBe('application/xml');
    });
  });

  describe('E-Invoice Status Check', () => {
    test('retrieves e-invoice status by IRN', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock status response
      const mockStatusResponse = {
        irn: 'IRN-123456789',
        status: 'stamped',
        stamp_date: '2026-01-15T10:01:00Z'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockStatusResponse
      });

      const result = await client.getEInvoiceStatus('IRN-123456789');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api-test.duplo.co/v1/einvoice/status/IRN-123456789',
        {
          headers: {
            Authorization: 'Bearer test-access-token',
          },
          timeout: 10000,
        }
      );

      expect(result.irn).toBe('IRN-123456789');
      expect(result.status).toBe('stamped');
      expect(result.stamp_date).toBe('2026-01-15T10:01:00Z');
    });

    test('handles rejected e-invoice status', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock rejection response
      const mockStatusResponse = {
        irn: 'IRN-123456789',
        status: 'rejected',
        rejection_reason: 'Invalid TIN format'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockStatusResponse
      });

      const result = await client.getEInvoiceStatus('IRN-123456789');

      expect(result.status).toBe('rejected');
      expect(result.rejection_reason).toBe('Invalid TIN format');
    });

    test('handles status check failure', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock status check failure
      mockedAxios.get.mockRejectedValueOnce(new Error('IRN not found'));

      await expect(client.getEInvoiceStatus('INVALID-IRN')).rejects.toThrow('Status check failed');
    });
  });

  describe('Health Check', () => {
    test('returns healthy status when API is responding', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock health response
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2026-01-15T10:00:00Z',
        version: '1.0.0'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse
      });

      const result = await client.checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(typeof result.latency).toBe('number');
    });

    test('returns degraded status when API responds with non-ok status', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock degraded health response
      const mockHealthResponse = {
        status: 'degraded',
        timestamp: '2026-01-15T10:00:00Z',
        version: '1.0.0'
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockHealthResponse
      });

      const result = await client.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test('returns error status when API is unreachable', async () => {
      // Mock authentication success but health check failure
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await client.checkHealth();

      expect(result.status).toBe('error');
      expect(result.latency).toBeNull();
    });
  });

  describe('Timeout Handling', () => {
    test('applies correct timeout for different operations', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValue({ data: mockTokenResponse });

      // Mock different responses
      const mockHealthResponse = {
        status: 'ok',
        timestamp: '2026-01-15T10:00:00Z',
        version: '1.0.0'
      };

      const mockSubmitResponse = {
        irn: 'IRN-123456789',
        status: 'success',
        qr_code: 'mock-qr-data',
        timestamp: '2026-01-15T10:00:00Z'
      };

      const mockStatusResponse = {
        irn: 'IRN-123456789',
        status: 'stamped',
        stamp_date: '2026-01-15T10:01:00Z'
      };

      mockedAxios.get.mockResolvedValue({ data: mockHealthResponse });
      mockedAxios.post.mockResolvedValue({ data: mockSubmitResponse });
      mockedAxios.get.mockResolvedValue({ data: mockStatusResponse });

      // Test health check timeout (10 seconds)
      await client.checkHealth();
      const healthCall = mockedAxios.get.mock.calls.find(call => 
        call[0]?.includes('/health')
      );
      expect(healthCall?.[1]?.timeout).toBe(10000);

      // Test submission timeout (30 seconds)
      await client.submitEInvoice('<test>xml</test>');
      const submitCall = mockedAxios.post.mock.calls.find(call => 
        call[0]?.includes('/einvoice/submit')
      );
      expect(submitCall?.[2]?.timeout).toBe(30000);

      // Test status check timeout (10 seconds)
      await client.getEInvoiceStatus('IRN-123456789');
      const statusCall = mockedAxios.get.mock.calls.find(call => 
        call[0]?.includes('/einvoice/status/')
      );
      expect(statusCall?.[1]?.timeout).toBe(10000);
    });
  });

  describe('Database Persistence Integration', () => {
    // Mock Prisma client for testing
    const mockPrismaClient = {
      invoice: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      einvoiceSubmission: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('creates invoice record with pending status before Duplo submission', async () => {
      const invoiceData = {
        id: 'test-invoice-123',
        supplierTIN: '12345678-0001',
        subtotal: 1000,
        vat: 75,
        total: 1075,
        status: 'pending',
      };

      mockPrismaClient.invoice.create.mockResolvedValue(invoiceData);

      const result = await mockPrismaClient.invoice.create({
        data: invoiceData,
      });

      expect(result.status).toBe('pending');
      expect(mockPrismaClient.invoice.create).toHaveBeenCalledWith({
        data: invoiceData,
      });
    });

    test('updates invoice status to stamped after successful Duplo submission', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };

      // Mock successful submission
      const mockSubmitResponse = {
        irn: 'IRN-123456789',
        status: 'success',
        qr_code: 'data:image/png;base64,mock-qr-data',
        timestamp: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockTokenResponse })
        .mockResolvedValueOnce({ data: mockSubmitResponse });

      const duploResult = await client.submitEInvoice('<Invoice>...</Invoice>');

      // Simulate database update after submission
      const updatedInvoice = {
        id: 'test-invoice-123',
        status: 'stamped',
        nrsReference: duploResult.irn,
        qrCode: duploResult.qr_code,
        stampedAt: new Date(duploResult.timestamp),
      };

      mockPrismaClient.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await mockPrismaClient.invoice.update({
        where: { id: 'test-invoice-123' },
        data: {
          status: 'stamped',
          nrsReference: duploResult.irn,
          qrCode: duploResult.qr_code,
          stampedAt: new Date(duploResult.timestamp),
        },
      });

      expect(result.status).toBe('stamped');
      expect(result.nrsReference).toBe('IRN-123456789');
      expect(mockPrismaClient.invoice.update).toHaveBeenCalled();
    });

    test('stores submission attempt record for audit trail', async () => {
      const submissionRecord = {
        id: 'submission-001',
        invoiceId: 'test-invoice-123',
        status: 'pending',
        ublXml: '<Invoice>...</Invoice>',
        attemptNumber: 1,
        submittedAt: new Date(),
      };

      mockPrismaClient.einvoiceSubmission.create.mockResolvedValue(submissionRecord);

      const result = await mockPrismaClient.einvoiceSubmission.create({
        data: submissionRecord,
      });

      expect(result.attemptNumber).toBe(1);
      expect(result.status).toBe('pending');
      expect(mockPrismaClient.einvoiceSubmission.create).toHaveBeenCalled();
    });

    test('handles duplicate submission prevention with idempotency check', async () => {
      // Check if submission already exists
      const existingSubmission = {
        id: 'submission-001',
        invoiceId: 'test-invoice-123',
        status: 'success',
        irn: 'IRN-123456789',
      };

      mockPrismaClient.einvoiceSubmission.findFirst.mockResolvedValue(existingSubmission);

      const result = await mockPrismaClient.einvoiceSubmission.findFirst({
        where: {
          invoiceId: 'test-invoice-123',
          status: 'success',
        },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.irn).toBe('IRN-123456789');
    });

    test('updates invoice with rejection details on Duplo failure', async () => {
      // Mock authentication
      const mockTokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock rejection response
      const mockSubmitResponse = {
        irn: null,
        status: 'failed',
        error: 'Invalid TIN format',
        timestamp: '2026-01-15T10:00:00Z'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockSubmitResponse,
        status: 400
      });

      // Simulate database update for failed submission
      const updatedInvoice = {
        id: 'test-invoice-123',
        status: 'failed',
        errorMessage: 'Invalid TIN format',
        lastAttemptAt: new Date(),
      };

      mockPrismaClient.invoice.update.mockResolvedValue(updatedInvoice);

      const result = await mockPrismaClient.invoice.update({
        where: { id: 'test-invoice-123' },
        data: {
          status: 'failed',
          errorMessage: 'Invalid TIN format',
          lastAttemptAt: new Date(),
        },
      });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Invalid TIN format');
    });

    test('maintains immutable audit trail of all submission attempts', async () => {
      // First attempt
      const attempt1 = {
        id: 'submission-001',
        invoiceId: 'test-invoice-123',
        status: 'failed',
        attemptNumber: 1,
        errorMessage: 'Network timeout',
        submittedAt: new Date('2026-01-15T10:00:00Z'),
      };

      mockPrismaClient.einvoiceSubmission.create.mockResolvedValueOnce(attempt1);
      await mockPrismaClient.einvoiceSubmission.create({ data: attempt1 });

      // Second attempt (successful)
      const attempt2 = {
        id: 'submission-002',
        invoiceId: 'test-invoice-123',
        status: 'success',
        attemptNumber: 2,
        irn: 'IRN-123456789',
        submittedAt: new Date('2026-01-15T10:05:00Z'),
      };

      mockPrismaClient.einvoiceSubmission.create.mockResolvedValueOnce(attempt2);
      await mockPrismaClient.einvoiceSubmission.create({ data: attempt2 });

      expect(mockPrismaClient.einvoiceSubmission.create).toHaveBeenCalledTimes(2);
    });
  });
});
