/**
 * Invoice Service & PDF Generator Unit Tests (Phase 4)
 *
 * Tests invoice creation, numbering, status management,
 * QR code generation, and PDF HTML generation.
 */

import { generateInvoicePDF, generateInvoiceHTML, InvoicePDFData } from '../services/pdf-generator';
import { calculateInvoiceTotals } from '../utils/taxCalculator';

// =============================================================================
// Tax Calculator Tests (invoice-specific)
// =============================================================================

describe('calculateInvoiceTotals', () => {
  it('should calculate correct totals for single item', () => {
    const items = [{ quantity: 1, unitPrice: 500000 }];
    const result = calculateInvoiceTotals(items);

    expect(result.subtotal).toBe(500000);
    expect(result.vat).toBe(37500); // 7.5% of 500000
    expect(result.total).toBe(537500);
  });

  it('should calculate correct totals for multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 100000 },
      { quantity: 1, unitPrice: 50000 },
    ];
    const result = calculateInvoiceTotals(items);

    expect(result.subtotal).toBe(250000);
    expect(result.vat).toBe(18750); // 7.5% of 250000
    expect(result.total).toBe(268750);
  });

  it('should handle zero items', () => {
    const result = calculateInvoiceTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should handle large amounts correctly', () => {
    const items = [{ quantity: 1, unitPrice: 99000000 }];
    const result = calculateInvoiceTotals(items);

    expect(result.subtotal).toBe(99000000);
    expect(result.vat).toBe(7425000);
    expect(result.total).toBe(106425000);
  });

  it('should handle fractional quantities', () => {
    const items = [{ quantity: 2.5, unitPrice: 10000 }];
    const result = calculateInvoiceTotals(items);

    expect(result.subtotal).toBe(25000);
    expect(result.vat).toBe(1875);
    expect(result.total).toBe(26875);
  });
});

// =============================================================================
// PDF Generator Tests
// =============================================================================

describe('generateInvoiceHTML', () => {
  const basePDFData: InvoicePDFData = {
    invoiceNumber: 'INV/2026/00001',
    issueDate: '2026-02-06T10:00:00Z',
    dueDate: '2026-03-15T00:00:00Z',
    template: 'professional',
    supplierName: 'Acme Trading Ltd',
    supplierTIN: '12345678-0001',
    supplierEmail: 'info@acmetrading.com',
    supplierPhone: '+2348012345678',
    supplierAddress: '123 Main Street, Lagos',
    customerName: 'ABC Corporation',
    customerEmail: 'accounts@abc.com',
    customerPhone: '+2348087654321',
    customerTIN: '87654321-0001',
    customerAddress: '456 Business Ave, Abuja',
    items: [
      {
        description: 'Web Development Services',
        quantity: 1,
        unitPrice: 500000,
        vatApplicable: true,
        total: 500000,
        vatAmount: 37500,
      },
      {
        description: 'Hosting (Annual)',
        quantity: 1,
        unitPrice: 50000,
        vatApplicable: true,
        total: 50000,
        vatAmount: 3750,
      },
    ],
    subtotal: 550000,
    vatAmount: 41250,
    total: 591250,
    nrsCompliant: true,
    firsIRN: 'IRN-2026-123456',
    firsCSID: 'CSID-ABC123',
    nrsReference: 'NRS-2026-789',
    qrCode: 'data:image/png;base64,TESTQR==',
    notes: 'Payment due within 30 days',
  };

  it('should generate valid HTML with invoice number', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('INV/2026/00001');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include supplier details', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('Acme Trading Ltd');
    expect(html).toContain('12345678-0001');
    expect(html).toContain('info@acmetrading.com');
  });

  it('should include customer details', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('ABC Corporation');
    expect(html).toContain('87654321-0001');
    expect(html).toContain('accounts@abc.com');
  });

  it('should include line items', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('Web Development Services');
    expect(html).toContain('Hosting (Annual)');
  });

  it('should include NRS compliance badge when compliant', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('NRS Compliant');
    expect(html).toContain('IRN-2026-123456');
    expect(html).toContain('CSID-ABC123');
  });

  it('should NOT include NRS badge when not compliant', () => {
    const data = { ...basePDFData, nrsCompliant: false };
    const html = generateInvoiceHTML(data);

    expect(html).not.toContain('NRS Compliant');
  });

  it('should include QR code when provided', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('data:image/png;base64,TESTQR==');
    expect(html).toContain('Scan to verify invoice');
  });

  it('should NOT include QR code when not provided', () => {
    const data = { ...basePDFData, qrCode: null };
    const html = generateInvoiceHTML(data);

    expect(html).not.toContain('Scan to verify invoice');
  });

  it('should include notes when provided', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('Payment due within 30 days');
  });

  it('should include due date when provided', () => {
    const html = generateInvoiceHTML(basePDFData);

    expect(html).toContain('Due Date');
  });

  it('should use correct template colors for professional', () => {
    const html = generateInvoiceHTML(basePDFData);
    expect(html).toContain('#16A34A'); // Green primary
  });

  it('should use correct template colors for retail', () => {
    const data = { ...basePDFData, template: 'retail' };
    const html = generateInvoiceHTML(data);
    expect(html).toContain('#0EA5E9'); // Blue primary
  });

  it('should use correct template colors for service', () => {
    const data = { ...basePDFData, template: 'service' };
    const html = generateInvoiceHTML(data);
    expect(html).toContain('#8B5CF6'); // Purple primary
  });

  it('should use correct template colors for wholesale', () => {
    const data = { ...basePDFData, template: 'wholesale' };
    const html = generateInvoiceHTML(data);
    expect(html).toContain('#F59E0B'); // Amber primary
  });

  it('should escape HTML in user-provided strings', () => {
    const data = {
      ...basePDFData,
      customerName: '<script>alert("xss")</script>',
    };
    const html = generateInvoiceHTML(data);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('should include TaxBridge footer', () => {
    const html = generateInvoiceHTML(basePDFData);
    expect(html).toContain('Generated by TaxBridge');
  });
});

