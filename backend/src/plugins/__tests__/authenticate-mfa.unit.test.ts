import Fastify from 'fastify';
import { SignJWT } from 'jose';
import authenticatePlugin from '../authenticate';

const mockPrisma = { user: { findUnique: jest.fn() } };
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

describe('authenticate plugin challenge-token boundary', () => {
  it('rejects an MFA challenge token as an ordinary bearer token', async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'taxbridge-test-signing-secret-which-is-long-enough';
    jest.clearAllMocks();
    const token = await new SignJWT({
      sub: 'user-1', orgId: 'org-1', role: 'owner', role_version: 0,
      type: 'mfa_challenge', jti: 'b4e1e7a0-5c0f-4f15-9a42-bff75c0d1d50',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setIssuer('taxbridge-api')
      .setAudience('taxbridge-client')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const app = Fastify();
    await app.register(authenticatePlugin);
    app.get('/protected', { preHandler: [app.authenticate] }, async () => ({ ok: true }));
    await app.ready();
    const response = await app.inject({
      method: 'GET', url: '/protected', headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'INVALID_TOKEN_CLAIMS' });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    await app.close();
  });
});
