/**
 * Youverify Service Unit Tests
 *
 * Tests the YouverifyService in mock/sandbox mode (no real API calls).
 */

import { YouverifyService } from '../integrations/youverify/service';

describe('YouverifyService (mock mode)', () => {
  let service: YouverifyService;

  beforeAll(() => {
    service = new YouverifyService({
      apiKey: 'test_api_key',
      baseUrl: 'https://api.youverify.co',
      sandbox: true, // Forces mock mode
    });
  });

  // ===========================================================================
  // TIN Verification
  // ===========================================================================

  describe('verifyTIN', () => {
    it('should return verified result in mock mode', async () => {
      const result = await service.verifyTIN('12345678-0001');

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(95);
      expect(result.details.name).toBe('Mock Business Ltd');
      expect(result.details.status).toBe('active');
      expect(result.reference).toMatch(/^YV-TIN-MOCK-/);
    });

    it('should generate unique references', async () => {
      const r1 = await service.verifyTIN('11111111-0001');
      const r2 = await service.verifyTIN('22222222-0001');
      expect(r1.reference).not.toBe(r2.reference);
    });
  });

  // ===========================================================================
  // BVN Verification
  // ===========================================================================

  describe('verifyBVN', () => {
    it('should return verified result with provided name', async () => {
      const result = await service.verifyBVN('12345678901', 'Ade', 'Ogundimu');

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(98);
      expect(result.details.name).toBe('Ade Ogundimu');
      expect(result.details.status).toBe('active');
      expect(result.reference).toMatch(/^YV-BVN-MOCK-/);
    });

    it('should use default name when not provided', async () => {
      const result = await service.verifyBVN('12345678901', '', '');

      expect(result.verified).toBe(true);
      expect(result.details.name).toBe('John Doe');
    });
  });

  // ===========================================================================
  // CAC Verification
  // ===========================================================================

  describe('verifyCACNumber', () => {
    it('should return verified result with company details', async () => {
      const result = await service.verifyCACNumber('RC123456');

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.details.name).toBe('Mock Trading Company Ltd');
      expect(result.details.status).toBe('active');
      expect(result.details.extra).toBeDefined();
      expect(result.details.extra?.rcNumber).toBe('RC123456');
      expect(result.details.extra?.directors).toHaveLength(1);
      expect(result.reference).toMatch(/^YV-CAC-MOCK-/);
    });
  });

  // ===========================================================================
  // Composite Business Verification
  // ===========================================================================

  describe('verifyBusiness', () => {
    it('should verify all three (TIN + BVN + CAC) in parallel', async () => {
      const result = await service.verifyBusiness({
        tinVerification: true,
        bvnVerification: true,
        cacVerification: true,
        tin: '12345678-0001',
        bvn: '12345678901',
        cacNumber: 'RC123456',
        firstName: 'Ade',
        lastName: 'Ogundimu',
      });

      expect(result.overallStatus).toBe('VERIFIED');
      expect(result.verifications.tin).toBeDefined();
      expect(result.verifications.tin?.verified).toBe(true);
      expect(result.verifications.bvn).toBeDefined();
      expect(result.verifications.bvn?.verified).toBe(true);
      expect(result.verifications.cac).toBeDefined();
      expect(result.verifications.cac?.verified).toBe(true);
    });

    it('should verify only requested types', async () => {
      const result = await service.verifyBusiness({
        tinVerification: true,
        bvnVerification: false,
        cacVerification: false,
        tin: '12345678-0001',
      });

      expect(result.overallStatus).toBe('VERIFIED');
      expect(result.verifications.tin).toBeDefined();
      expect(result.verifications.bvn).toBeUndefined();
      expect(result.verifications.cac).toBeUndefined();
    });

    it('should return PENDING when no verifications requested', async () => {
      const result = await service.verifyBusiness({
        tinVerification: false,
        bvnVerification: false,
        cacVerification: false,
      });

      expect(result.overallStatus).toBe('PENDING');
      expect(Object.keys(result.verifications)).toHaveLength(0);
    });

    it('should skip verification when data is missing', async () => {
      const result = await service.verifyBusiness({
        tinVerification: true,
        bvnVerification: true,
        cacVerification: true,
        // No tin, bvn, or cacNumber provided
      });

      // All skipped because data is missing (tin/bvn/cacNumber are undefined)
      expect(result.overallStatus).toBe('PENDING');
    });
  });
});

// ===========================================================================
// Non-mock mode constructor
// ===========================================================================

describe('YouverifyService configuration', () => {
  it('should create service with custom config', () => {
    const service = new YouverifyService({
      apiKey: 'custom_key',
      baseUrl: 'https://custom.youverify.co',
      sandbox: false,
    });

    // Service should be created without errors
    expect(service).toBeDefined();
  });
});