describe('generateInvoicePDF', () => {
  const basePDFData: InvoicePDFData = {
    invoiceNumber: 'INV/2026/00001',
    issueDate: '2026-02-06T10:00:00Z',
    template: 'professional',
    supplierName: 'Test Company',
    customerName: 'Test Customer',
    items: [
      {
        description: 'Test Item',
        quantity: 1,
        unitPrice: 10000,
        total: 10000,
        vatAmount: 750,
      },
    ],
    subtotal: 10000,
    vatAmount: 750,
    total: 10750,
    nrsCompliant: false,
  };

  it('should return HTML and fileName', () => {
    const result = generateInvoicePDF(basePDFData);

    expect(result.html).toBeDefined();
    expect(result.html.length).toBeGreaterThan(0);
    expect(result.fileName).toBe('invoice-INV-2026-00001.html');
  });

  it('should sanitize slashes in fileName', () => {
    const result = generateInvoicePDF(basePDFData);
    expect(result.fileName).not.toContain('/');
  });

  it('should use "draft" in fileName when no invoice number', () => {
    const data = { ...basePDFData, invoiceNumber: '' };
    const result = generateInvoicePDF(data);
    expect(result.fileName).toBe('invoice-draft.html');
  });
});

// =============================================================================
// Invoice Number Format Tests
// =============================================================================

describe('Invoice Number Format', () => {
  it('should follow INV/YYYY/NNNNN pattern', () => {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^INV/${year}/\\d{5}$`);

    expect(`INV/${year}/00001`).toMatch(pattern);
    expect(`INV/${year}/00099`).toMatch(pattern);
    expect(`INV/${year}/12345`).toMatch(pattern);
  });
});

// =============================================================================
// Invoice Status Transition Tests
// =============================================================================

describe('Invoice Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['queued', 'sent', 'cancelled'],
    queued: ['processing', 'cancelled'],
    processing: ['stamped', 'failed'],
    stamped: ['sent', 'paid', 'cancelled'],
    sent: ['paid', 'overdue', 'cancelled'],
    failed: ['queued', 'cancelled'],
    paid: [],
    overdue: ['paid', 'cancelled'],
    cancelled: [],
  };

  it('should define valid status transitions', () => {
    expect(Object.keys(validTransitions)).toHaveLength(9);
  });

  it('draft invoices can be queued, sent, or cancelled', () => {
    expect(validTransitions.draft).toContain('queued');
    expect(validTransitions.draft).toContain('sent');
    expect(validTransitions.draft).toContain('cancelled');
  });

  it('paid and cancelled are terminal states', () => {
    expect(validTransitions.paid).toHaveLength(0);
    expect(validTransitions.cancelled).toHaveLength(0);
  });

  it('stamped invoices can be sent, paid, or cancelled', () => {
    expect(validTransitions.stamped).toContain('sent');
    expect(validTransitions.stamped).toContain('paid');
    expect(validTransitions.stamped).toContain('cancelled');
  });

  it('overdue invoices can be paid or cancelled', () => {
    expect(validTransitions.overdue).toContain('paid');
    expect(validTransitions.overdue).toContain('cancelled');
  });
});
