// Mock NRS/DigiTax Service for Educational Purposes Only
// Simulates DigiTax (Access Point Provider) e-invoicing API for onboarding demos.
// ALL RESPONSES ARE SIMULATED — NEVER USE IN PRODUCTION.
//
// C-02: This file uses NRS nomenclature throughout (the former agency is abolished).

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
 * Simulate NRS/DigiTax invoice stamping (EDUCATIONAL ONLY)
 */
export async function stampInvoiceMock(invoice: MockInvoiceData): Promise<MockStampResponse> {
  await delay(800);

  const stampCode = `MOCK-NRS-${Date.now()}-${randomSuffix(9)}`;
  const irn = `IRN-DEMO-${Date.now()}`;

  const qrCode = generateMockQRCode({ stampCode, irn, amount: invoice.totalAmount ?? 0, invoiceNumber: invoice.invoiceNumber });

  return {
    success: true,
    stampCode,
    irn,
    qrCode,
    timestamp: new Date().toISOString(),
    isMock: true,
    disclaimer: 'EDUCATIONAL SIMULATION ONLY — NOT AN OFFICIAL NRS/DIGITAX STAMP',
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
  void irn; // param present for API symmetry
  return { status: 'stamped', message: 'Invoice successfully stamped (MOCK)', isMock: true };
}

/** Deterministic alpha-numeric suffix — avoids raw Math.random in export paths */
function randomSuffix(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  // Use timestamp entropy combined with positional rotation (no Math.random needed)
  const seed = Date.now();
  for (let i = 0; i < len; i++) {
    result += chars[(seed + i * 17) % chars.length];
  }
  return result;
}

function generateMockQRCode(data: { stampCode: string; irn: string; amount: number; invoiceNumber: string }): string {
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
  const base64 = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(svg)))
    : svg; // fallback for environments without btoa
  return `data:image/svg+xml;base64,${base64}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateMockInvoiceData(invoice: MockInvoiceData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!invoice.invoiceNumber?.trim()) errors.push('Invoice number is required');
  if (!invoice.customerName?.trim()) errors.push('Customer name is required');
  if (!invoice.supplierName?.trim()) errors.push('Supplier name is required');
  if (!invoice.totalAmount || invoice.totalAmount <= 0) errors.push('Total amount must be greater than zero');
  if (!invoice.items?.length) errors.push('At least one line item is required');
  return { isValid: errors.length === 0, errors };
}

export function getMockAPIEndpoints() {
  return {
    baseURL: 'https://sandbox.nrs.gov.ng/nrs/api/v1',
    endpoints: {
      stampInvoice: 'POST /sandbox/nrs/stamp-invoice',
      checkStatus: 'GET /sandbox/nrs/status/:irn',
      getStampedInvoice: 'GET /sandbox/nrs/invoice/:irn',
    },
    note: 'Mock endpoints for educational purposes only',
  };
}

export function generateSampleInvoice(): MockInvoiceData {
  return {
    invoiceNumber: `INV-DEMO-${Date.now().toString().slice(-6)}`,
    customerName: 'Demo Customer Ltd',
    supplierName: 'Your Business Name',
    totalAmount: 25000,
    items: [
      { description: 'Sample Product', quantity: 2, unitPrice: 10000 },
      { description: 'VAT (7.5%)', quantity: 1, unitPrice: 5000 },
    ],
  };
}
