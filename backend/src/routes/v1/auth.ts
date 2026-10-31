/**
 * Auth Routes — TaxBridge V13 Sovereign
 *
 * Fastify plugin. prefix: '/api/v1/auth'
 * Routes: POST /login | POST /refresh
 *
 * C-47: No Express imports.
 * C-26: request.log.* only — no console.log.
 */
import { randomUUID } from 'node:crypto';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { writeAuditEvent } from '../../services/audit';
import { validate } from '../../plugins/validate';
import {
  createRefreshSession,
  rotateRefreshSession,
} from '../../services/refreshTokenRotation';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const FAMILY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  deviceId: z.string().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1).max(8192),
});

const JWT_ISSUER = process.env.JWT_ISSUER ?? 'taxbridge-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? 'taxbridge-clients';

async function signToken(
  payload: Record<string, unknown>,
  secret: string | Uint8Array,
  expiresIn: string,
): Promise<string> {
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: process.env.NODE_ENV === 'production' ? 'RS256' : 'HS256', typ: 'JWT' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn);

  if (typeof secret === 'string') {
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

async function readRoleVersion(userId: string): Promise<number> {
  const stored = await redis.get('role_version:' + userId);
  const version = stored === null ? 0 : Number(stored);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Stored role version is invalid');
  }
  return version;
}

/**
 * The Lua rotation script increments role_version atomically when a previously
 * consumed token is replayed. The optional flag prevents a second increment
 * while retaining the existing helper contract for other callers.
 */
export async function handleSuspiciousReuse(
  userId: string,
  ip: string,
  versionAlreadyIncremented = false,
): Promise<void> {
  if (!versionAlreadyIncremented) {
    await redis.incr('role_version:' + userId);
  }
  await writeAuditEvent({
    actorId: userId,
    action: 'SUSPICIOUS_REUSE',
    resource: 'RefreshToken',
    ip,
    details: { reason: 'refresh_token_family_conflict' },
  });
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
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
        actorId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'User',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const primaryMembership = await (prisma as any).orgMember.findFirst({
      where: { userId: user.id, removedAt: null, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    if (!primaryMembership) {
      return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
    }

    let roleVersion: number;
    try {
      roleVersion = await readRoleVersion(user.id);
    } catch (error) {
      request.log.error({ err: error }, 'Role-version dependency unavailable during login');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }

    const signingSecret = process.env.NODE_ENV === 'production'
      ? process.env.JWT_PRIVATE_KEY!
      : new TextEncoder().encode(process.env.JWT_SECRET!);
    const familyId = randomUUID();

    const accessToken = await signToken(
      {
        sub: user.id,
        orgId: primaryMembership.orgId,
        role: primaryMembership.role ?? user.role,
        role_version: roleVersion,
        type: 'access',
      },
      signingSecret,
      '15m',
    );

    const refreshToken = await signToken(
      {
        sub: user.id,
        type: 'refresh',
        family: familyId,
        role_version: roleVersion,
      },
      signingSecret,
      '7d',
    );

    try {
      await createRefreshSession(
        redis,
        user.id,
        familyId,
        refreshToken,
        REFRESH_TOKEN_TTL_SECONDS,
      );
    } catch (error) {
      request.log.error({ err: error }, 'Refresh-token session could not be persisted');
      return reply.code(503).send({ error: 'SESSION_STORE_UNAVAILABLE' });
    }

    await writeAuditEvent({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'User',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    request.log.info({ userId: user.id }, 'Login successful');
    return reply.send({ accessToken, refreshToken, expiresIn: 900 });
  });

  fastify.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [validate(RefreshSchema)],
  }, async (request, reply) => {
    const { refreshToken } = request.body as z.infer<typeof RefreshSchema>;

    let payload;
    try {
      const verifyKey = await getRefreshVerifyKey();
      const verified = await jwtVerify(refreshToken, verifyKey, {
        algorithms: process.env.NODE_ENV === 'production' ? ['RS256'] : ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'type', 'family', 'role_version'],
      });
      payload = verified.payload;
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    if (
      payload.type !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.family !== 'string' ||
      !FAMILY_ID_PATTERN.test(payload.family) ||
      typeof payload.role_version !== 'number' ||
      !Number.isSafeInteger(payload.role_version) ||
      payload.role_version < 0
    ) {
      return reply.code(401).send({ error: 'INVALID_TOKEN_CLAIMS' });
    }

    const userId = payload.sub;
    const familyId = payload.family;
    const tokenRoleVersion = payload.role_version;

    let user: any;
    let membership: any;
    let currentRoleVersion: number;
    try {
      user = await (prisma as any).user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(401).send({ error: 'USER_NOT_FOUND' });

      membership = await (prisma as any).orgMember.findFirst({
        where: { userId, removedAt: null, status: 'active' },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });

      currentRoleVersion = await readRoleVersion(userId);
    } catch (error) {
      request.log.error({ err: error }, 'Refresh-token authorization dependency unavailable');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }

    if (currentRoleVersion !== tokenRoleVersion) {
      return reply.code(401).send({ error: 'SESSION_REVOKED' });
    }

    const signingSecret = process.env.NODE_ENV === 'production'
      ? process.env.JWT_PRIVATE_KEY!
      : new TextEncoder().encode(process.env.JWT_SECRET!);

    let newAccessToken: string;
    let newRefreshToken: string;
    try {
      newAccessToken = await signToken(
        {
          sub: userId,
          orgId: membership.orgId,
          role: membership.role ?? user.role,
          role_version: currentRoleVersion,
          type: 'access',
        },
        signingSecret,
        '15m',
      );
      newRefreshToken = await signToken(
        {
          sub: userId,
          type: 'refresh',
          family: familyId,
          role_version: currentRoleVersion,
        },
        signingSecret,
        '7d',
      );
    } catch (error) {
      request.log.error({ err: error }, 'Refresh-token replacement could not be signed');
      return reply.code(503).send({ error: 'TOKEN_ISSUANCE_UNAVAILABLE' });
    }

    let rotationResult;
    try {
      rotationResult = await rotateRefreshSession(redis, {
        userId,
        familyId,
        currentToken: refreshToken,
        replacementToken: newRefreshToken,
        expectedRoleVersion: currentRoleVersion,
        ttlSeconds: REFRESH_TOKEN_TTL_SECONDS,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Atomic refresh-token rotation failed');
      return reply.code(503).send({ error: 'SESSION_STORE_UNAVAILABLE' });
    }

    if (rotationResult === 'REPLAYED') {
      await handleSuspiciousReuse(userId, request.ip, true);
      return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
    }
    if (rotationResult === 'REVOKED') {
      return reply.code(401).send({ error: 'SESSION_REVOKED' });
    }
    if (rotationResult === 'MISSING') {
      return reply.code(401).send({ error: 'REFRESH_SESSION_NOT_FOUND' });
    }

    // The Redis script atomically replaces the old digest before any success
    // response is emitted. Exactly one request can consume a given token.
    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 });
  });
};

export default authRoutes;
