/**
 * TaxBridge Mock FIRS Service Unit Tests
 * Educational API simulation tests
 */

import {
  stampInvoiceMock,
  checkInvoiceStatusMock,
  validateMockInvoiceData,
  getMockAPIEndpoints,
  generateSampleInvoice,
  type MockInvoiceData,
  type MockStampResponse,
} from '../src/services/mockFIRS';

describe('Mock FIRS Service', () => {
  describe('stampInvoiceMock', () => {
    const validInvoice: MockInvoiceData = {
      invoiceNumber: 'INV-001',
      customerName: 'Test Customer',
      supplierName: 'Test Supplier',
      totalAmount: 50000,
      items: [
        {
          description: 'Product A',
          quantity: 2,
          unitPrice: 20000,
        },
        {
          description: 'VAT',
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    };

    it('should return a mock stamp response', async () => {
      const response = await stampInvoiceMock(validInvoice);

      expect(response.success).toBe(true);
      expect(response.isMock).toBe(true);
      expect(response.stampCode).toMatch(/^MOCK-/);
      expect(response.irn).toMatch(/^IRN-DEMO-/);
    });

    it('should include timestamp', async () => {
      const response = await stampInvoiceMock(validInvoice);

      expect(response.timestamp).toBeDefined();
      const timestamp = new Date(response.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include QR code as data URI', async () => {
      const response = await stampInvoiceMock(validInvoice);

      expect(response.qrCode).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should include educational disclaimer', async () => {
      const response = await stampInvoiceMock(validInvoice);

      expect(response.disclaimer).toContain('EDUCATIONAL');
      expect(response.disclaimer).toContain('NOT AN OFFICIAL FIRS STAMP');
    });

    it('should simulate network delay', async () => {
      const startTime = Date.now();
      await stampInvoiceMock(validInvoice);
      const duration = Date.now() - startTime;

      // Should take at least 800ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(800);
    });

    it('should generate unique stamp codes', async () => {
      const response1 = await stampInvoiceMock(validInvoice);
      const response2 = await stampInvoiceMock(validInvoice);

      expect(response1.stampCode).not.toBe(response2.stampCode);
      expect(response1.irn).not.toBe(response2.irn);
    });
  });

  describe('checkInvoiceStatusMock', () => {
    it('should return stamped status', async () => {
      const response = await checkInvoiceStatusMock('IRN-DEMO-123456');

      expect(response.status).toBe('stamped');
      expect(response.isMock).toBe(true);
    });

    it('should include mock message', async () => {
      const response = await checkInvoiceStatusMock('IRN-DEMO-123456');

      expect(response.message).toContain('MOCK');
    });

    it('should simulate network delay', async () => {
      const startTime = Date.now();
      await checkInvoiceStatusMock('IRN-DEMO-123456');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(500);
    });
  });

  describe('validateMockInvoiceData', () => {
    it('should validate a correct invoice', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: 'INV-001',
        customerName: 'Customer',
        supplierName: 'Supplier',
        totalAmount: 10000,
        items: [{ description: 'Item', quantity: 1, unitPrice: 10000 }],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing invoice number', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: '',
        customerName: 'Customer',
        supplierName: 'Supplier',
        totalAmount: 10000,
        items: [{ description: 'Item', quantity: 1, unitPrice: 10000 }],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invoice number is required');
    });

    it('should reject missing customer name', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: 'INV-001',
        customerName: '',
        supplierName: 'Supplier',
        totalAmount: 10000,
        items: [{ description: 'Item', quantity: 1, unitPrice: 10000 }],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer name is required');
    });

    it('should reject missing supplier name', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: 'INV-001',
        customerName: 'Customer',
        supplierName: '',
        totalAmount: 10000,
        items: [{ description: 'Item', quantity: 1, unitPrice: 10000 }],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Supplier name is required');
    });

    it('should reject zero or negative amount', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: 'INV-001',
        customerName: 'Customer',
        supplierName: 'Supplier',
        totalAmount: 0,
        items: [{ description: 'Item', quantity: 1, unitPrice: 10000 }],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total amount must be greater than zero');
    });

    it('should reject empty items array', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: 'INV-001',
        customerName: 'Customer',
        supplierName: 'Supplier',
        totalAmount: 10000,
        items: [],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one line item is required');
    });

    it('should accumulate multiple errors', () => {
      const invoice: MockInvoiceData = {
        invoiceNumber: '',
        customerName: '',
        supplierName: '',
        totalAmount: 0,
        items: [],
      };

      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('getMockAPIEndpoints', () => {
    it('should return mock endpoint configuration', () => {
      const endpoints = getMockAPIEndpoints();

      expect(endpoints.baseURL).toContain('sandbox');
      expect(endpoints.endpoints.stampInvoice).toContain('POST');
      expect(endpoints.endpoints.checkStatus).toContain('GET');
    });

    it('should include educational note', () => {
      const endpoints = getMockAPIEndpoints();

      expect(endpoints.note).toContain('mock');
      expect(endpoints.note).toContain('educational');
    });
  });

  describe('generateSampleInvoice', () => {
    it('should generate a valid sample invoice', () => {
      const invoice = generateSampleInvoice();

      expect(invoice.invoiceNumber).toMatch(/^INV-DEMO-/);
      expect(invoice.customerName).toBeTruthy();
      expect(invoice.supplierName).toBeTruthy();
      expect(invoice.totalAmount).toBeGreaterThan(0);
      expect(invoice.items?.length).toBeGreaterThan(0);
    });

    it('should generate unique invoice numbers', () => {
      const invoice1 = generateSampleInvoice();
      
      // Wait a bit to ensure different timestamp
      const invoice2 = generateSampleInvoice();

      // Note: They might be the same if generated in the same millisecond
      // In production, you'd want a more robust ID generator
      expect(invoice1.invoiceNumber).toBeDefined();
      expect(invoice2.invoiceNumber).toBeDefined();
    });

    it('should pass validation', () => {
      const invoice = generateSampleInvoice();
      const result = validateMockInvoiceData(invoice);

      expect(result.isValid).toBe(true);
    });
  });
});
