/**
 * Payment Gateway Unit Tests
 *
 * Tests the PaymentGatewayManager, Paystack adapter, and Flutterwave adapter
 * in mock mode (no real API calls).
 */

import { PaystackAdapter, paystackAdapter } from '../integrations/paystack/adapter';
import { FlutterwaveAdapter, flutterwaveAdapter } from '../integrations/flutterwave/adapter';
import { paymentGateway } from '../services/payment-gateway';
import { paystackBreaker } from '../services/circuit-breaker';

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
    it('verifies a legacy signature over the exact raw request body', () => {
      const crypto = require('crypto');
      const payload = Buffer.from('{"event":"charge.success","data":{"amount":2500.00}}');
      const expectedHash = crypto.createHmac('sha512', 'sk_test_mock').update(payload).digest('hex');

      expect(adapter.verifyWebhookSignature(payload, expectedHash)).toBe(true);
      expect(adapter.verifyWebhookSignature(Buffer.from(payload.toString() + ' '), expectedHash)).toBe(false);
    });

    it('verifies timestamped signatures during signing-secret rotation', () => {
      const crypto = require('crypto');
      const payload = Buffer.from('{"event":"charge.success"}');
      const now = 1_700_000_000;
      const expectedHash = crypto.createHmac('sha512', 'whsec_mock')
        .update(Buffer.concat([Buffer.from(String(now) + '.'), payload])).digest('hex');
      const header = `t=${now},v1=whk_old:0000,v1=whk_current:${expectedHash}`;

      expect(adapter.verifyWebhookSignature(payload, header, now)).toBe(true);
    });

    it('rejects timestamped signatures outside the 300-second replay window', () => {
      const crypto = require('crypto');
      const payload = Buffer.from('{"event":"charge.success"}');
      const timestamp = 1_700_000_000;
      const expectedHash = crypto.createHmac('sha512', 'whsec_mock')
        .update(Buffer.concat([Buffer.from(String(timestamp) + '.'), payload])).digest('hex');
      const header = `t=${timestamp},v1=whk_current:${expectedHash}`;

      expect(adapter.verifyWebhookSignature(payload, header, timestamp + 301)).toBe(false);
    });

    it('rejects malformed and invalid signatures', () => {
      expect(adapter.verifyWebhookSignature('payload', 'invalid_sig')).toBe(false);
      expect(adapter.verifyWebhookSignature('payload', '')).toBe(false);
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


describe('PaymentGatewayManager ambiguous initialization outcomes', () => {
  it('does not initialize a second gateway after the first provider call throws', async () => {
    const originalPaystackKey = process.env.PAYSTACK_SECRET_KEY;
    const originalFlutterwaveKey = process.env.FLW_SECRET_KEY;

    process.env.PAYSTACK_SECRET_KEY = 'test-paystack-key';
    process.env.FLW_SECRET_KEY = 'test-flutterwave-key';

    const breakerSpy = jest.spyOn(paystackBreaker, 'canAttempt').mockReturnValue(true);
    const paystackSpy = jest.spyOn(paystackAdapter, 'initializeTransaction')
      .mockRejectedValue(new Error('socket hang up after request submission'));
    const flutterwaveSpy = jest.spyOn(flutterwaveAdapter, 'initializePayment')
      .mockResolvedValue({
        success: true,
        reference: 'FLW-MUST-NOT-BE-CREATED',
        checkoutUrl: 'https://checkout.flutterwave.com/mock/should-not-run',
      });

    try {
      const result = await paymentGateway.initializePayment({
        invoiceId: '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55',
        amount: 25_000,
        payerName: 'Test Merchant',
        payerEmail: 'merchant@example.invalid',
        payerPhone: '+2348012345678',
        gateway: 'paystack',
      });

      expect(paystackSpy).toHaveBeenCalledTimes(1);
      expect(flutterwaveSpy).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        success: false,
        gateway: 'paystack',
        reference: '',
        paymentUrl: null,
        error: 'PAYMENT_INITIALIZATION_OUTCOME_UNKNOWN',
      });
    } finally {
      jest.restoreAllMocks();
      if (originalPaystackKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalPaystackKey;
      if (originalFlutterwaveKey === undefined) delete process.env.FLW_SECRET_KEY;
      else process.env.FLW_SECRET_KEY = originalFlutterwaveKey;
    }
  });
});
