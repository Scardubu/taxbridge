// Mock FIRS API Service for Educational Purposes Only
// This service simulates NRS e-invoicing API calls for onboarding demonstrations
// ALL RESPONSES ARE SIMULATED - NEVER USE IN PRODUCTION

export interface MockInvoiceData {
  invoiceNumber: string;
  customerName?: string;
  supplierName?: string;
  totalAmount?: number;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface MockStampResponse {
  success: boolean;
  stampCode: string;
  irn: string;
  qrCode: string;
  timestamp: string;
  isMock: true;
  disclaimer: string;
}

/**
 * Simulate FIRS NRS invoice stamping (EDUCATIONAL ONLY)
 * @param invoice Invoice data to stamp
 * @returns Mocked stamp response with QR code
 */
export async function stampInvoiceMock(invoice: MockInvoiceData): Promise<MockStampResponse> {
  // Simulate network delay
  await delay(800);

  // Generate mock stamp code
  const stampCode = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const irn = `IRN-DEMO-${Date.now()}`;

  // Generate mock QR code (base64 data URI)
  const qrCode = generateMockQRCode({
    stampCode,
    irn,
    amount: invoice.totalAmount ?? 0,
    invoiceNumber: invoice.invoiceNumber,
  });

  return {
    success: true,
    stampCode,
    irn,
    qrCode,
    timestamp: new Date().toISOString(),
    isMock: true,
    disclaimer: 'THIS IS AN EDUCATIONAL SIMULATION ONLY - NOT AN OFFICIAL FIRS STAMP',
  };
}

/**
 * Simulate checking invoice status (EDUCATIONAL ONLY)
 */
export async function checkInvoiceStatusMock(irn: string): Promise<{
  status: 'stamped' | 'pending' | 'rejected';
  message: string;
  isMock: true;
}> {
  await delay(500);

  return {
    status: 'stamped',
    message: 'Invoice successfully stamped (MOCK)',
    isMock: true,
  };
}

/**
 * Generate a mock QR code as base64 data URI
 * In a real implementation, this would use a QR code library
 */
function generateMockQRCode(data: any): string {
  // This is a minimal SVG QR code placeholder
  // Real implementation should use a proper QR code generator
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="white"/>
      <text x="100" y="100" font-family="monospace" font-size="12" text-anchor="middle" fill="black">
        MOCK QR CODE
      </text>
      <text x="100" y="120" font-family="monospace" font-size="8" text-anchor="middle" fill="gray">
        ${data.stampCode.substring(0, 20)}
      </text>
      <text x="100" y="180" font-family="monospace" font-size="10" text-anchor="middle" fill="red">
        EDUCATIONAL DEMO
      </text>
    </svg>
  `;

  // Convert SVG to base64 data URI
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Utility to delay execution (simulates network latency)
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate mock invoice data
 */
export function validateMockInvoiceData(invoice: MockInvoiceData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!invoice.invoiceNumber || invoice.invoiceNumber.trim() === '') {
    errors.push('Invoice number is required');
  }

  if (!invoice.customerName || invoice.customerName.trim() === '') {
    errors.push('Customer name is required');
  }

  if (!invoice.supplierName || invoice.supplierName.trim() === '') {
    errors.push('Supplier name is required');
  }

  if (!invoice.totalAmount || invoice.totalAmount <= 0) {
    errors.push('Total amount must be greater than zero');
  }

  if (!invoice.items || invoice.items.length === 0) {
    errors.push('At least one line item is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get mock API endpoints (for educational display)
 */
export function getMockAPIEndpoints() {
  return {
    baseURL: 'https://sandbox.firs.gov.ng/nrs/api/v1',
    endpoints: {
      stampInvoice: 'POST /sandbox/nrs/stamp-invoice',
      checkStatus: 'GET /sandbox/nrs/status/:irn',
      getStampedInvoice: 'GET /sandbox/nrs/invoice/:irn',
    },
    note: 'These are mock endpoints for educational purposes only',
  };
}

/**
 * Generate sample invoice for demo
 */
export function generateSampleInvoice(): MockInvoiceData {
  return {
    invoiceNumber: `INV-DEMO-${Date.now().toString().slice(-6)}`,
    customerName: 'Demo Customer Ltd',
    supplierName: 'Your Business Name',
    totalAmount: 25000,
    items: [
      {
        description: 'Sample Product',
        quantity: 2,
        unitPrice: 10000,
      },
      {
        description: 'VAT (7.5%)',
        quantity: 1,
        unitPrice: 5000,
      },
    ],
  };
}
