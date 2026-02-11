/**
 * Payment Gateway Unit Tests
 *
 * Tests the PaymentGatewayManager, Paystack adapter, and Flutterwave adapter
 * in mock mode (no real API calls).
 */

import { PaystackAdapter } from '../integrations/paystack/adapter';
import { FlutterwaveAdapter } from '../integrations/flutterwave/adapter';

// =============================================================================
// Paystack Adapter (Mock Mode)
// =============================================================================

describe('PaystackAdapter', () => {
  let adapter: PaystackAdapter;

  beforeAll(() => {
    process.env.PAYSTACK_MOCK_MODE = 'true';
    adapter = new PaystackAdapter({
      secretKey: 'sk_test_mock',
      publicKey: 'pk_test_mock',
      baseUrl: 'https://api.paystack.co',
      webhookSecret: 'whsec_mock',
    });
  });

  afterAll(() => {
    delete process.env.PAYSTACK_MOCK_MODE;
  });

  describe('generateReference', () => {
    it('should generate a unique reference starting with TB-', () => {
      const ref = adapter.generateReference('inv_123');
      expect(ref).toMatch(/^TB-\d+-[a-f0-9]+$/);
    });

    it('should generate different references each time', () => {
      const ref1 = adapter.generateReference('inv_123');
      const ref2 = adapter.generateReference('inv_123');
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('initializeTransaction (mock)', () => {
    it('should return success with mock authorization URL', async () => {
      const result = await adapter.initializeTransaction({
        amount: 50_000,
        email: 'test@example.com',
        invoiceId: 'inv_abc123',
      });

      expect(result.success).toBe(true);
      expect(result.reference).toBeTruthy();
      expect(result.authorizationUrl).toContain('checkout.paystack.com/mock/');
      expect(result.accessCode).toContain('mock_');
    });
  });

  describe('verifyTransaction (mock)', () => {
    it('should return pending in mock mode', async () => {
      const result = await adapter.verifyTransaction('TB-123-abc');
      expect(result.status).toBe('pending');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC-SHA512 signature', () => {
      const crypto = require('crypto');
      const payload = '{"event":"charge.success"}';
      const expectedHash = crypto
        .createHmac('sha512', 'sk_test_mock')
        .update(payload)
        .digest('hex');

      expect(adapter.verifyWebhookSignature(payload, expectedHash)).toBe(true);
    });

    it('should reject invalid signature', () => {
      expect(adapter.verifyWebhookSignature('payload', 'invalid_sig')).toBe(false);
    });
  });
});

// =============================================================================
// Flutterwave Adapter (Mock Mode)
// =============================================================================

describe('FlutterwaveAdapter', () => {
  let adapter: FlutterwaveAdapter;

  beforeAll(() => {
    process.env.FLW_MOCK_MODE = 'true';
    adapter = new FlutterwaveAdapter({
      publicKey: 'FLWPUBK_TEST-mock',
      secretKey: 'FLWSECK_TEST-mock',
      secretHash: 'my_secret_hash',
      baseUrl: 'https://api.flutterwave.com',
    });
  });

  afterAll(() => {
    delete process.env.FLW_MOCK_MODE;
  });

  describe('generateReference', () => {
    it('should generate a unique reference starting with TB-FLW-', () => {
      const ref = adapter.generateReference('inv_456');
      expect(ref).toMatch(/^TB-FLW-\d+-[a-f0-9]+$/);
    });

    it('should generate different references each time', () => {
      const ref1 = adapter.generateReference('inv_456');
      const ref2 = adapter.generateReference('inv_456');
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('initializePayment (mock)', () => {
    it('should return success with mock checkout URL', async () => {
      const result = await adapter.initializePayment({
        amount: 100_000,
        email: 'buyer@example.com',
        name: 'Test Buyer',
        invoiceId: 'inv_def789',
      });

      expect(result.success).toBe(true);
      expect(result.reference).toBeTruthy();
      expect(result.checkoutUrl).toContain('checkout.flutterwave.com/mock/');
    });
  });

  describe('verifyTransaction (mock)', () => {
    it('should return pending in mock mode', async () => {
      const result = await adapter.verifyTransaction('12345');
      expect(result.status).toBe('pending');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should accept matching secret hash', () => {
      expect(adapter.verifyWebhookSignature('my_secret_hash')).toBe(true);
    });

    it('should reject non-matching hash', () => {
      expect(adapter.verifyWebhookSignature('wrong_hash')).toBe(false);
    });

    it('should reject empty hash', () => {
      expect(adapter.verifyWebhookSignature('')).toBe(false);
    });
  });
});

// =============================================================================
// Cross-gateway consistency
// =============================================================================

describe('Gateway reference format consistency', () => {
  it('Paystack references should be distinguishable from Flutterwave', () => {
    process.env.PAYSTACK_MOCK_MODE = 'true';
    process.env.FLW_MOCK_MODE = 'true';

    const ps = new PaystackAdapter({
      secretKey: 'sk_test', publicKey: 'pk_test',
      baseUrl: 'https://api.paystack.co', webhookSecret: '',
    });
    const flw = new FlutterwaveAdapter({
      publicKey: 'pk', secretKey: 'sk', secretHash: 'h',
      baseUrl: 'https://api.flutterwave.com',
    });

    const psRef = ps.generateReference('inv_1');
    const flwRef = flw.generateReference('inv_1');

    // Paystack: TB-{ts}-{hex}, Flutterwave: TB-FLW-{ts}-{hex}
    expect(psRef).toMatch(/^TB-\d+/);
    expect(flwRef).toMatch(/^TB-FLW-\d+/);
    expect(psRef).not.toEqual(flwRef);

    delete process.env.PAYSTACK_MOCK_MODE;
    delete process.env.FLW_MOCK_MODE;
  });
});
