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
import { createHash, randomUUID } from 'node:crypto';
import { z }                    from 'zod';
import * as bcrypt              from 'bcryptjs';
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import { prisma }               from '../../lib/prisma';
import { redis }                from '../../lib/redis';
import { writeAuditEvent }      from '../../services/audit';
import { validate }             from '../../plugins/validate';

const JWT_ISSUER = 'taxbridge-api';
const JWT_AUDIENCE = 'taxbridge-client';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const ROTATE_REFRESH_TOKEN_SCRIPT = `
local existingFamily = redis.call('GET', KEYS[1])
if not existingFamily then return 0 end
if existingFamily ~= ARGV[1] then return -1 end
redis.call('DEL', KEYS[1])
redis.call('SREM', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[1], 'EX', ARGV[3])
redis.call('SADD', KEYS[2], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[3])
redis.call('SADD', KEYS[4], ARGV[5])
redis.call('EXPIRE', KEYS[4], ARGV[3])
return 1
`;

const REVOKE_ALL_REFRESH_FAMILIES_SCRIPT = `
local families = redis.call('SMEMBERS', KEYS[1])
for _, family in ipairs(families) do
  local hashes = redis.call('SMEMBERS', ARGV[1] .. family)
  for _, tokenHash in ipairs(hashes) do
    redis.call('DEL', ARGV[2] .. tokenHash)
  end
  redis.call('DEL', ARGV[1] .. family)
end
redis.call('DEL', KEYS[1])
return #families
`;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
    .setExpirationTime(expiresIn)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE);

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
  await prisma.user.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 } },
  });
  await redis.eval(
    REVOKE_ALL_REFRESH_FAMILIES_SCRIPT,
    1,
    `rtfamilies:${userId}`,
    `rtf:${userId}:`,
    `rt:${userId}:`,
  );
  await writeAuditEvent({
    actorId: userId,
    action: 'SUSPICIOUS_REUSE',
    resource: 'RefreshToken',
    ip,
    details: { reason: 'refresh_token_family_conflict' },
  });
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /login
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: [validate(LoginSchema)],
  }, async (request, reply) => {
    const { email, password } = request.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
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

    const primaryMembership = await prisma.orgMember.findFirst({
      where: { userId: user.id, removedAt: null, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    if (!primaryMembership) {
      return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
    }

    const secret = process.env.NODE_ENV === 'production'
      ? process.env.JWT_PRIVATE_KEY!   // RS256 private key
      : new TextEncoder().encode(process.env.JWT_SECRET!);

    // Get current role_version
    const roleVersion = user.authVersion;

    const accessToken = await signToken(
      { sub: user.id, orgId: primaryMembership.orgId, role: primaryMembership.role ?? user.role, role_version: roleVersion },
      typeof secret === 'string' ? secret : secret,
      '15m',
    );

    const refreshFamily = randomUUID();
    const refreshToken = await signToken(
      { sub: user.id, type: 'refresh', family: refreshFamily, jti: randomUUID() },
      typeof secret === 'string' ? secret : secret,
      '7d',
    );

    const refreshHash = hashToken(refreshToken);
    const refreshFamilyKey = `rtf:${user.id}:${refreshFamily}`;
    await redis.multi()
      .set(`rt:${user.id}:${refreshHash}`, refreshFamily, 'EX', REFRESH_TOKEN_TTL_SECONDS)
      .sadd(refreshFamilyKey, refreshHash)
      .expire(refreshFamilyKey, REFRESH_TOKEN_TTL_SECONDS)
      .sadd(`rtfamilies:${user.id}`, refreshFamily)
      .expire(`rtfamilies:${user.id}`, REFRESH_TOKEN_TTL_SECONDS)
      .exec();

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

    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      const verifyKey = await getRefreshVerifyKey();
      const verified = await jwtVerify(refreshToken, verifyKey, {
        algorithms: process.env.NODE_ENV === 'production' ? ['RS256'] : ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'jti'],
      });
      payload = verified.payload;
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    const userId = payload.sub;
    const family = payload.family;
    if (
      typeof userId !== 'string' ||
      payload.type !== 'refresh' ||
      typeof family !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(family)
    ) {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    try {
      const oldHash = hashToken(refreshToken);
      const oldTokenKey = `rt:${userId}:${oldHash}`;
      const familyKey = `rtf:${userId}:${family}`;
      const familiesKey = `rtfamilies:${userId}`;

      const storedFamily = await redis.get(oldTokenKey);
      if (storedFamily !== family) {
        await handleSuspiciousReuse(userId, request.ip);
        return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deleted) return reply.code(401).send({ error: 'USER_NOT_FOUND' });

      const membership = await prisma.orgMember.findFirst({
        where: { userId, removedAt: null, status: 'active' },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });

      const signingSecret = process.env.NODE_ENV === 'production'
        ? process.env.JWT_PRIVATE_KEY!
        : new TextEncoder().encode(process.env.JWT_SECRET!);

      const newAccessToken = await signToken({
        sub: userId,
        orgId: membership.orgId,
        role: membership.role ?? user.role,
        role_version: user.authVersion,
      }, signingSecret, '15m');

      const newRefreshToken = await signToken(
        { sub: userId, type: 'refresh', family, jti: randomUUID() },
        signingSecret,
        '7d',
      );

      const newHash = hashToken(newRefreshToken);
      const rotationResult = Number(await redis.eval(
        ROTATE_REFRESH_TOKEN_SCRIPT,
        4,
        oldTokenKey,
        familyKey,
        `rt:${userId}:${newHash}`,
        familiesKey,
        family,
        oldHash,
        String(REFRESH_TOKEN_TTL_SECONDS),
        newHash,
        family,
      ));

      if (rotationResult !== 1) {
        await handleSuspiciousReuse(userId, request.ip);
        return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
      }

      return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 });
    } catch (error) {
      request.log.error({ err: error }, 'Refresh-token rotation failed');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }
  });
};

export default authRoutes;
