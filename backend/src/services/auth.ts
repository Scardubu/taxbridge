import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { prisma } from '../lib/prisma';

import { sendSMS } from '../integrations/comms/client';
import { createLogger } from '../lib/logger';
import { logSecurityEvent } from '../lib/security';
import { getRedisConnection } from '../queue/client';
import { encryption } from './encryption';

const log = createLogger('auth');

// Get Redis connection (may be null in development)
function getRedis() {
  return getRedisConnection();
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const PHONE_REGEX = /^\+234[789]\d{9}$/;
const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// JWT expiry constants (in seconds for type safety)
const DEFAULT_ACCESS_TOKEN_EXPIRY = 900;  // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRY = 604800;  // 7 days
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY: number;
  private readonly REFRESH_TOKEN_EXPIRY: number;

  constructor() {
    this.ACCESS_TOKEN_EXPIRY = AuthService.parseExpiry(
      process.env.ACCESS_TOKEN_EXPIRY,
      DEFAULT_ACCESS_TOKEN_EXPIRY
    );
    this.REFRESH_TOKEN_EXPIRY = AuthService.parseExpiry(
      process.env.REFRESH_TOKEN_EXPIRY,
      DEFAULT_REFRESH_TOKEN_EXPIRY
    );
  }

  private static parseExpiry(value: string | undefined, fallback: number): number {
    if (!value?.trim()) return fallback;
    const trimmed = value.trim();
    
    // Parse numeric values directly
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) return num;
    
    // Parse duration strings like "15m", "7d", "1h"
    const match = trimmed.match(/^(\d+)([smhd])$/);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 's': return amount;
        case 'm': return amount * 60;
        case 'h': return amount * 3600;
        case 'd': return amount * 86400;
      }
    }
    
    return fallback;
  }

  private get secrets() {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    // Fallback to JWT_SECRET if JWT_REFRESH_SECRET not set (less secure, log warning)
    const actualRefreshSecret = refreshSecret || jwtSecret;
    
    if (!process.env.JWT_REFRESH_SECRET) {
      // createLogger imported at top of this file — no raw console
      if (process.env.NODE_ENV !== 'test') {
        process.stderr.write('[WARN] [auth] JWT_REFRESH_SECRET not set — using JWT_SECRET as fallback. Set JWT_REFRESH_SECRET in production.\n');
      }
    }
    
    return { jwtSecret, refreshSecret: actualRefreshSecret };
  }

  async register(phone: string, name: string, password: string) {
    if (!PHONE_REGEX.test(phone)) {
      throw new Error('Invalid Nigerian phone number format. Use +234XXXXXXXXXX');
    }

    if (!PASSWORD_POLICY.test(password)) {
      throw new Error('Password must be at least 8 characters with 1 uppercase letter and 1 number');
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new Error('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        phone,
        name,
        passwordHash,
        verificationToken: otp,
        verificationTokenExpiry: otpExpiry,
        verified: false
      }
    });

    await sendSMS(
      phone,
      `TaxBridge: Your verification code is ${otp}. Valid for 10 minutes. Do not share this code.`
    );

    await prisma.auditLog.create({
      data: {
        action: 'user_register',
        userId: user.id,
        metadata: { phone }
      }
    });

    await logSecurityEvent('USER_REGISTERED', { userId: user.id, phone }, 'info');
    log.info('User registration OTP dispatched', { userId: user.id });

    return { userId: user.id, verificationToken: otp };
  }

  async verifyPhone(userId: string, otp: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('Invalid verification request');
    }

    if (!user.verificationToken || user.verificationToken !== otp) {
      await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } }
      });
      throw new Error('Invalid verification code');
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new Error('Verification code expired. Request a new one.');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        verified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        failedLoginAttempts: 0
      }
    });

    return this.generateTokens(user.id);
  }

  async login(phone: string, password: string, deviceId?: string): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    if (user.failedLoginAttempts >= 5 && user.updatedAt) {
      const lockUntil = new Date(user.updatedAt.getTime() + 30 * 60 * 1000);
      if (lockUntil > new Date()) {
        throw new Error('Account temporarily locked. Try again later.');
      }
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } }
      });
      await logSecurityEvent('FAILED_LOGIN', { phone }, 'warning');
      throw new Error('Invalid credentials');
    }

    if (!user.verified) {
      throw new Error('Phone number not verified. Please complete verification first.');
    }

    if (user.mfaEnabled) {
      const { jwtSecret } = this.secrets;
      const tempToken = jwt.sign({ userId: user.id, requiresMfa: true }, jwtSecret, { expiresIn: '5m' });
      return { accessToken: tempToken, refreshToken: '' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lastLoginDevice: deviceId
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_login',
        userId: user.id,
        metadata: { deviceId }
      }
    });

    return this.generateTokens(user.id);
  }

  async setupMFA(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `TaxBridge (${user.phone})`,
      issuer: 'TaxBridge'
    });

    await prisma.user.update({
      where: { id: userId },
      data: { mfaTempSecret: secret.base32 }
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    return { secret: secret.base32, qrCode };
  }

  async verifyAndEnableMFA(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaTempSecret) {
      throw new Error('MFA setup not initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaTempSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      throw new Error('Invalid MFA code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: user.mfaTempSecret,
        mfaTempSecret: null
      }
    });

    return true;
  }

  async verifyMFALogin(tempToken: string, totpCode: string): Promise<AuthTokens> {
    const { jwtSecret } = this.secrets;
    const decoded = jwt.verify(tempToken, jwtSecret) as { userId: string; requiresMfa?: boolean };
    if (!decoded.requiresMfa) {
      throw new Error('Invalid MFA token');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user?.mfaSecret) {
      throw new Error('MFA not configured');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2
    });

    if (!verified) {
      throw new Error('Invalid MFA code');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.generateTokens(user.id);
  }

  async refreshAccessToken(refreshToken: string) {
    const { refreshSecret, jwtSecret } = this.secrets;
    const decoded = jwt.verify(refreshToken, refreshSecret) as { userId: string; type?: string };
    if (decoded.type && decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    if (await this.isTokenBlacklisted(refreshToken)) {
      // C-35: Suspicious reuse — a blacklisted refresh token was used again
      await this.handleSuspiciousReuse(decoded.userId, 'unknown');
      throw new Error('Token expired');
    }

    // Blacklist the old refresh token (single-use rotation)
    const redis = getRedis();
    if (redis) {
      const oldDecoded = jwt.decode(refreshToken) as { exp?: number } | null;
      if (oldDecoded?.exp) {
        const ttl = oldDecoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`token:blacklist:${refreshToken}`, ttl, '1');
        }
      }
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId, type: 'access' },
      jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    return { accessToken };
  }

  /**
   * Handle suspicious refresh token reuse.
   * Invalidates ALL sessions for the user, creates an audit event,
   * and sends a security notification via SMS.
   *
   * GAP-02: Credential stuffing / token theft detection.
   */
  async handleSuspiciousReuse(userId: string, ip: string): Promise<void> {
    log.error('Suspicious refresh token reuse detected', { userId, ip });

    // 1. Invalidate all sessions by blacklisting all active tokens
    const redis = getRedis();
    if (redis) {
      // Set a global invalidation marker; authenticate middleware checks this
      await redis.setex(`auth:invalidated:${userId}`, 86_400, Date.now().toString());
    }

    // 2. Write audit event
    try {
      await (prisma as any).auditLog.create({
        data: {
          action: 'SUSPICIOUS_TOKEN_REUSE',
          userId,
          metadata: {
            ip,
            reason: 'Refresh token reuse detected — all sessions invalidated',
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      log.error('Failed to write audit event for suspicious reuse', { error: err });
    }

    // 3. Notify user via SMS
    try {
      const user = await (prisma as any).user.findUnique({ where: { id: userId } });
      if (user?.phone) {
        const { sendSMS: send } = await import('../integrations/comms/client');
        await send(
          user.phone,
          'TaxBridge Security Alert: Suspicious login detected. All your sessions have been signed out. If this was not you, change your password immediately.',
        );
      }
    } catch (err) {
      log.error('Failed to send suspicious reuse notification', { error: err });
    }

    await logSecurityEvent('SUSPICIOUS_TOKEN_REUSE', { userId, ip }, 'critical');
  }

  async logout(token?: string) {
    if (!token) return;
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) return;
    const redis = getRedis();
    if (!redis) {
      log.debug('Redis unavailable, cannot blacklist token');
      return;
    }
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(`token:blacklist:${token}`, ttl, '1');
    }
  }

  async storeApiKeys(userId: string, duploId: string, duploSecret: string, remitaId: string, remitaKey: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        duploClientId: duploId,
        duploClientSecret: duploSecret,
        remitaMerchantId: remitaId,
        remitaApiKey: remitaKey
      }
    });
  }

  async signUBL(xml: string, userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    let privateKey = user.ecdsaPrivateKey;
    if (!privateKey) {
      const { privateKey: generatedKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
      privateKey = generatedKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      await prisma.user.update({
        where: { id: userId },
        data: { ecdsaPrivateKey: privateKey }
      });
    }

    const signer = crypto.createSign('SHA256');
    signer.update(xml);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    return xml.replace('</Invoice>', `<cbc:UBLDocumentSignatures>${signature}</cbc:UBLDocumentSignatures></Invoice>`);
  }

  private generateTokens(userId: string): AuthTokens {
    const { jwtSecret, refreshSecret } = this.secrets;
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      jwtSecret,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      refreshSecret,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );
    return { accessToken, refreshToken };
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
      return false;
    }
    const exists = await redis.get(`token:blacklist:${token}`);
    return Boolean(exists);
  }
}

export const authService = new AuthService();
