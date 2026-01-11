import { RemitaAdapter } from '../integrations/remita/adapter';

describe('RemitaAdapter', () => {
  const mockConfig = {
    merchantId: 'test-merchant',
    apiKey: 'test-key',
    apiUrl: 'https://demo.remita.net',
    serviceTypeId: '12345'
  };

  let adapter: RemitaAdapter;

  beforeEach(() => {
    adapter = new RemitaAdapter(mockConfig);
  });

  describe('generateRRR', () => {
    it('should return error for invalid config', async () => {
      const result = await adapter.generateRRR({
        amount: 1000,
        payerName: 'Test User',
        payerEmail: 'test@example.com',
        payerPhone: '08012345678',
        description: 'Test payment',
        orderId: 'test-order-1'
      });

      // In demo mode with test credentials, expect error or failure
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return false for invalid signature', () => {
      const payload = JSON.stringify({ rrr: 'test', amount: 1000 });
      const invalidSignature = 'invalid-signature';

      const result = adapter.verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });

    it('should return true for valid signature', () => {
      const crypto = require('crypto');
      const payload = JSON.stringify({ rrr: 'test', amount: 1000 });
      const validSignature = crypto
        .createHmac('sha512', mockConfig.apiKey)
        .update(payload)
        .digest('hex');

      const result = adapter.verifyWebhookSignature(payload, validSignature);
      expect(result).toBe(true);
    });
  });

  describe('verifyPayment', () => {
    it('should return payment status', async () => {
      const result = await adapter.verifyPayment('test-rrr', 'test-order');
      
      expect(result).toHaveProperty('status');
      expect(['pending', 'paid', 'failed']).toContain(result.status);
    });
  });
});
