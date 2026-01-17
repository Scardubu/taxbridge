import { prisma } from '../../lib/prisma';
import { getRedisConnection } from '../../queue/client';
import { createLogger } from '../../lib/logger';
import { sendSMSInfobip, verifyInfobipSignature, parseInfobipDelivery } from './providers/infobip.js';
import { sendSMSTermii, verifyTermiiSignature, parseTermiiDelivery } from './providers/termii.js';

const redis = getRedisConnection();
const log = createLogger('sms-client');

// Provider configuration and health tracking
interface ProviderHealth {
  name: string;
  isHealthy: boolean;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  lastError?: string;
}

interface SMSResult {
  provider: string;
  messageId?: string;
  success: boolean;
  error?: string;
  raw?: any;
  fallbackUsed?: boolean;
}

// Provider priority order for failover
const PROVIDER_PRIORITY = ['infobip', 'termii', 'africastalking'] as const;
type ProviderType = typeof PROVIDER_PRIORITY[number];

// Health tracking for each provider
const providerHealth: Record<ProviderType, ProviderHealth> = {
  infobip: { name: 'infobip', isHealthy: true, lastCheck: new Date(), errorCount: 0, successCount: 0 },
  termii: { name: 'termii', isHealthy: true, lastCheck: new Date(), errorCount: 0, successCount: 0 },
  africastalking: { name: 'africastalking', isHealthy: true, lastCheck: new Date(), errorCount: 0, successCount: 0 }
};

// Rate limiting for SMS (prevent spam)
const SMS_RATE_LIMIT_WINDOW = 300; // 5 minutes
const SMS_RATE_LIMIT_MAX = 5; // max 5 SMS per 5 minutes per recipient

// Message validation and sanitization
const sanitizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

const sanitizeMessage = (message: string): string => {
  // Remove potentially harmful characters, limit length
  return message.replace(/[<>"'&]/g, '').slice(0, 160);
};

const validatePhone = (phone: string): boolean => {
  const sanitized = sanitizePhone(phone);
  return /^\+?[1-9]\d{1,14}$/.test(sanitized);
};

// Rate limiting helper
async function checkSMSRateLimit(phone: string): Promise<boolean> {
  const key = `sms:rate:${sanitizePhone(phone)}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, SMS_RATE_LIMIT_WINDOW);
  }
  
  return current <= SMS_RATE_LIMIT_MAX;
}

// Update provider health
function updateProviderHealth(provider: ProviderType, success: boolean, error?: string): void {
  const health = providerHealth[provider];
  health.lastCheck = new Date();
  
  if (success) {
    health.successCount++;
    health.isHealthy = true;
    health.lastError = undefined;
  } else {
    health.errorCount++;
    health.lastError = error;
    
    // Mark as unhealthy after 3 consecutive errors
    if (health.errorCount >= 3) {
      health.isHealthy = false;
      log.warn(`Provider ${provider} marked as unhealthy`, { 
        errorCount: health.errorCount, 
        lastError: error 
      });
    }
  }
}

// Get healthy providers in priority order
function getHealthyProviders(): ProviderType[] {
  return PROVIDER_PRIORITY.filter(provider => providerHealth[provider].isHealthy);
}

// Check if provider is configured
function isProviderConfigured(provider: ProviderType): boolean {
  switch (provider) {
    case 'infobip':
      return !!(process.env.INFOBIP_API_KEY && process.env.INFOBIP_API_URL);
    case 'termii':
      return !!(process.env.TERMII_API_KEY && process.env.TERMII_API_URL);
    case 'africastalking':
      return !!(process.env.AT_API_KEY && process.env.AT_USERNAME);
    default:
      return false;
  }
}

// Send SMS with specific provider
async function sendSMSWithProvider(
  provider: ProviderType, 
  to: string, 
  message: string, 
  from?: string
): Promise<SMSResult> {
  const startTime = Date.now();
  
  try {
    log.info(`Attempting to send SMS via ${provider}`, { to, messageLength: message.length });
    
    let result;
    switch (provider) {
      case 'infobip':
        result = await sendSMSInfobip(to, message, from);
        break;
      case 'termii':
        result = await sendSMSTermii(to, message, from);
        break;
      case 'africastalking':
        result = await sendSMSViaAfricaTalking(to, message, from);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    
    const duration = Date.now() - startTime;
    updateProviderHealth(provider, true);
    
    log.info(`SMS sent successfully via ${provider}`, { 
      messageId: result.messageId, 
      duration,
      to 
    });
    
    return { 
      provider, 
      messageId: result.messageId, 
      success: true, 
      raw: result 
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    updateProviderHealth(provider, false, errorMessage);
    
    log.error(`Failed to send SMS via ${provider}`, { 
      err: error, 
      duration,
      to 
    });
    
    return { 
      provider, 
      success: false, 
      error: errorMessage 
    };
  }
}

// Africa's Talking implementation (kept for compatibility)
let AfricasTalking: any = null;

if (process.env.AT_API_KEY && process.env.AT_USERNAME) {
  try {
    AfricasTalking = require('africastalking').default ?? require('africastalking');
  } catch (err) {
    log.warn('AfricaTalking package not available', { err });
  }
}

async function sendSMSViaAfricaTalking(to: string, message: string, from?: string): Promise<any> {
  if (!AfricasTalking) {
    throw new Error('AfricaTalking client not initialized');
  }
  
  const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY!,
    username: process.env.AT_USERNAME!
  });
  
  const smsClient = at.SMS;
  const opts = { 
    to: [to], 
    message, 
    from: from || process.env.AT_SHORTCODE || process.env.AT_SHORT_CODE || 'TaxBridge' 
  };
  
  const res = await smsClient.send(opts);
  const messageId = res?.SMSMessageData?.Message?.[0]?.messageId;
  
  return { provider: 'africastalking', messageId, raw: res };
}

export async function sendSMS(to: string, message: string, from?: string): Promise<SMSResult> {
  const startTime = Date.now();
  
  // Input validation
  if (!to || !message) {
    const error = 'Invalid SMS params: recipient and message are required';
    log.error('SMS validation failed', { to, message: !!message });
    throw new Error(error);
  }
  
  const sanitizedPhone = sanitizePhone(to);
  const sanitizedMessage = sanitizeMessage(message);
  
  if (!validatePhone(sanitizedPhone)) {
    const error = `Invalid phone number format: ${to}`;
    log.error('Phone validation failed', { to, sanitizedPhone });
    throw new Error(error);
  }
  
  if (!sanitizedMessage.trim()) {
    const error = 'Message cannot be empty after sanitization';
    log.error('Message validation failed', { originalLength: message.length, sanitizedLength: sanitizedMessage.length });
    throw new Error(error);
  }
  
  // Rate limiting check
  if (!(await checkSMSRateLimit(sanitizedPhone))) {
    const error = 'Rate limit exceeded for SMS sending';
    log.warn('SMS rate limit exceeded', { to: sanitizedPhone });
    throw new Error(error);
  }
  
  // Get healthy providers in priority order
  const healthyProviders = getHealthyProviders();
  const configuredProviders = healthyProviders.filter(isProviderConfigured);
  
  if (configuredProviders.length === 0) {
    log.error('No SMS providers are configured and healthy');
    return { 
      provider: 'none', 
      success: false, 
      error: 'No SMS providers available' 
    };
  }
  
  log.info('Attempting SMS delivery with failover', { 
    to: sanitizedPhone, 
    providers: configuredProviders,
    messageLength: sanitizedMessage.length 
  });
  
  // Try each provider in order (failover)
  let lastError: string | undefined;
  for (const provider of configuredProviders) {
    try {
      const result = await sendSMSWithProvider(provider, sanitizedPhone, sanitizedMessage, from);
      
      if (result.success) {
        const duration = Date.now() - startTime;
        log.info('SMS delivery successful', { 
          provider, 
          messageId: result.messageId,
          to: sanitizedPhone,
          duration,
          fallbackUsed: configuredProviders[0] !== provider
        });
        
        // Log to database for audit
        await logSMSDelivery(sanitizedPhone, result.messageId, provider, 'sent', {
          messageLength: sanitizedMessage.length,
          duration,
          fallbackUsed: configuredProviders[0] !== provider
        });
        
        return {
          ...result,
          fallbackUsed: configuredProviders[0] !== provider
        };
      } else {
        lastError = result.error;
        log.warn(`Provider ${provider} failed, trying next`, { error: result.error });
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Provider ${provider} threw error, trying next`, { err: error });
    }
  }
  
  // All providers failed
  const duration = Date.now() - startTime;
  log.error('All SMS providers failed', { 
    to: sanitizedPhone, 
    providers: configuredProviders,
    lastError,
    duration
  });
  
  // Log failed delivery attempt
  await logSMSDelivery(sanitizedPhone, undefined, 'failed', 'failed', {
    error: lastError,
    providersAttempted: configuredProviders,
    duration
  });
  
  return { 
    provider: configuredProviders[0] || 'none', 
    success: false, 
    error: lastError || 'All providers failed' 
  };
}

