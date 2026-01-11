import { createLogger } from '../lib/logger';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from '../queue/client';
import { collectMetrics, getHealthSummary } from './monitoring';
import { healthCheckAllProviders } from '../integrations/comms/client';
import { logSecurityEvent } from '../lib/security';

const log = createLogger('error-recovery');
const prisma = new PrismaClient();
const redis = getRedisConnection();

// Error classification
export enum ErrorType {
  DATABASE = 'database',
  REDIS = 'redis',
  SMS_PROVIDER = 'sms_provider',
  DIGITAX = 'digitax',
  REMITA = 'remita',
  USSD = 'ussd',
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error interface
interface ErrorContext {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: Error | string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

// Recovery strategies
interface RecoveryStrategy {
  name: string;
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  shouldRetry: (error: ErrorContext) => boolean;
  onRetry: (attempt: number, error: ErrorContext) => void;
  onMaxRetriesExceeded: (error: ErrorContext) => void;
}

// Default recovery strategies
const RECOVERY_STRATEGIES: Record<ErrorType, RecoveryStrategy> = {
  [ErrorType.DATABASE]: {
    name: 'database-reconnection',
    maxRetries: 5,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    shouldRetry: (error) => {
      const retryableErrors = ['connection', 'timeout', 'pool', 'ECONNRESET'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('Database connection retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('Database recovery failed, switching to read-only mode', { error });
      process.env.DATABASE_READ_ONLY = 'true';
    }
  },
  
  [ErrorType.REDIS]: {
    name: 'redis-reconnection',
    maxRetries: 3,
    retryDelay: 500,
    backoffMultiplier: 2,
    maxDelay: 10000,
    shouldRetry: (error) => {
      const retryableErrors = ['connection', 'timeout', 'ECONNRESET', 'ECONNREFUSED'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('Redis connection retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('Redis recovery failed, disabling cache', { error });
      process.env.CACHE_DISABLED = 'true';
    }
  },
  
  [ErrorType.SMS_PROVIDER]: {
    name: 'sms-provider-failover',
    maxRetries: 2,
    retryDelay: 2000,
    backoffMultiplier: 1.5,
    maxDelay: 15000,
    shouldRetry: (error) => {
      const retryableErrors = ['timeout', 'rate_limit', 'service_unavailable'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('SMS provider retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('SMS provider recovery failed, marking as unhealthy', { error });
    }
  },
  
  [ErrorType.DIGITAX]: {
    name: 'digitax-retry',
    maxRetries: 3,
    retryDelay: 5000,
    backoffMultiplier: 2,
    maxDelay: 60000,
    shouldRetry: (error) => {
      const retryableErrors = ['timeout', '503', '502', '429'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('DigiTax API retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('DigiTax recovery failed, switching to mock mode', { error });
      process.env.DIGITAX_MOCK_MODE = 'true';
    }
  },
  
  [ErrorType.REMITA]: {
    name: 'remita-retry',
    maxRetries: 3,
    retryDelay: 3000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    shouldRetry: (error) => {
      const retryableErrors = ['timeout', '503', '502', '429'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('Remita API retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('Remita recovery failed, queueing for retry', { error });
    }
  },
  
  [ErrorType.USSD]: {
    name: 'ussd-session-recovery',
    maxRetries: 2,
    retryDelay: 1000,
    backoffMultiplier: 1,
    maxDelay: 5000,
    shouldRetry: (error) => {
      const retryableErrors = ['timeout', 'session', 'redis'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('USSD session retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('USSD recovery failed, ending session', { error });
    }
  },
  
  [ErrorType.NETWORK]: {
    name: 'network-retry',
    maxRetries: 3,
    retryDelay: 2000,
    backoffMultiplier: 2,
    maxDelay: 20000,
    shouldRetry: (error) => {
      const retryableErrors = ['timeout', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('Network request retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('Network recovery failed', { error });
    }
  },
  
  [ErrorType.VALIDATION]: {
    name: 'validation-fail',
    maxRetries: 0,
    retryDelay: 0,
    backoffMultiplier: 1,
    maxDelay: 0,
    shouldRetry: () => false,
    onRetry: () => {},
    onMaxRetriesExceeded: (error) => {
      log.warn('Validation error, no retry', { error });
    }
  },
  
  [ErrorType.AUTHENTICATION]: {
    name: 'auth-fail',
    maxRetries: 0,
    retryDelay: 0,
    backoffMultiplier: 1,
    maxDelay: 0,
    shouldRetry: () => false,
    onRetry: () => {},
    onMaxRetriesExceeded: (error) => {
      logSecurityEvent('authentication_failure', {
        error: error.message,
        severity: 'critical'
      }, 'critical');
    }
  },
  
  [ErrorType.RATE_LIMIT]: {
    name: 'rate-limit-backoff',
    maxRetries: 1,
    retryDelay: 60000,
    backoffMultiplier: 1,
    maxDelay: 60000,
    shouldRetry: () => true,
    onRetry: (attempt, error) => {
      log.warn('Rate limit hit, backing off', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.warn('Rate limit exceeded, blocking temporarily', { error });
    }
  },
  
  [ErrorType.SYSTEM]: {
    name: 'system-recovery',
    maxRetries: 2,
    retryDelay: 5000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    shouldRetry: (error) => {
      const retryableErrors = ['memory', 'disk', 'timeout'];
      return retryableErrors.some(keyword => 
        error.message.toLowerCase().includes(keyword)
      );
    },
    onRetry: (attempt, error) => {
      log.warn('System error retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('System recovery failed, initiating graceful shutdown', { error });
      process.exit(1);
    }
  },
  
  [ErrorType.UNKNOWN]: {
    name: 'unknown-error',
    maxRetries: 1,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    shouldRetry: () => true,
    onRetry: (attempt, error) => {
      log.warn('Unknown error retry', { attempt, error: error.message });
    },
    onMaxRetriesExceeded: (error) => {
      log.error('Unknown error recovery failed', { error });
    }
  }
};

// Error classifier
export function classifyError(error: Error | string): ErrorType {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('database') || lowerMessage.includes('prisma') || 
      lowerMessage.includes('sql') || lowerMessage.includes('connection')) {
    return ErrorType.DATABASE;
  }
  
  if (lowerMessage.includes('redis') || lowerMessage.includes('cache')) {
    return ErrorType.REDIS;
  }
  
  if (lowerMessage.includes('sms') || lowerMessage.includes('africastalking') || 
      lowerMessage.includes('infobip') || lowerMessage.includes('termii')) {
    return ErrorType.SMS_PROVIDER;
  }
  
  if (lowerMessage.includes('digitax') || lowerMessage.includes('nrs')) {
    return ErrorType.DIGITAX;
  }
  
  if (lowerMessage.includes('remita') || lowerMessage.includes('rrr') || 
      lowerMessage.includes('payment')) {
    return ErrorType.REMITA;
  }
  
  if (lowerMessage.includes('ussd') || lowerMessage.includes('session')) {
    return ErrorType.USSD;
  }
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('econnreset') || 
      lowerMessage.includes('econnrefused') || lowerMessage.includes('enotfound')) {
    return ErrorType.NETWORK;
  }
  
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
      lowerMessage.includes('required')) {
    return ErrorType.VALIDATION;
  }
  
  if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || 
      lowerMessage.includes('forbidden')) {
    return ErrorType.AUTHENTICATION;
  }
  
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return ErrorType.RATE_LIMIT;
  }
  
  if (lowerMessage.includes('memory') || lowerMessage.includes('disk') || 
      lowerMessage.includes('system')) {
    return ErrorType.SYSTEM;
  }
  
  return ErrorType.UNKNOWN;
}

// Severity classifier
export function classifySeverity(error: Error | string, type: ErrorType): ErrorSeverity {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('critical') || lowerMessage.includes('fatal') ||
      type === ErrorType.SYSTEM || type === ErrorType.DATABASE) {
    return ErrorSeverity.CRITICAL;
  }
  
  if (lowerMessage.includes('security') || lowerMessage.includes('breach') ||
      type === ErrorType.AUTHENTICATION || type === ErrorType.SMS_PROVIDER) {
    return ErrorSeverity.HIGH;
  }
  
  if (type === ErrorType.DIGITAX || type === ErrorType.REMITA || 
      type === ErrorType.USSD || type === ErrorType.NETWORK) {
    return ErrorSeverity.MEDIUM;
  }
  
  return ErrorSeverity.LOW;
}

// Main error recovery class
export class ErrorRecovery {
  private retryCounts: Map<string, number> = new Map();
  private lastRetryTime: Map<string, number> = new Map();
  
  createContext(
    error: Error | string,
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): ErrorContext {
    const type = classifyError(error);
    const severity = classifySeverity(error, type);
    
    return {
      type,
      severity,
      message: typeof error === 'string' ? error : error.message,
      originalError: error,
      timestamp: new Date(),
      userId,
      sessionId,
      requestId,
      metadata,
      stack: typeof error === 'object' ? error.stack : undefined
    };
  }
  
  async handleError(
    error: Error | string,
    operation: () => Promise<any>,
    userId?: string,
    sessionId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const context = this.createContext(error, userId, sessionId, requestId, metadata);
    const strategy = RECOVERY_STRATEGIES[context.type];
    const errorKey = `${context.type}:${userId || 'anonymous'}:${sessionId || 'nosession'}`;
    
    log.error('Error occurred', {
      type: context.type,
      severity: context.severity,
      message: context.message,
      userId,
      sessionId,
      requestId
    });
    
    if (!strategy.shouldRetry(context)) {
      strategy.onMaxRetriesExceeded(context);
      throw error;
    }
    
    const retryCount = this.retryCounts.get(errorKey) || 0;
    if (retryCount >= strategy.maxRetries) {
      strategy.onMaxRetriesExceeded(context);
      this.retryCounts.delete(errorKey);
      this.lastRetryTime.delete(errorKey);
      throw error;
    }
    
    const lastRetry = this.lastRetryTime.get(errorKey) || 0;
    const baseDelay = strategy.retryDelay * Math.pow(strategy.backoffMultiplier, retryCount);
    const delay = Math.min(baseDelay, strategy.maxDelay);
    const timeSinceLastRetry = Date.now() - lastRetry;
    const actualDelay = Math.max(0, delay - timeSinceLastRetry);
    
    if (actualDelay > 0) {
      await this.sleep(actualDelay);
    }
    
    this.retryCounts.set(errorKey, retryCount + 1);
    this.lastRetryTime.set(errorKey, Date.now());
    
    strategy.onRetry(retryCount + 1, context);
    
    try {
      const result = await operation();
      
      this.retryCounts.delete(errorKey);
      this.lastRetryTime.delete(errorKey);
      
      log.info('Operation succeeded after retry', {
        type: context.type,
        retryCount: retryCount + 1,
        userId,
        sessionId
      });
      
      return result;
    } catch (retryError) {
      const errorToHandle = retryError instanceof Error ? retryError : new Error(String(retryError));
      return this.handleError(
        errorToHandle,
        operation,
        userId,
        sessionId,
        requestId,
        metadata
      );
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getRetryStats(): Record<string, { count: number; lastRetry: number }> {
    const stats: Record<string, { count: number; lastRetry: number }> = {};
    
    for (const [key, count] of this.retryCounts) {
      stats[key] = {
        count,
        lastRetry: this.lastRetryTime.get(key) || 0
      };
    }
    
    return stats;
  }
  
  clearRetryTracking(type?: ErrorType): void {
    if (type) {
      const keysToDelete = Array.from(this.retryCounts.keys()).filter(key => 
        key.startsWith(`${type}:`)
      );
      
      for (const key of keysToDelete) {
        this.retryCounts.delete(key);
        this.lastRetryTime.delete(key);
      }
    } else {
      this.retryCounts.clear();
      this.lastRetryTime.clear();
    }
  }
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000,
    private readonly resetTimeout: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        log.info('Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'HALF_OPEN') {
        this.reset();
        log.info('Circuit breaker reset to CLOSED');
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      log.warn('Circuit breaker opened', { failures: this.failures });
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  getState(): string {
    return this.state;
  }
  
  getFailures(): number {
    return this.failures;
  }
}

// Global instances
export const errorRecovery = new ErrorRecovery();

export const circuitBreakers = {
  digitax: new CircuitBreaker(5, 60000, 30000),
  remita: new CircuitBreaker(3, 60000, 30000),
  sms: new CircuitBreaker(10, 60000, 30000),
  database: new CircuitBreaker(5, 60000, 30000),
  redis: new CircuitBreaker(3, 60000, 30000)
};

// Health check with recovery
export async function healthCheckWithRecovery(): Promise<void> {
  try {
    await circuitBreakers.database.execute(async () => {
      await prisma.$queryRaw`SELECT 1`;
    });
    
    await circuitBreakers.redis.execute(async () => {
      const redis = getRedisConnection();
      await redis.ping();
    });
    
    await healthCheckAllProviders();
    
    log.info('All health checks passed');
  } catch (error) {
    log.error('Health check failed', { err: error });
    
    const errorToHandle = error instanceof Error ? error : new Error(String(error));
    await errorRecovery.handleError(
      errorToHandle,
      async () => {
        await healthCheckWithRecovery();
      }
    );
  }
}

// Automatic recovery monitoring
export async function startRecoveryMonitoring(): Promise<void> {
  const interval = setInterval(async () => {
    try {
      for (const [name, breaker] of Object.entries(circuitBreakers)) {
        if (breaker.getState() === 'OPEN') {
          log.warn(`Circuit breaker ${name} is OPEN`, {
            failures: breaker.getFailures()
          });
        }
      }
      
      const retryStats = errorRecovery.getRetryStats();
      if (Object.keys(retryStats).length > 0) {
        log.debug('Retry statistics', { retryStats });
      }
      
      if (Date.now() % 300000 < 60000) {
        await healthCheckWithRecovery();
      }
    } catch (error) {
      log.error('Recovery monitoring failed', { err: error });
    }
  }, 60000);
  
  log.info('Recovery monitoring started');
}

export default {
  ErrorRecovery,
  CircuitBreaker,
  errorRecovery,
  circuitBreakers,
  healthCheckWithRecovery,
  startRecoveryMonitoring,
  classifyError,
  classifySeverity,
  RECOVERY_STRATEGIES
};
