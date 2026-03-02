/**
 * TOTP Routes — TaxBridge V12
 *
 * GAP-03 / criterion #22 — TOTP-based 2FA for all SUPER_ADMIN users.
 *
 * Endpoints:
 *   POST /api/v1/auth/totp/setup    — generate secret + provisioning URI
 *   POST /api/v1/auth/totp/verify   — verify token + activate 2FA
 *   POST /api/v1/auth/totp/disable  — disable 2FA (requires current token)
 *   POST /api/v1/auth/totp/backup   — list / regenerate backup codes
 *
 * C-38: Backup codes are bcrypt-hashed (cost 10) before storage.
 *       Raw codes are returned ONCE at generation time and never stored.
 *
 * C-07: All routes return structured errors; never crash.
 *
 * After /verify succeeds the server sets redis key `totp:{userId}` = "1"
 * so require2FA middleware can gate sensitive endpoints.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as OTPAuth from 'otpauth';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/node';
import { createLogger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import { getRedisConnection } from '../../../queue/client';
import { writeAuditEvent } from '../../../services/audit';

import crypto from 'node:crypto';

const log = createLogger('totp-routes');

const TOTP_ISSUER  = 'TaxBridge';
const BCRYPT_COST  = 10;
const BACKUP_COUNT = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_COUNT; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

function requireAuth(request: FastifyRequest, reply: FastifyReply): string | null {
  const user = (request as any).user;
  if (!user?.userId) {
    reply.status(401).send({ error: 'Unauthorised' });
    return null;
  }
  return user.userId as string;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const totpRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /setup ────────────────────────────────────────────────────────────
  // Generates a TOTP secret and returns the provisioning URI for a QR code.
  // Does NOT activate 2FA until /verify succeeds.

  fastify.post('/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    try {
      const totp = new OTPAuth.TOTP({
        issuer:    TOTP_ISSUER,
        label:     (request as any).user.email ?? userId,
        algorithm: 'SHA1',
        digits:    6,
        period:    30,
      });

      const secret = totp.secret.base32;
      const uri    = totp.toString();

      // Persist pending secret (not yet active)
      await (prisma as any).userTotp.upsert({
        where:  { userId },
        create: { userId, pendingSecret: secret, active: false },
        update: { pendingSecret: secret },
      });

      log.info('TOTP setup initiated', { userId });
      return reply.status(200).send({ secret, uri });
    } catch (err) {
      Sentry.captureException(err);
      log.error('TOTP setup failed', { err, userId });
      return reply.status(500).send({ error: 'Setup failed' });
    }
  });

  // ── POST /verify ──────────────────────────────────────────────────────────
  // Verifies the current TOTP token against the pending secret.
  // On success: marks 2FA active, writes redis flag.

  const VerifyBody = z.object({ token: z.string().length(6) });

  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = VerifyBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Token must be 6 digits', issues: parsed.error.issues });
    }
    const { token } = parsed.data;

    try {
      const record = await (prisma as any).userTotp.findUnique({ where: { userId } });
      if (!record?.pendingSecret) {
        return reply.status(400).send({ error: 'No pending TOTP setup. Call /setup first.' });
      }

      const totp  = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(record.pendingSecret), period: 30 });
      const delta = totp.validate({ token, window: 1 });

      if (delta === null) {
        return reply.status(401).send({ error: 'Invalid or expired TOTP token' });
      }

      // Generate and hash backup codes (C-38)
      const raw = generateBackupCodes();
      const hashed = await Promise.all(raw.map((c) => bcrypt.hash(c, BCRYPT_COST)));

      await (prisma as any).userTotp.update({
        where: { userId },
        data: {
          secret:         record.pendingSecret,
          pendingSecret:  null,
          active:         true,
          activatedAt:    new Date(),
          backupCodes:    hashed,
        },
      });

      // Mark session as 2FA-passed in Redis
      const redis = getRedisConnection();
      if (redis) {
        await redis.set(`totp:${userId}`, '1', 'EX', 12 * 60 * 60); // 12h
      }

      await writeAuditEvent(
        { actorId: userId, action: 'TOTP_ACTIVATED', details: {} },
        prisma as any,
      );

      log.info('2FA activated successfully', { userId });
      return reply.status(200).send({
        status:       'activated',
        backupCodes:  raw, // returned ONCE — never stored in plaintext
      });
    } catch (err) {
      Sentry.captureException(err);
      log.error('TOTP verify failed', { err, userId });
      return reply.status(500).send({ error: 'Verification failed' });
    }
  });

  // ── POST /disable ─────────────────────────────────────────────────────────
  // Disables 2FA. Requires current valid TOTP token or backup code.

  const DisableBody = z.object({ token: z.string().min(6).max(8) });

  fastify.post('/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = DisableBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Token required', issues: parsed.error.issues });
    }
    const { token } = parsed.data;

    try {
      const record = await (prisma as any).userTotp.findUnique({ where: { userId } });
      if (!record?.active) {
        return reply.status(400).send({ error: '2FA is not currently active' });
      }

      // Try TOTP token first
      const totp  = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(record.secret), period: 30 });
      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      await (prisma as any).userTotp.update({
        where: { userId },
        data:  { active: false, secret: null, backupCodes: [], disabledAt: new Date() },
      });

      const redis = getRedisConnection();
      if (redis) {
        await redis.del(`totp:${userId}`);
      }

      await writeAuditEvent(
        { actorId: userId, action: 'TOTP_DISABLED', details: {} },
        prisma as any,
      );

      log.info('2FA disabled', { userId });
      return reply.status(200).send({ status: 'disabled' });
    } catch (err) {
      Sentry.captureException(err);
      log.error('TOTP disable failed', { err, userId });
      return reply.status(500).send({ error: 'Disable failed' });
    }
  });

  // ── POST /backup ──────────────────────────────────────────────────────────
  // Regenerates backup codes. Invalidates all previous codes.

  const BackupBody = z.object({ token: z.string().length(6) });

  fastify.post('/backup', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireAuth(request, reply);
    if (!userId) return;

    const parsed = BackupBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'TOTP token required to regenerate backup codes', issues: parsed.error.issues });
    }
    const { token } = parsed.data;

    try {
      const record = await (prisma as any).userTotp.findUnique({ where: { userId } });
      if (!record?.active) {
        return reply.status(400).send({ error: '2FA is not active' });
      }

      const totp  = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(record.secret), period: 30 });
      const delta = totp.validate({ token, window: 1 });
      if (delta === null) {
        return reply.status(401).send({ error: 'Invalid TOTP token' });
      }

      // Generate fresh codes (C-38: bcrypt hash)
      const raw    = generateBackupCodes();
      const hashed = await Promise.all(raw.map((c) => bcrypt.hash(c, BCRYPT_COST)));

      await (prisma as any).userTotp.update({
        where: { userId },
        data:  { backupCodes: hashed },
      });

      log.info('Backup codes regenerated', { userId });
      return reply.status(200).send({ backupCodes: raw }); // raw returned ONCE
    } catch (err) {
      Sentry.captureException(err);
      log.error('Backup code regeneration failed', { err, userId });
      return reply.status(500).send({ error: 'Regeneration failed' });
    }
  });
};

export default totpRoutes;