// Log SMS delivery attempts to database
async function logSMSDelivery(
  to: string, 
  messageId: string | undefined, 
  provider: string, 
  status: string, 
  metadata?: any
): Promise<void> {
  try {
    await prisma.sMSDelivery.create({
      data: {
        to,
        messageId,
        provider,
        status,
        providerPayload: metadata || {}
      }
    });
    await prisma.$disconnect();
  } catch (error) {
    log.error('Failed to log SMS delivery to database', { err: error, to, provider });
  }
}

// Provider health monitoring
export function getProviderHealth(): Record<ProviderType, ProviderHealth> {
  return { ...providerHealth };
}

// Reset provider health (for manual recovery)
export function resetProviderHealth(provider: ProviderType): void {
  const health = providerHealth[provider];
  health.isHealthy = true;
  health.errorCount = 0;
  health.successCount = 0;
  health.lastError = undefined;
  health.lastCheck = new Date();
  
  log.info(`Provider ${provider} health reset`, { provider });
}

// Health check all providers
export async function healthCheckAllProviders(): Promise<void> {
  log.info('Starting provider health checks');
  
  for (const provider of PROVIDER_PRIORITY) {
    if (!isProviderConfigured(provider)) {
      log.info(`Provider ${provider} not configured, skipping health check`);
      continue;
    }
    
    try {
      // Send a test SMS to a test number (if configured) or just check API connectivity
      const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
      const testMessage = 'TaxBridge Health Check';
      
      await sendSMSWithProvider(provider, testPhone, testMessage);
      log.info(`Provider ${provider} health check passed`);
    } catch (error) {
      log.warn(`Provider ${provider} health check failed`, { err: error });
    }
  }
}

// Export signature verification functions
export { verifyInfobipSignature, parseInfobipDelivery, verifyTermiiSignature, parseTermiiDelivery };

// Export types for external use
export type { SMSResult, ProviderType, ProviderHealth };

export default { 
  sendSMS, 
  getProviderHealth, 
  resetProviderHealth, 
  healthCheckAllProviders,
  verifyInfobipSignature, 
  parseInfobipDelivery, 
  verifyTermiiSignature, 
  parseTermiiDelivery 
};
