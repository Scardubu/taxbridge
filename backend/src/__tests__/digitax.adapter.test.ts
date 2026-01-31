import { submitToDigiTax } from '../integrations/digitax/adapter';
import { generateUBL } from '../lib/ubl/generator';

describe('DigiTax adapter', () => {
  const validUbl = generateUBL({
    id: 'INV-T1',
    issueDate: '2026-01-15',
    supplierTIN: '12345678-0001',
    supplierName: 'Test Supplier Ltd',
    customerTIN: '98765432-0002',
    customerName: 'Test Customer Ltd',
    items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
    subtotal: 100,
    vat: 7.5,
    total: 107.5
  });

  test('mockMode returns mock response', async () => {
    const res = await submitToDigiTax(
      { invoiceId: 'T1', ublXml: validUbl },
      { apiUrl: 'https://sandbox.example', apiKey: 'k', hmacSecret: 's', mockMode: true }
    );

    expect(res).toHaveProperty('nrsReference');
    expect(res.nrsReference).toMatch(/NRS-MOCK/);
  });

  test('missing apiKey with mockMode false throws', async () => {
    await expect(
      submitToDigiTax({ invoiceId: 'T2', ublXml: validUbl }, { apiUrl: 'https://x', apiKey: '', hmacSecret: undefined, mockMode: false })
    ).rejects.toThrow();
  });
});
