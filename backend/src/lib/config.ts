/**
 * TaxBridge - Centralized Configuration
 * 
 * Type-safe, validated configuration using Zod schemas.
 * Catches missing environment variables early at startup.
 * 
 * Usage:
 *   import { config } from './lib/config';
 *   console.log(config.server.port);
 */

import { z } from 'zod';

// Server configuration schema
const ServerConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  port: z.coerce.number().positive().default(3000),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

// Database configuration schema
const DatabaseConfigSchema = z.object({
  url: z.string().url().optional(),
  poolMin: z.coerce.number().nonnegative().default(2),
  poolMax: z.coerce.number().positive().default(10),
  connectionTimeout: z.coerce.number().positive().default(30000)
});

// Redis configuration schema
const RedisConfigSchema = z.object({
  url: z.string().url().optional(),
  host: z.string().default('localhost'),
  port: z.coerce.number().positive().default(6379),
  password: z.string().optional(),
  db: z.coerce.number().nonnegative().default(0),
  keyPrefix: z.string().default('taxbridge:')
});

// Duplo/DigiTax configuration schema
const DuploConfigSchema = z.object({
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  apiUrl: z.string().url().default('https://api.duplo.africa'),
  tokenEndpoint: z.string().default('/v1/oauth/token'),
  invoiceEndpoint: z.string().default('/v1/einvoice/submit'),
  timeout: z.coerce.number().positive().default(30000)
});

// Remita configuration schema
const RemitaConfigSchema = z.object({
  merchantId: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  serviceTypeId: z.string().min(1).optional(),
  apiUrl: z.string().url().default('https://remitademo.net/remita/exapp/api/v1/send/api'),
  webhookSecret: z.string().optional(),
  timeout: z.coerce.number().positive().default(30000)
});

// SMS configuration schema
const SMSConfigSchema = z.object({
  provider: z.enum(['africas_talking', 'termii', 'mock']).default('mock'),
  africasTalking: z.object({
    apiKey: z.string().optional(),
    username: z.string().optional().default('sandbox'),
    shortCode: z.string().optional()
  }).optional().default({ username: 'sandbox' }),
  termii: z.object({
    apiKey: z.string().optional(),
    senderId: z.string().optional()
  }).optional().default({})
});

// Queue configuration schema
const QueueConfigSchema = z.object({
  defaultAttempts: z.coerce.number().positive().default(3),
  backoffType: z.enum(['exponential', 'fixed']).default('exponential'),
  backoffDelay: z.coerce.number().positive().default(1000),
  removeOnComplete: z.coerce.number().nonnegative().default(100),
  removeOnFail: z.coerce.number().nonnegative().default(500)
});

// Security configuration schema
const SecurityConfigSchema = z.object({
  corsOrigins: z.string().default('*').transform(s => s.split(',')),
  rateLimitMax: z.coerce.number().positive().default(100),
  rateLimitWindow: z.coerce.number().positive().default(60000), // 1 minute in ms
  jwtSecret: z.string().min(32).optional(),
  jwtExpiresIn: z.string().default('24h'),
  bcryptRounds: z.coerce.number().positive().default(12),
  adminApiKeys: z.string().optional().transform(value => {
    if (!value) return [] as string[];
    return value
      .split(',')
      .map(key => key.trim())
      .filter(Boolean);
  }).default([])
});

// Feature flags schema
const FeatureFlagsSchema = z.object({
  enableOCR: z.coerce.boolean().default(true),
  enableUSSD: z.coerce.boolean().default(false),
  enableSMS: z.coerce.boolean().default(true),
  enableMetrics: z.coerce.boolean().default(true),
  enableHealthChecks: z.coerce.boolean().default(true),
  maintenanceMode: z.coerce.boolean().default(false)
});

