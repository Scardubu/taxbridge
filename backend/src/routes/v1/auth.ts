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
import * as OTPAuth             from 'otpauth';
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';
import { prisma }               from '../../lib/prisma';
import { redis }                from '../../lib/redis';
import { writeAuditEvent }      from '../../services/audit';
import { validate }             from '../../plugins/validate';
import { invalidateUserSessions } from '../../services/session-revocation';

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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const LoginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().trim().min(8).max(32).optional(),
  password: z.string().min(8),
  deviceId: z.string().max(128).optional(),
}).strict().refine(
  (value) => Boolean(value.email) !== Boolean(value.phone),
  { message: 'Provide exactly one login identifier', path: ['email'] },
);

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

const MfaVerifySchema = z.object({
  challengeToken: z.string().min(20).max(8192),
  code: z.string().trim().regex(/^(?:\d{6}|[a-fA-F0-9]{8})$/),
}).strict();

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
  await invalidateUserSessions(userId);
  await writeAuditEvent({
    actorId: userId,
    action: 'SUSPICIOUS_REUSE',
    resource: 'RefreshToken',
    ip,
    details: { reason: 'refresh_token_family_conflict' },
  });
}

async function issueSessionTokens(
  user: { id: string; authVersion: number; role: string; email: string | null; name: string; createdAt: Date },
  membership: { orgId: string; role: string | null },
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; email: string; name: string; role: string; createdAt: string } }> {
  const secret = process.env.NODE_ENV === 'production'
    ? process.env.JWT_PRIVATE_KEY!
    : new TextEncoder().encode(process.env.JWT_SECRET!);
  const accessToken = await signToken({
    sub: user.id,
    orgId: membership.orgId,
    role: membership.role ?? user.role,
    role_version: user.authVersion,
    jti: randomUUID(),
  }, secret, '15m');

  const refreshFamily = randomUUID();
  const refreshToken = await signToken({
    sub: user.id, type: 'refresh', family: refreshFamily,
    jti: randomUUID(), role_version: user.authVersion,
  }, secret, '7d');

  const refreshHash = hashToken(refreshToken);
  const refreshFamilyKey = `rtf:${user.id}:${refreshFamily}`;
  await redis.multi()
    .set(`rt:${user.id}:${refreshHash}`, refreshFamily, 'EX', REFRESH_TOKEN_TTL_SECONDS)
    .sadd(refreshFamilyKey, refreshHash)
    .expire(refreshFamilyKey, REFRESH_TOKEN_TTL_SECONDS)
    .sadd(`rtfamilies:${user.id}`, refreshFamily)
    .expire(`rtfamilies:${user.id}`, REFRESH_TOKEN_TTL_SECONDS)
    .exec();

  return {
    accessToken, refreshToken, expiresIn: 900,
    user: {
      id: user.id,
      email: user.email ?? '',
      name: user.name,
      role: membership.role ?? user.role,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /login
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    preHandler: [validate(LoginSchema)],
  }, async (request, reply) => {
    const { email, phone, password } = request.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findUnique({
      where: email ? { email } : { phone: phone! },
    });
    if (!user || user.deleted || !user.passwordHash) {
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
      where: { userId: user.id, removedAt: null, status: 'active', org: { status: 'active' } },
      orderBy: { createdAt: 'asc' },
    });

    if (!primaryMembership) {
      return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
    }

    let activeTotp: { active: boolean } | null;
    try {
      activeTotp = await prisma.userTotp.findUnique({
        where: { userId: user.id },
        select: { active: true },
      });
    } catch (error) {
      request.log.error({ err: error, userId: user.id }, 'TOTP policy lookup failed during login');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    }

    const membershipRole = primaryMembership.role ?? user.role;
    if (activeTotp?.active) {
      const jti = randomUUID();
      const secret = process.env.NODE_ENV === 'production'
        ? process.env.JWT_PRIVATE_KEY!
        : new TextEncoder().encode(process.env.JWT_SECRET!);
      const challengeToken = await signToken({
        sub: user.id,
        orgId: primaryMembership.orgId,
        role: membershipRole,
        role_version: user.authVersion,
        type: 'mfa_challenge',
        jti,
      }, secret, '5m');

      try {
        await redis.set(`mfa:challenge:${jti}`, '1', 'EX', 300);
      } catch (error) {
        request.log.error({ err: error, userId: user.id }, 'MFA challenge state could not be persisted');
        return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
      }

      await writeAuditEvent({
        actorId: user.id,
        action: 'LOGIN_MFA_CHALLENGE_ISSUED',
        resource: 'User',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        details: { method: 'totp_or_backup_code' },
      });
      return reply.send({ mfaRequired: true, challengeToken, expiresIn: 300 });
    }

    const tokens = await issueSessionTokens(user, primaryMembership);
    await writeAuditEvent({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'User',
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    request.log.info({ userId: user.id }, 'Login successful');
    return reply.send(tokens);
  });

  // POST /mfa/verify — consumes a short-lived, one-use password-authenticated challenge.
  fastify.post('/mfa/verify', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [validate(MfaVerifySchema)],
  }, async (request, reply) => {
    const { challengeToken, code } = request.body as z.infer<typeof MfaVerifySchema>;
    let payload: Awaited<ReturnType<typeof jwtVerify>>['payload'];
    try {
      payload = (await jwtVerify(challengeToken, await getRefreshVerifyKey(), {
        algorithms: process.env.NODE_ENV === 'production' ? ['RS256'] : ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'jti', 'role_version'],
      })).payload;
    } catch {
      return reply.code(401).send({ error: 'INVALID_MFA_CHALLENGE' });
    }

    const userId = payload.sub;
    const orgId = payload.orgId;
    const role = payload.role;
    const jti = payload.jti;
    const roleVersion = payload.role_version;
    if (
      payload.type !== 'mfa_challenge' ||
      typeof userId !== 'string' ||
      typeof orgId !== 'string' ||
      typeof role !== 'string' ||
      typeof jti !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(jti) ||
      typeof roleVersion !== 'number' ||
      !Number.isSafeInteger(roleVersion) ||
      roleVersion < 0
    ) {
      return reply.code(401).send({ error: 'INVALID_MFA_CHALLENGE' });
    }

    const challengeKey = `mfa:challenge:${jti}`;
    const attemptsKey = `mfa:challenge-attempts:${jti}`;
    const userAttemptsKey = `mfa:challenge-user-attempts:${userId}`;
    const lockKey = `mfa:challenge-lock:${jti}`;
    const lockId = randomUUID();
    let lockAcquired = false;
    try {
      if (await redis.get(challengeKey) !== '1') {
        return reply.code(401).send({ error: 'MFA_CHALLENGE_EXPIRED_OR_USED' });
      }
      const lockResult = await redis.set(lockKey, lockId, 'EX', 45, 'NX');
      if (lockResult !== 'OK') {
        return reply.code(409).send({ error: 'MFA_CHALLENGE_IN_PROGRESS' });
      }
      lockAcquired = true;

      const attempts = Number(await redis.get(attemptsKey) ?? '0');
      const userAttempts = Number(await redis.get(userAttemptsKey) ?? '0');
      if (!Number.isSafeInteger(attempts) || attempts >= 5 || !Number.isSafeInteger(userAttempts) || userAttempts >= 10) {
        await redis.del(challengeKey, attemptsKey);
        return reply.code(429).send({ error: 'MFA_ATTEMPTS_EXCEEDED' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, authVersion: true, deleted: true, email: true, name: true, createdAt: true },
      });
      if (!user || user.deleted || user.authVersion !== roleVersion) {
        await redis.del(challengeKey, attemptsKey);
        return reply.code(401).send({ error: 'MFA_CHALLENGE_REVOKED' });
      }

      const membership = await prisma.orgMember.findFirst({
        where: {
          userId,
          orgId,
          removedAt: null,
          status: 'active',
          org: { status: 'active' },
        },
        select: { orgId: true, role: true },
      });
      if (!membership || (membership.role ?? user.role) !== role) {
        await redis.del(challengeKey, attemptsKey);
        return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });
      }

      const totpRecord = await prisma.userTotp.findUnique({
        where: { userId },
        select: { active: true, secret: true, backupCodes: true },
      });
      if (!totpRecord?.active || !totpRecord.secret) {
        await redis.del(challengeKey, attemptsKey);
        return reply.code(401).send({ error: 'MFA_NOT_CONFIGURED' });
      }

      let valid = false;
      let matchedBackupHash: string | null = null;
      if (/^\d{6}$/.test(code)) {
        const totp = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(totpRecord.secret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
        const delta = totp.validate({ token: code, window: 1 });
        if (delta !== null) {
          // A TOTP time-step is accepted once per account, even across separately
          // issued challenges. This closes cross-challenge code replay.
          const counter = Math.floor(Date.now() / 30_000) + delta;
          valid = (await redis.set(`mfa:totp-used:${userId}:${counter}`, '1', 'EX', 120, 'NX')) === 'OK';
        }
      } else {
        const normalized = code.toUpperCase();
        for (const backupHash of totpRecord.backupCodes) {
          if (await bcrypt.compare(normalized, backupHash)) {
            matchedBackupHash = backupHash;
            valid = true;
            break;
          }
        }
      }

      if (!valid) {
        const nextAttempts = await redis.incr(attemptsKey);
        const nextUserAttempts = await redis.incr(userAttemptsKey);
        if (nextAttempts === 1) await redis.expire(attemptsKey, 300);
        if (nextUserAttempts === 1) await redis.expire(userAttemptsKey, 900);
        await writeAuditEvent({
          actorId: userId,
          action: 'LOGIN_MFA_FAILED',
          resource: 'User',
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          details: { challengeAttempts: nextAttempts, userAttempts: nextUserAttempts },
        });
        if (nextAttempts >= 5 || nextUserAttempts >= 10) {
          await redis.del(challengeKey, attemptsKey);
          return reply.code(429).send({ error: 'MFA_ATTEMPTS_EXCEEDED' });
        }
        return reply.code(401).send({ error: 'INVALID_MFA_CODE' });
      }

      // Atomic single-use consumption prevents challenge replay.
      if (await redis.del(challengeKey) !== 1) {
        return reply.code(401).send({ error: 'MFA_CHALLENGE_EXPIRED_OR_USED' });
      }
      await redis.del(attemptsKey);
      if (matchedBackupHash) {
        // Remove the matched hash atomically so a backup code cannot be reused
        // by another simultaneous login challenge.
        const consumed = await prisma.$executeRaw`
          UPDATE "user_totp"
             SET "backup_codes" = array_remove("backup_codes", ${matchedBackupHash})
           WHERE "user_id" = ${userId}
             AND ${matchedBackupHash} = ANY("backup_codes")
        `;
        if (consumed !== 1) return reply.code(401).send({ error: 'INVALID_MFA_CODE' });
      }

      const tokens = await issueSessionTokens(user, membership);
      await writeAuditEvent({
        actorId: user.id,
        action: 'LOGIN_SUCCESS',
        resource: 'User',
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        details: { mfaVerified: true, method: matchedBackupHash ? 'backup_code' : 'totp' },
      });
      request.log.info({ userId: user.id }, 'Login completed after MFA');
      return reply.send(tokens);
    } catch (error) {
      request.log.error({ err: error, userId }, 'MFA verification failed');
      return reply.code(503).send({ error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE' });
    } finally {
      if (lockAcquired) {
        await redis.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockId,
        ).catch(() => undefined);
      }
    }
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
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud', 'jti', 'role_version'],
      });
      payload = verified.payload;
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    const userId = payload.sub;
    const family = payload.family;
    const tokenRoleVersion = payload.role_version;
    if (
      typeof userId !== 'string' ||
      payload.type !== 'refresh' ||
      typeof family !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(family) ||
      typeof tokenRoleVersion !== 'number' ||
      !Number.isSafeInteger(tokenRoleVersion) ||
      tokenRoleVersion < 0
    ) {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deleted) return reply.code(401).send({ error: 'USER_NOT_FOUND' });
      if (user.authVersion !== tokenRoleVersion) {
        return reply.code(401).send({
          error: 'TOKEN_EXPIRED',
          message: 'Session was revoked. Sign in again.',
        });
      }

      const membership = await prisma.orgMember.findFirst({
        where: { userId, removedAt: null, status: 'active', org: { status: 'active' } },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) return reply.code(403).send({ error: 'ORG_ACCESS_DENIED' });

      const oldHash = hashToken(refreshToken);
      const oldTokenKey = `rt:${userId}:${oldHash}`;
      const familyKey = `rtf:${userId}:${family}`;
      const familiesKey = `rtfamilies:${userId}`;

      const storedFamily = await redis.get(oldTokenKey);
      if (storedFamily !== family) {
        await handleSuspiciousReuse(userId, request.ip);
        return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
      }

      const signingSecret = process.env.NODE_ENV === 'production'
        ? process.env.JWT_PRIVATE_KEY!
        : new TextEncoder().encode(process.env.JWT_SECRET!);

      const newAccessToken = await signToken({
        sub: userId,
        orgId: membership.orgId,
        role: membership.role ?? user.role,
        role_version: user.authVersion,
        jti: randomUUID(),
      }, signingSecret, '15m');

      const newRefreshToken = await signToken(
        { sub: userId, type: 'refresh', family, jti: randomUUID(), role_version: user.authVersion },
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
