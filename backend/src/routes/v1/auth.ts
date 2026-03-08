/**
 * Auth Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/auth'
 * Routes: POST /login | POST /refresh
 *
 * C-47: No Express imports.
 * C-26: request.log.* only — no console.log.
 */
import { FastifyPluginAsync }   from 'fastify';
import { z }                    from 'zod';
import * as bcrypt              from 'bcryptjs';
import { SignJWT, importPKCS8, importSPKI } from 'jose';
import { prisma }               from '../../lib/prisma';
import { redis }                from '../../lib/redis';
import { writeAuditEvent }      from '../../services/audit';
import { validate }             from '../../plugins/validate';

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  deviceId: z.string().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

async function signToken(
  payload:  Record<string, unknown>,
  secret:   string | Uint8Array,
  expiresIn: string,
): Promise<string> {
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn);

  if (typeof secret === 'string') {
    // RS256 — PKCS8 private key (base64 encoded)
    const key = await importPKCS8(
      Buffer.from(secret, 'base64').toString('utf8'),
      'RS256',
    );
    return builder.sign(key);
  }
  return builder.sign(secret);
}

async function getRefreshVerifyKey(): Promise<Uint8Array | Awaited<ReturnType<typeof importSPKI>>> {
  if (process.env.NODE_ENV === 'production') {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY is required in production');
    }

    return importSPKI(
      Buffer.from(publicKey, 'base64').toString('utf8'),
      'RS256',
    );
  }

  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function handleSuspiciousReuse(userId: string, ip: string): Promise<void> {
  // Invalidate all sessions by incrementing role_version
  await redis.incr(`role_version:${userId}`);
  await writeAuditEvent({
    actorId:  userId,
    action:   'SUSPICIOUS_REUSE',
    resource: 'RefreshToken',
    ip,
    details:  { reason: 'refresh_token_family_conflict' },
  });
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /login
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: [validate(LoginSchema)],
  }, async (request, reply) => {
    const { email, password } = request.body as z.infer<typeof LoginSchema>;

    const user = await (prisma as any).user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await writeAuditEvent({
        actorId:  user.id,
        action:   'LOGIN_FAILED',
        resource: 'User',
        ip:       request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const primaryMembership = await (prisma as any).orgMember.findFirst({
      where: { userId: user.id, removedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (!primaryMembership) {
      return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
    }

    const secret = process.env.NODE_ENV === 'production'
      ? process.env.JWT_PRIVATE_KEY!   // RS256 private key
      : new TextEncoder().encode(process.env.JWT_SECRET!);

    // Get current role_version
    const roleVersion = parseInt(await redis.get(`role_version:${user.id}`) ?? '0', 10);

    const accessToken = await signToken(
      { sub: user.id, orgId: primaryMembership.orgId, role: primaryMembership.role ?? user.role, role_version: roleVersion },
      typeof secret === 'string' ? secret : secret,
      '15m',
    );

    const refreshToken = await signToken(
      { sub: user.id, type: 'refresh', family: crypto.randomUUID() },
      typeof secret === 'string' ? secret : secret,
      '7d',
    );

    // Store refresh token family
    await redis.setex(`rt:${user.id}:${refreshToken.slice(-8)}`, 7 * 86400, '1');

    await writeAuditEvent({
      actorId:   user.id,
      action:    'LOGIN_SUCCESS',
      resource:  'User',
      ip:        request.ip,
      userAgent: request.headers['user-agent'],
    });

    request.log.info({ userId: user.id }, 'Login successful');
    return reply.send({ accessToken, refreshToken, expiresIn: 900 });
  });

  // POST /refresh
  fastify.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [validate(RefreshSchema)],
  }, async (request, reply) => {
    const { refreshToken } = request.body as z.infer<typeof RefreshSchema>;

    try {
      const { jwtVerify } = await import('jose');
      const verifyKey = await getRefreshVerifyKey();
      const { payload } = await jwtVerify(refreshToken, verifyKey);

      if ((payload as any).type !== 'refresh') {
        return reply.code(401).send({ error: 'INVALID_TOKEN' });
      }

      const userId      = payload.sub!;
      const family      = (payload as any).family;
      const tokenSuffix = refreshToken.slice(-8);
      const exists      = await redis.get(`rt:${userId}:${tokenSuffix}`);

      if (!exists) {
        // Token family conflict — suspicious reuse
        await handleSuspiciousReuse(userId, request.ip);
        return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
      }

      // Single-use — delete old token
      await redis.del(`rt:${userId}:${tokenSuffix}`);

      const user = await (prisma as any).user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(401).send({ error: 'USER_NOT_FOUND' });

      const roleVersion  = parseInt(await redis.get(`role_version:${userId}`) ?? '0', 10);
      const membership = await (prisma as any).orgMember.findFirst({
        where: { userId, removedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      if (!membership) {
        return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
      }

      const signingSecret = process.env.NODE_ENV === 'production'
        ? process.env.JWT_PRIVATE_KEY!
        : new TextEncoder().encode(process.env.JWT_SECRET!);

      const newAccessToken = await signToken(
        { sub: userId, orgId: membership.orgId, role: membership.role ?? user.role, role_version: roleVersion },
        signingSecret,
        '15m',
      );
      const newRefreshToken = await signToken(
        { sub: userId, type: 'refresh', family },
        signingSecret,
        '7d',
      );

      await redis.setex(`rt:${userId}:${newRefreshToken.slice(-8)}`, 7 * 86400, '1');
      return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 });

    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }
  });
};

export default authRoutes;