// Full configuration schema
const ConfigSchema = z.object({
  server: ServerConfigSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema,
  duplo: DuploConfigSchema,
  remita: RemitaConfigSchema,
  sms: SMSConfigSchema,
  queue: QueueConfigSchema,
  security: SecurityConfigSchema,
  features: FeatureFlagsSchema
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables
 */
function loadConfig(): Config {
  // Map environment variables to config structure
  const rawConfig = {
    server: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      host: process.env.HOST,
      logLevel: process.env.LOG_LEVEL
    },
    database: {
      url: process.env.DATABASE_URL,
      poolMin: process.env.DB_POOL_MIN,
      poolMax: process.env.DB_POOL_MAX,
      connectionTimeout: process.env.DB_CONNECTION_TIMEOUT
    },
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
      keyPrefix: process.env.REDIS_KEY_PREFIX
    },
    duplo: {
      clientId: process.env.DUPLO_CLIENT_ID,
      clientSecret: process.env.DUPLO_CLIENT_SECRET,
      apiUrl: process.env.DUPLO_API_URL,
      tokenEndpoint: process.env.DUPLO_TOKEN_ENDPOINT,
      invoiceEndpoint: process.env.DUPLO_INVOICE_ENDPOINT,
      timeout: process.env.DUPLO_TIMEOUT
    },
    remita: {
      merchantId: process.env.REMITA_MERCHANT_ID,
      apiKey: process.env.REMITA_API_KEY,
      serviceTypeId: process.env.REMITA_SERVICE_TYPE_ID,
      apiUrl: process.env.REMITA_API_URL,
      webhookSecret: process.env.REMITA_WEBHOOK_SECRET,
      timeout: process.env.REMITA_TIMEOUT
    },
    sms: {
      provider: process.env.SMS_PROVIDER,
      africasTalking: {
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME,
        shortCode: process.env.AT_SHORT_CODE
      },
      termii: {
        apiKey: process.env.TERMII_API_KEY,
        senderId: process.env.TERMII_SENDER_ID
      }
    },
    queue: {
      defaultAttempts: process.env.QUEUE_DEFAULT_ATTEMPTS,
      backoffType: process.env.QUEUE_BACKOFF_TYPE,
      backoffDelay: process.env.QUEUE_BACKOFF_DELAY,
      removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE,
      removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL
    },
    security: {
      corsOrigins: process.env.CORS_ORIGINS,
      rateLimitMax: process.env.RATE_LIMIT_MAX,
      rateLimitWindow: process.env.RATE_LIMIT_WINDOW,
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      bcryptRounds: process.env.BCRYPT_ROUNDS,
      adminApiKeys: process.env.ADMIN_API_KEYS || process.env.ADMIN_API_KEY
    },
    features: {
      enableOCR: process.env.ENABLE_OCR,
      enableUSSD: process.env.ENABLE_USSD,
      enableSMS: process.env.ENABLE_SMS,
      enableMetrics: process.env.ENABLE_METRICS,
      enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS,
      maintenanceMode: process.env.MAINTENANCE_MODE
    }
  };

  try {
    return ConfigSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
      console.error(`Configuration validation failed:\n${issues}`);
      
      // In development, continue with defaults; in production, fail hard
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Invalid configuration: ${issues}`);
      }
    }
    throw error;
  }
}

// Export singleton config instance
export const config = loadConfig();

// Environment helpers
export const isDevelopment = config.server.nodeEnv === 'development';
export const isProduction = config.server.nodeEnv === 'production';
export const isTest = config.server.nodeEnv === 'test';
export const isStaging = config.server.nodeEnv === 'staging';

/**
 * Get a required configuration value or throw
 */
export function requireConfig<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Required configuration missing: ${name}`);
  }
  return value;
}

/**
 * Get Duplo credentials (throws if not configured in production)
 */
export function getDuploCredentials(): { clientId: string; clientSecret: string } {
  const { clientId, clientSecret } = config.duplo;
  
  if (!clientId || !clientSecret) {
    if (isProduction) {
      throw new Error('Duplo credentials are required in production');
    }
    return { clientId: 'mock-client-id', clientSecret: 'mock-client-secret' };
  }
  
  return { clientId, clientSecret };
}

/**
 * Get Remita credentials (throws if not configured in production)
 */
export function getRemitaCredentials(): { merchantId: string; apiKey: string; serviceTypeId: string } {
  const { merchantId, apiKey, serviceTypeId } = config.remita;
  
  if (!merchantId || !apiKey || !serviceTypeId) {
    if (isProduction) {
      throw new Error('Remita credentials are required in production');
    }
    return { merchantId: 'mock-merchant', apiKey: 'mock-key', serviceTypeId: 'mock-service' };
  }
  
  return { merchantId, apiKey, serviceTypeId };
}

export function getAdminApiKeys(): string[] {
  return config.security.adminApiKeys;
}

/**
 * Get database URL (throws if not configured)
 */
export function getDatabaseUrl(): string {
  return requireConfig(config.database.url, 'DATABASE_URL');
}

/**
 * Get Redis URL or construct from host/port
 */
export function getRedisUrl(): string {
  if (config.redis.url) {
    return config.redis.url;
  }
  
  const { host, port, password, db } = config.redis;
  const auth = password ? `:${password}@` : '';
  return `redis://${auth}${host}:${port}/${db}`;
}
