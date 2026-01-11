import { submitToDigiTax } from '../integrations/digitax/adapter';

describe('DigiTax adapter', () => {
  test('mockMode returns mock response', async () => {
    const res = await submitToDigiTax(
      { invoiceId: 'T1', ublXml: '<Invoice/>' },
      { apiUrl: 'https://sandbox.example', apiKey: 'k', hmacSecret: 's', mockMode: true }
    );

    expect(res).toHaveProperty('nrsReference');
    expect(res.nrsReference).toMatch(/NRS-MOCK/);
  });

  test('missing apiKey with mockMode false throws', async () => {
    await expect(
      submitToDigiTax({ invoiceId: 'T2', ublXml: '<Invoice/>' }, { apiUrl: 'https://x', apiKey: '', hmacSecret: undefined, mockMode: false })
    ).rejects.toThrow();
  });
});
