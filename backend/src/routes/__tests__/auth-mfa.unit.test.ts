import Fastify, { FastifyInstance } from 'fastify';
import * as bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import authRoutes from '../v1/auth';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  orgMember: { findFirst: jest.fn() },
  userTotp: { findUnique: jest.fn() },
  $executeRaw: jest.fn(),
};
const mockRedis = {
  get: jest.fn(), set: jest.fn(), del: jest.fn(), incr: jest.fn(),
  expire: jest.fn(), eval: jest.fn(), multi: jest.fn(),
};
const mockAudit = jest.fn();
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../lib/redis', () => ({ redis: mockRedis }));
jest.mock('../../services/audit', () => ({ writeAuditEvent: mockAudit }));
jest.mock('../../services/session-revocation', () => ({ invalidateUserSessions: jest.fn() }));

describe('login-time TOTP challenge', () => {
  let app: FastifyInstance;
  let challengeAvailable: boolean;
  const usedTotpSteps = new Set<string>();
  const secret = 'JBSWY3DPEHPK3PXP';
  const user = {
    id: 'user-1', email: 'user@example.test', phone: '+2348012345678', name: 'Test User', role: 'owner',
    authVersion: 2, deleted: false, passwordHash: bcrypt.hashSync('Password123!', 4), createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const membership = { orgId: 'org-1', role: 'owner' };

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'taxbridge-test-signing-secret-which-is-long-enough';
    jest.clearAllMocks();
    challengeAvailable = false;
    usedTotpSteps.clear();
    const multi = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    mockRedis.multi.mockReturnValue(multi);
    mockRedis.set.mockImplementation(async (key: string) => {
      if (key.startsWith('mfa:challenge:') && !key.includes(':lock:')) challengeAvailable = true;
      if (key.startsWith('mfa:totp-used:')) {
        if (usedTotpSteps.has(key)) return null;
        usedTotpSteps.add(key);
      }
      return 'OK';
    });
    mockRedis.get.mockImplementation(async (key: string) => {
      if (/^mfa:challenge:[0-9a-f-]{36}$/i.test(key)) return challengeAvailable ? '1' : null;
      return null;
    });
    mockRedis.del.mockImplementation(async (...keys: string[]) => {
      if (keys.some((key) => /^mfa:challenge:[0-9a-f-]{36}$/i.test(key))) challengeAvailable = false;
      return keys.length;
    });
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.eval.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.orgMember.findFirst.mockResolvedValue(membership);
    mockPrisma.userTotp.findUnique.mockResolvedValue({ active: true, secret, backupCodes: [] });
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockAudit.mockResolvedValue(undefined);
    app = Fastify();
    await app.register(authRoutes, { prefix: '/api/v1/auth' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function beginLogin(identity: { email?: string; phone?: string } = { email: user.email }) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { ...identity, password: 'Password123!' },
    });
  }

  it('rejects missing or ambiguous login identifiers before querying users', async () => {
    const missing = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { password: 'Password123!' } });
    const ambiguous = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: user.email, phone: user.phone, password: 'Password123!' } });
    expect(missing.statusCode).toBe(400);
    expect(ambiguous.statusCode).toBe(400);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('supports the phone identifier used by the settings sign-in surface', async () => {
    const response = await beginLogin({ phone: user.phone });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({ mfaRequired: true, challengeToken: expect.any(String) }));
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: user.phone } });
  });

  it('issues only a five-minute MFA challenge when an active authenticator is configured', async () => {
    const response = await beginLogin();
    const body = response.json() as Record<string, unknown>;
    expect(response.statusCode).toBe(200);
    expect(body).toEqual(expect.objectContaining({ mfaRequired: true, challengeToken: expect.any(String), expiresIn: 300 }));
    expect(body).not.toHaveProperty('accessToken');
    expect(body).not.toHaveProperty('refreshToken');
    expect(mockRedis.multi).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_MFA_CHALLENGE_ISSUED' }));
  });

  it('issues session tokens only after a valid TOTP and rejects challenge replay', async () => {
    const login = await beginLogin();
    const { challengeToken } = login.json() as { challengeToken: string };
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
    const verified = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken, code },
    });
    const tokens = verified.json() as Record<string, unknown>;
    expect(verified.statusCode).toBe(200);
    expect(tokens).toEqual(expect.objectContaining({
      accessToken: expect.any(String), refreshToken: expect.any(String),
      user: expect.objectContaining({ id: user.id, email: user.email }),
    }));
    expect(mockRedis.multi).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN_SUCCESS', details: expect.objectContaining({ mfaVerified: true, method: 'totp' }),
    }));

    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken, code },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toEqual({ error: 'MFA_CHALLENGE_EXPIRED_OR_USED' });
    expect(mockRedis.multi).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a TOTP time-step across separately issued challenges', async () => {
    const firstLogin = await beginLogin();
    const firstChallenge = (firstLogin.json() as { challengeToken: string }).challengeToken;
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
    const firstVerification = await app.inject({
      method: 'POST', url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken: firstChallenge, code },
    });
    expect(firstVerification.statusCode).toBe(200);

    const secondLogin = await beginLogin();
    const secondChallenge = (secondLogin.json() as { challengeToken: string }).challengeToken;
    const replay = await app.inject({
      method: 'POST', url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken: secondChallenge, code },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json()).toEqual({ error: 'INVALID_MFA_CODE' });
    expect(mockRedis.multi).toHaveBeenCalledTimes(1);
  });

  it('consumes a backup code atomically before issuing a session', async () => {
    const backupCode = 'ABCD1234';
    const backupHash = await bcrypt.hash(backupCode, 4);
    mockPrisma.userTotp.findUnique.mockResolvedValue({ active: true, secret, backupCodes: [backupHash] });
    const login = await beginLogin();
    const { challengeToken } = login.json() as { challengeToken: string };
    const verified = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken, code: backupCode.toLowerCase() },
    });
    expect(verified.statusCode).toBe(200);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LOGIN_SUCCESS', details: expect.objectContaining({ method: 'backup_code' }),
    }));
  });

  it('counts invalid codes and never issues a session', async () => {
    const login = await beginLogin();
    const { challengeToken } = login.json() as { challengeToken: string };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { challengeToken, code: '000000' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'INVALID_MFA_CODE' });
    expect(mockRedis.incr).toHaveBeenCalledWith(expect.stringMatching(/^mfa:challenge-attempts:/));
    expect(mockRedis.multi).not.toHaveBeenCalled();
  });
});
