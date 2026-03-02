import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { authService } from '../services/auth';
import { privacyService } from '../services/privacy';
import { logSecurityEvent } from '../lib/security';
import { getPrismaClient } from '../lib/prisma';
import { writeAuditEvent } from '../services/audit';
import { sendPushNotification } from '../services/notifications';
import { getRedisConnection } from '../lib/redis';
import { createLogger } from '../lib/logger';

const log = createLogger('auth');
const prisma = getPrismaClient();

/**
 * GAP-02: Refresh token reuse detection.
 * If a token that has already been used is presented again, this indicates
 * token theft. All sessions are immediately invalidated and a security alert
 * push notification is sent to the user. (C-07: never throws — fire-and-forget safe)
 */
export async function handleSuspiciousReuse(userId: string, ip: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    // Invalidate all active sessions for this user
    await (prisma as any).userSession.updateMany({
      where: { userId },
      data: { expiresAt: new Date(0) },
    });
    // Bust role version cache
    if (redis) {
      await redis.del(`role_version:${userId}`).catch(() => {});
    }
    // Immutable audit trail
    await writeAuditEvent(
      {
        orgId: 'SYSTEM',
        actorId: userId,
        actorRole: 'SYSTEM',
        targetType: 'UserSession',
        targetId: userId,
        action: 'SECURITY_ALERT',
        after: { reason: 'refresh_token_reuse', ip },
        ip,
      },
      prisma,
    ).catch(() => {});
    // Push alert — fire-and-forget (C-07)
    sendPushNotification(userId, {
      title: 'Security Alert',
      body: 'Unusual activity detected. All sessions signed out.',
      data: { route: '/profile/security', orgId: '', type: 'system' },
    }).catch(() => {});
    Sentry.captureMessage('Refresh token reuse detected', {
      level: 'warning',
      extra: { userId, ip },
    });
    log.warn({ userId, ip }, 'Refresh token reuse — all sessions invalidated');
  } catch (err) {
    // Never throw — security events must not crash the handler (C-07)
    log.error({ err }, 'handleSuspiciousReuse failed');
    Sentry.captureException(err);
  }
}

/**
 * Maps auth errors to appropriate HTTP status codes and safe messages.
 * Prevents leaking internal error details to clients.
 */
function handleAuthError(error: unknown, reply: FastifyReply, defaultStatus = 400) {
  if (error instanceof ZodError) {
    return reply.status(422).send({
      error: 'Validation failed',
      details: error.issues.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  if (error instanceof Error) {
    // Map known auth error messages to appropriate status codes
    const message = error.message;
    if (message.includes('not found') || message.includes('does not exist')) {
      return reply.status(404).send({ error: 'Resource not found' });
    }
    if (message.includes('unauthorized') || message.includes('invalid') || message.includes('expired')) {
      return reply.status(401).send({ error: message });
    }
    // Don't leak internal messages — return generic error
    return reply.status(defaultStatus).send({ error: 'Authentication request failed' });
  }
  return reply.status(500).send({ error: 'Internal server error' });
}

const registerSchema = z.object({
  phone: z.string().regex(/^\+234[789]\d{9}$/, 'Invalid Nigerian phone number'),
  name: z.string().min(2).max(100),
  password: z.string().min(8)
});

const verifyPhoneSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().length(6)
});

const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
  deviceId: z.string().optional()
});

const mfaSetupSchema = z.object({
  userId: z.string().uuid()
});

const mfaVerifySchema = z.object({
  userId: z.string().uuid(),
  token: z.string().length(6)
});

const mfaLoginSchema = z.object({
  mfaToken: z.string(),
  totpCode: z.string().length(6)
});

const refreshSchema = z.object({
  refreshToken: z.string()
});

export default async function authRoutes(app: FastifyInstance) {
  // Register new user
  app.post('/api/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await authService.register(body.phone, body.name, body.password);
      
      return reply.status(201).send({
        success: true,
        userId: result.userId,
        message: 'Verification code sent to your phone'
      });
    } catch (error: unknown) {
      await logSecurityEvent('REGISTRATION_FAILED', { error: error instanceof Error ? error.message : 'unknown' }, 'warning');
      return handleAuthError(error, reply);
    }
  });

  // Verify phone number
  app.post('/api/v1/auth/verify-phone', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = verifyPhoneSchema.parse(request.body);
      const tokens = await authService.verifyPhone(body.userId, body.otp);
      
      return reply.send({
        success: true,
        ...tokens
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply);
    }
  });

  // Login
  app.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      const tokens = await authService.login(body.phone, body.password, body.deviceId);
      
      // If MFA is required, accessToken will be a temporary token
      if (!tokens.refreshToken) {
        return reply.send({
          success: true,
          requiresMfa: true,
          mfaToken: tokens.accessToken
        });
      }
      
      return reply.send({
        success: true,
        ...tokens
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply, 401);
    }
  });

  // Setup MFA
  app.post('/api/v1/auth/mfa/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = mfaSetupSchema.parse(request.body);
      const result = await authService.setupMFA(body.userId);
      
      return reply.send({
        success: true,
        secret: result.secret,
        qrCode: result.qrCode
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply);
    }
  });

  // Verify and enable MFA
  app.post('/api/v1/auth/mfa/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = mfaVerifySchema.parse(request.body);
      await authService.verifyAndEnableMFA(body.userId, body.token);
      
      return reply.send({
        success: true,
        message: 'MFA enabled successfully'
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply);
    }
  });

  // Verify MFA during login
  app.post('/api/v1/auth/mfa/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = mfaLoginSchema.parse(request.body);
      const tokens = await authService.verifyMFALogin(body.mfaToken, body.totpCode);
      
      return reply.send({
        success: true,
        ...tokens
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply, 401);
    }
  });

  // Refresh access token
  app.post('/api/v1/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = refreshSchema.parse(request.body);
      const result = await authService.refreshAccessToken(body.refreshToken);
      
      return reply.send({
        success: true,
        accessToken: result.accessToken
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply, 401);
    }
  });

  // Logout
  app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await authService.logout(token);
      }
      
      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error: unknown) {
      return handleAuthError(error, reply, 500);
    }
  });
}
