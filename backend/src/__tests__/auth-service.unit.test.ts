/**
 * TaxBridge Auth Service — Unit Tests
 *
 * Tests registration, login, MFA, token refresh, logout, password policies,
 * account lockout, and UBL signing.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock Prisma
const mockUser: Record<string, any> = {};
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};
jest.mock('../lib/prisma', () => ({
  prisma: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock SMS
const mockSendSMS = jest.fn().mockResolvedValue({ success: true });
jest.mock('../integrations/comms/client', () => ({
  sendSMS: (...args: any[]) => mockSendSMS(...args),
  healthCheckAllProviders: jest.fn(),
  getProviderHealth: jest.fn(),
}));

// Mock security
jest.mock('../lib/security', () => ({
  logSecurityEvent: jest.fn(),
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
  sanitizeInput: jest.fn((v: string) => v),
  validatePassword: jest.fn(),
  generateSecureToken: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  isIPBlocked: jest.fn().mockResolvedValue(false),
  blockIP: jest.fn(),
  securityMiddleware: jest.fn(),
  requireAdminApiKey: jest.fn(),
  SECURITY_CONFIG: {},
  RATE_LIMITS: {},
}));

import { AuthService } from '../services/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-test-jwt-secret-123456';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-test-refresh-secret-123456';

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    phone: '+2348012345678',
    name: 'Test User',
    passwordHash: bcrypt.hashSync('Password1!', 12),
    verified: true,
    verificationToken: null,
    verificationTokenExpiry: null,
    failedLoginAttempts: 0,
    mfaEnabled: false,
    mfaSecret: null,
    mfaTempSecret: null,
    ecdsaPrivateKey: null,
    updatedAt: new Date(),
    lastLoginAt: null,
    lastLoginDevice: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    auth = new AuthService();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register', () => {
    it('should register a new user and send OTP via SMS', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-new' });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await auth.register('+2348012345678', 'John Doe', 'Password1!');

      expect(result.userId).toBe('user-new');
      expect(result.verificationToken).toMatch(/^\d{6}$/);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockSendSMS).toHaveBeenCalledWith(
        '+2348012345678',
        expect.stringContaining('verification code')
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'user_register' }),
        })
      );
    });

    it('should reject invalid Nigerian phone numbers', async () => {
      await expect(auth.register('08012345678', 'Test', 'Password1!')).rejects.toThrow(
        /Invalid Nigerian phone number/
      );
      await expect(auth.register('+1234567890', 'Test', 'Password1!')).rejects.toThrow(
        /Invalid Nigerian phone number/
      );
      await expect(auth.register('+23480123456', 'Test', 'Password1!')).rejects.toThrow(
        /Invalid Nigerian phone number/
      );
    });

    it('should reject weak passwords', async () => {
      // Too short
      await expect(auth.register('+2348012345678', 'Test', 'Ab1')).rejects.toThrow(
        /Password must be/
      );
      // No uppercase (regex requires (?=.*[A-Z]))
      await expect(auth.register('+2348012345678', 'Test', 'alllowercase1')).rejects.toThrow(
        /Password must be/
      );
      // No digit (regex requires (?=.*\d))
      await expect(auth.register('+2348012345678', 'Test', 'NoDigitsHere')).rejects.toThrow(
        /Password must be/
      );
    });

    it('should reject duplicate phone numbers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(
        auth.register('+2348012345678', 'Test', 'Password1!')
      ).rejects.toThrow(/already registered/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phone Verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyPhone', () => {
    it('should verify phone and return tokens', async () => {
      const user = makeUser({
        verified: false,
        verificationToken: '123456',
        verificationTokenExpiry: new Date(Date.now() + 600_000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, verified: true });

      const tokens = await auth.verifyPhone('user-1', '123456');

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      // Verify the access token is valid JWT
      const decoded = jwt.verify(tokens.accessToken, JWT_SECRET) as any;
      expect(decoded.userId).toBe('user-1');
      expect(decoded.type).toBe('access');
    });

    it('should reject invalid OTP', async () => {
      const user = makeUser({
        verified: false,
        verificationToken: '123456',
        verificationTokenExpiry: new Date(Date.now() + 600_000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await expect(auth.verifyPhone('user-1', '999999')).rejects.toThrow(
        /Invalid verification code/
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: { increment: 1 } }),
        })
      );
    });

    it('should reject expired OTP', async () => {
      const user = makeUser({
        verified: false,
        verificationToken: '123456',
        verificationTokenExpiry: new Date(Date.now() - 1000), // expired
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(auth.verifyPhone('user-1', '123456')).rejects.toThrow(/expired/);
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(auth.verifyPhone('nonexistent', '123456')).rejects.toThrow(
        /Invalid verification request/
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Login
  // ═══════════════════════════════════════════════════════════════════════════

  describe('login', () => {
    it('should login with valid credentials and return tokens', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const tokens = await auth.login('+2348012345678', 'Password1!');

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });

    it('should reject invalid password', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      await expect(auth.login('+2348012345678', 'WrongPassword1!')).rejects.toThrow(
        /Invalid credentials/
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: { increment: 1 } }),
        })
      );
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(auth.login('+2348099999999', 'Password1!')).rejects.toThrow(
        /Invalid credentials/
      );
    });

    it('should reject unverified user', async () => {
      const user = makeUser({ verified: false });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(auth.login('+2348012345678', 'Password1!')).rejects.toThrow(
        /not verified/
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const user = makeUser({
        failedLoginAttempts: 5,
        updatedAt: new Date(), // recently locked
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(auth.login('+2348012345678', 'Password1!')).rejects.toThrow(
        /temporarily locked/
      );
    });

    it('should unlock account after 30 minutes', async () => {
      const user = makeUser({
        failedLoginAttempts: 5,
        updatedAt: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
      });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const tokens = await auth.login('+2348012345678', 'Password1!');
      expect(tokens.accessToken).toBeTruthy();
    });

    it('should return MFA temp token when MFA is enabled', async () => {
      const user = makeUser({ mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const tokens = await auth.login('+2348012345678', 'Password1!');

      expect(tokens.refreshToken).toBe('');
      const decoded = jwt.verify(tokens.accessToken, JWT_SECRET) as any;
      expect(decoded.requiresMfa).toBe(true);
    });

    it('should store deviceId on successful login', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);
      mockPrisma.auditLog.create.mockResolvedValue({});

      await auth.login('+2348012345678', 'Password1!', 'device-abc');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastLoginDevice: 'device-abc' }),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MFA
  // ═══════════════════════════════════════════════════════════════════════════

  describe('MFA', () => {
    it('setupMFA should generate secret and QR code', async () => {
      const user = makeUser();
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const result = await auth.setupMFA('user-1');

      expect(result.secret).toBeTruthy();
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mfaTempSecret: result.secret }),
        })
      );
    });

    it('setupMFA should throw for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(auth.setupMFA('nonexistent')).rejects.toThrow(/User not found/);
    });

    it('verifyAndEnableMFA should enable MFA with valid TOTP', async () => {
      const secret = speakeasy.generateSecret();
      const user = makeUser({ mfaTempSecret: secret.base32 });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const validToken = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const result = await auth.verifyAndEnableMFA('user-1', validToken);
      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mfaEnabled: true,
            mfaSecret: secret.base32,
            mfaTempSecret: null,
          }),
        })
      );
    });

    it('verifyAndEnableMFA should reject invalid TOTP', async () => {
      const user = makeUser({ mfaTempSecret: 'JBSWY3DPEHPK3PXP' });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(auth.verifyAndEnableMFA('user-1', '000000')).rejects.toThrow(
        /Invalid MFA code/
      );
    });

    it('verifyAndEnableMFA should throw if MFA not initiated', async () => {
      const user = makeUser({ mfaTempSecret: null });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(auth.verifyAndEnableMFA('user-1', '123456')).rejects.toThrow(
        /MFA setup not initiated/
      );
    });

    it('verifyMFALogin should complete login with valid TOTP', async () => {
      const secret = speakeasy.generateSecret();
      const user = makeUser({ mfaEnabled: true, mfaSecret: secret.base32 });

      // Create a temp token
      const tempToken = jwt.sign({ userId: 'user-1', requiresMfa: true }, JWT_SECRET, {
        expiresIn: '5m',
      });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const validToken = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const tokens = await auth.verifyMFALogin(tempToken, validToken);
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
    });

    it('verifyMFALogin should reject invalid temp token', async () => {
      const normalToken = jwt.sign({ userId: 'user-1' }, JWT_SECRET, { expiresIn: '5m' });

      await expect(auth.verifyMFALogin(normalToken, '123456')).rejects.toThrow(
        /Invalid MFA token/
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Token Refresh
  // ═══════════════════════════════════════════════════════════════════════════

  describe('refreshAccessToken', () => {
    it('should return a new access token for valid refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: 'user-1', type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      const result = await auth.refreshAccessToken(refreshToken);

      expect(result.accessToken).toBeTruthy();
      const decoded = jwt.verify(result.accessToken, JWT_SECRET) as any;
      expect(decoded.userId).toBe('user-1');
      expect(decoded.type).toBe('access');
    });

    it('should reject expired refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: 'user-1', type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: '0s' }
      );

      // Small delay to ensure expiry
      await new Promise((r) => setTimeout(r, 100));

      await expect(auth.refreshAccessToken(refreshToken)).rejects.toThrow();
    });

    it('should reject blacklisted refresh token', async () => {
      const refreshToken = jwt.sign(
        { userId: 'user-1', type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Blacklist the token via Redis mock
      const { getRedisConnection } = require('../queue/client');
      const redis = getRedisConnection();
      await redis.setex(`token:blacklist:${refreshToken}`, 3600, '1');

      await expect(auth.refreshAccessToken(refreshToken)).rejects.toThrow(/expired/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Logout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('logout', () => {
    it('should blacklist the token', async () => {
      const token = jwt.sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);

      await auth.logout(token);

      const { getRedisConnection } = require('../queue/client');
      const redis = getRedisConnection();
      const blacklisted = await redis.get(`token:blacklist:${token}`);
      expect(blacklisted).toBe('1');
    });

    it('should handle undefined token gracefully', async () => {
      await expect(auth.logout(undefined)).resolves.toBeUndefined();
    });

    it('should handle token without exp gracefully', async () => {
      const token = jwt.sign({ userId: 'user-1' }, JWT_SECRET);
      // Token without explicit exp in payload (jwt.decode returns null exp)
      await expect(auth.logout(token)).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Token Expiry Parsing
  // ═══════════════════════════════════════════════════════════════════════════

  describe('parseExpiry (via constructor)', () => {
    it('should use default values when env vars are not set', () => {
      const original = { ...process.env };
      delete process.env.ACCESS_TOKEN_EXPIRY;
      delete process.env.REFRESH_TOKEN_EXPIRY;

      const service = new AuthService();
      // Access private fields via token generation
      const tokens = (service as any).generateTokens('test-user');
      const decoded = jwt.decode(tokens.accessToken) as any;
      // Default is 900s (15 minutes)
      expect(decoded.exp - decoded.iat).toBe(900);

      Object.assign(process.env, original);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Store API Keys
  // ═══════════════════════════════════════════════════════════════════════════

  describe('storeApiKeys', () => {
    it('should update user with API keys', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await auth.storeApiKeys('user-1', 'duplo-id', 'duplo-secret', 'remita-id', 'remita-key');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          duploClientId: 'duplo-id',
          duploClientSecret: 'duplo-secret',
          remitaMerchantId: 'remita-id',
          remitaApiKey: 'remita-key',
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UBL Signing
  // ═══════════════════════════════════════════════════════════════════════════

  describe('signUBL', () => {
    it('should sign UBL XML with existing key', async () => {
      const { privateKey } = require('crypto').generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const pemKey = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const user = makeUser({ ecdsaPrivateKey: pemKey });
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const xml = '<Invoice><cbc:ID>INV-001</cbc:ID></Invoice>';
      const signed = await auth.signUBL(xml, 'user-1');

      expect(signed).toContain('<cbc:UBLDocumentSignatures>');
      expect(signed).toContain('</cbc:UBLDocumentSignatures></Invoice>');
    });

    it('should generate key if user has none', async () => {
      const user = makeUser({ ecdsaPrivateKey: null });
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(user);

      const xml = '<Invoice><cbc:ID>INV-001</cbc:ID></Invoice>';
      const signed = await auth.signUBL(xml, 'user-1');

      expect(signed).toContain('<cbc:UBLDocumentSignatures>');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ecdsaPrivateKey: expect.stringContaining('BEGIN PRIVATE KEY'),
          }),
        })
      );
    });

    it('should throw for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(auth.signUBL('<Invoice/>', 'nonexistent')).rejects.toThrow(
        /User not found/
      );
    });
  });
});
