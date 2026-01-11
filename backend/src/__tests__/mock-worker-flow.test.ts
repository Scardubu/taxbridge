import { generateUBL } from '../lib/ubl/generator';
import { submitToDigiTax } from '../integrations/digitax/adapter';

describe('mock worker flow', () => {
  test('generate UBL and submit in mock mode', async () => {
    const invoice = {
      id: 'SIMTEST1',
      issueDate: new Date().toISOString().slice(0, 10),
      supplierTIN: 'TESTTIN',
      supplierName: 'Test',
      customerName: 'Cust',
      items: [ { description: 'A', quantity: 1, unitPrice: 100 } ],
      subtotal: 100,
      vat: 0,
      total: 100
    } as any;

    const ubl = generateUBL(invoice);
    expect(typeof ubl).toBe('string');

    const res = await submitToDigiTax({ invoiceId: invoice.id, ublXml: ubl }, { apiUrl: 'https://x', apiKey: 'k', hmacSecret: 's', mockMode: true });
    expect(res.nrsReference).toMatch(/^NRS-MOCK/);
  });
});
