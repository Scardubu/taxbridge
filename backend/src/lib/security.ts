import { createLogger } from './logger';
import { getRedisConnection } from '../queue/client';
import { getAdminApiKeys } from './config';
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const redis = getRedisConnection();
const log = createLogger('security');

// Rate limiting configurations
const RATE_LIMITS = {
  // API endpoints
  api: {
    window: 60, // 1 minute
    max: 100, // 100 requests per minute
    blockDuration: 300 // 5 minutes block
  },
  // USSD sessions
  ussd: {
    window: 60, // 1 minute
    max: 10, // 10 USSD requests per minute
    blockDuration: 300 // 5 minutes block
  },
  // SMS sending
  sms: {
    window: 300, // 5 minutes
    max: 5, // 5 SMS per 5 minutes
    blockDuration: 900 // 15 minutes block
  },
  // Authentication attempts
  auth: {
    window: 900, // 15 minutes
    max: 5, // 5 failed attempts
    blockDuration: 1800 // 30 minutes block
  },
  // Webhook processing
  webhook: {
    window: 60, // 1 minute
    max: 50, // 50 webhook calls per minute
    blockDuration: 300 // 5 minutes block
  }
};

// Security configurations
const SECURITY_CONFIG = {
  // IP-based rate limiting
  enableIpRateLimit: true,
  // Request size limits
  maxRequestSize: 1024 * 1024, // 1MB
  // Input sanitization
  enableInputSanitization: true,
  // CORS settings
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS)?.split(',') || ['*'],
  // Request timeout
  requestTimeout: 30000, // 30 seconds
  // Maximum session duration
  maxSessionDuration: 1800, // 30 minutes
  // Password requirements
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true
};

// Rate limiting helper
export async function checkRateLimit(
  identifier: string, 
  type: keyof typeof RATE_LIMITS, 
  ip?: string
): Promise<{ allowed: boolean; remaining: number; resetTime?: Date; blocked?: boolean }> {
  const config = RATE_LIMITS[type];
  const key = `rate_limit:${type}:${identifier}`;
  
  try {
    const now = Date.now();
    const windowStart = now - (config.window * 1000);
    
    // Get existing requests with scores
    const requests = await redis.zrangebyscore(key, windowStart, '+inf');
    
    // Count valid requests (already filtered by score range)
    const validRequests = requests;
    
    // Check if rate limit exceeded
    if (validRequests.length >= config.max) {
      const blocked = await redis.get(`blocked:${identifier}`);
      if (blocked) {
        return { allowed: false, remaining: 0, blocked: true };
      }
      
      // Block the identifier
      await redis.setex(`blocked:${identifier}`, config.blockDuration, '1');
      return { allowed: false, remaining: 0, blocked: true };
    }
    
    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, config.window);
    
    const remaining = config.max - validRequests.length - 1;
    const resetTime = new Date(now + (config.window * 1000));
    
    return { allowed: true, remaining, resetTime };
  } catch (error) {
    log.error('Rate limit check failed', { error, identifier, type });
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: 1 };
  }
}

// Input sanitization
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 1000); // Limit length
}

// Password validation
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < SECURITY_CONFIG.passwordMinLength) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.passwordMinLength} characters`);
  }
  
  if (SECURITY_CONFIG.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (SECURITY_CONFIG.passwordRequireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (SECURITY_CONFIG.passwordRequireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (SECURITY_CONFIG.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generate secure token
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Hash password
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 100000, 64, 'sha512').toString('hex');
  
  return { hash, salt: generatedSalt };
}

// Verify password
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return computedHash === hash;
}

// Check if IP is blocked
export async function isIPBlocked(ip: string): Promise<boolean> {
  try {
    const blocked = await redis.get(`blocked_ip:${ip}`);
    return !!blocked;
  } catch (error) {
    log.error('IP block check failed', { error, ip });
    return false;
  }
}

// Block IP
export async function blockIP(ip: string, duration: number = 3600): Promise<void> {
  try {
    await redis.setex(`blocked_ip:${ip}`, duration, '1');
    log.warn('IP blocked', { ip, duration });
  } catch (error) {
    log.error('IP block failed', { error, ip });
  }
}

// Security middleware for Fastify
export function securityMiddleware(options: { enableRateLimit?: boolean; enableInputSanitization?: boolean } = {}) {
  const { enableRateLimit = true, enableInputSanitization = true } = options;
  
  return async (request: any, reply: any) => {
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    
    // Check IP block
    if (await isIPBlocked(ip)) {
      reply.code(403).send({ error: 'IP blocked' });
      return;
    }
    
    // Rate limiting
    if (enableRateLimit) {
      const rateLimitResult = await checkRateLimit(ip, 'api', ip);
      if (!rateLimitResult.allowed) {
        reply.code(429).send({ 
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime 
        });
        return;
      }
    }
    
    // Input sanitization
    if (enableInputSanitization && request.body) {
      if (typeof request.body === 'string') {
        request.body = sanitizeInput(request.body);
      } else if (typeof request.body === 'object') {
        request.body = sanitizeObject(request.body);
      }
    }
  };
}

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// Log security events for audit trail
export async function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
): Promise<void> {
  try {
    const eventData = {
      event,
      severity,
      details,
      timestamp: new Date().toISOString(),
      ip: details.ip || 'unknown'
    };
    
    // Log to console/file
    if (severity === 'critical' || severity === 'error') {
      log.error('Security event', eventData);
    } else if (severity === 'warning') {
      log.warn('Security event', eventData);
    } else {
      log.info('Security event', eventData);
    }
    
    // Store in Redis for quick access (expires in 24 hours)
    const key = `security:events:${Date.now()}`;
    await redis.setex(key, 86400, JSON.stringify(eventData));
  } catch (error) {
    log.error('Failed to log security event', { error, event });
  }
}

function timingSafeMatch(input: string, comparison: string): boolean {
  const inputHash = crypto.createHash('sha256').update(input).digest();
  const comparisonHash = crypto.createHash('sha256').update(comparison).digest();
  return crypto.timingSafeEqual(inputHash, comparisonHash);
}

export async function requireAdminApiKey(request: FastifyRequest, reply: FastifyReply) {
  const allowedKeys = getAdminApiKeys();

  if (!allowedKeys.length) {
    await logSecurityEvent('ADMIN_AUTH_DISABLED', { ip: request.ip }, 'warning');
    return reply.code(503).send({ error: 'Admin API disabled' });
  }

  const headerKey = request.headers['x-admin-api-key'];
  const bearerToken = typeof request.headers.authorization === 'string'
    ? request.headers.authorization.replace(/^Bearer\s+/i, '')
    : undefined;
  const providedKey = typeof headerKey === 'string' ? headerKey : bearerToken;

  if (!providedKey) {
    await logSecurityEvent('ADMIN_AUTH_MISSING_KEY', { ip: request.ip, path: request.url }, 'warning');
    return reply.code(401).send({ error: 'Missing admin API key' });
  }

  const isValid = allowedKeys.some(storedKey => timingSafeMatch(providedKey, storedKey));

  if (!isValid) {
    await logSecurityEvent('ADMIN_AUTH_INVALID_KEY', { ip: request.ip, path: request.url }, 'error');
    return reply.code(403).send({ error: 'Invalid admin API key' });
  }
}

export default {
  checkRateLimit,
  sanitizeInput,
  validatePassword,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  isIPBlocked,
  blockIP,
  securityMiddleware,
  logSecurityEvent,
  requireAdminApiKey,
  SECURITY_CONFIG,
  RATE_LIMITS
};
