import { createLogger } from '../lib/logger';
import { getRedisConnection } from '../queue/client';
import { prisma } from '../lib/prisma';

const log = createLogger('monitoring');
const redis = getRedisConnection();

// Metrics interfaces
interface DatabaseMetrics {
  connected: boolean;
  responseTime: number;
  connectionCount: number;
  queryCount: number;
  errorCount: number;
}

interface RedisMetrics {
  connected: boolean;
  responseTime: number;
  memory: number;
  keyCount: number;
}

interface SMSMetrics {
  totalSent: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageResponseTime: number;
  providerStats: Record<string, {
    sent: number;
    success: number;
    failure: number;
    avgResponseTime: number;
  }>;
}

interface USSDMetrics {
  activeSessions: number;
  totalRequests: number;
  errorRate: number;
  averageSessionDuration: number;
}

interface QueueMetrics {
  invoiceSync: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  payment: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
}

interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memory: MemoryMetrics;
  database: DatabaseMetrics;
  redis: RedisMetrics;
  sms: SMSMetrics;
  ussd: USSDMetrics;
  queue: QueueMetrics;
}

// Metrics storage
const metricsHistory: SystemMetrics[] = [];
const MAX_HISTORY_SIZE = 1440; // 24 hours of 1-minute data

// Alert thresholds
const ALERT_THRESHOLDS = {
  memoryUsage: 85, // percentage
  databaseResponseTime: 1000, // milliseconds
  redisResponseTime: 500, // milliseconds
  errorRate: 5, // percentage
  smsFailureRate: 10, // percentage
  queueDepth: 100, // number of jobs
  responseTime: 300 // API response time
};

// Get memory usage
function getMemoryUsage(): MemoryMetrics {
  const usage = process.memoryUsage();
  const totalMemory = require('os').totalmem();
  const freeMemory = require('os').freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    used: usedMemory,
    total: totalMemory,
    percentage: Math.round((usedMemory / totalMemory) * 100),
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal
  };
}

// Get database metrics
async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  const startTime = Date.now();
  
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    // Get connection pool stats (would need to implement connection tracking)
    return {
      connected: true,
      responseTime,
      connectionCount: 1, // Simplified
      queryCount: 0, // Would need query tracking
      errorCount: 0 // Would need error tracking
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      connectionCount: 0,
      queryCount: 0,
      errorCount: 1
    };
  }
}

// Get Redis metrics
async function getRedisMetrics(): Promise<RedisMetrics> {
  const startTime = Date.now();
  
  try {
    // Test Redis connection
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    // Get Redis info
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0;
    
    const keyCount = await redis.dbsize();

    return {
      connected: true,
      responseTime,
      memory,
      keyCount
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      memory: 0,
      keyCount: 0
    };
  }
}

// Get SMS metrics
async function getSMSMetrics(): Promise<SMSMetrics> {
  try {
    // Get SMS metrics from Redis or database
    const smsStats = await redis.hgetall('sms_metrics');
    
    let totalSent = 0;
    let successCount = 0;
    let failureCount = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    const providerStats: Record<string, any> = {};

    for (const [provider, stats] of Object.entries(smsStats)) {
      const providerData = JSON.parse(stats as string);
      totalSent += providerData.sent || 0;
      successCount += providerData.success || 0;
      failureCount += providerData.failure || 0;
      totalResponseTime += providerData.totalResponseTime || 0;
      responseCount += providerData.responseCount || 0;

      providerStats[provider] = {
        sent: providerData.sent || 0,
        success: providerData.success || 0,
        failure: providerData.failure || 0,
        avgResponseTime: providerData.responseCount > 0 
          ? providerData.totalResponseTime / providerData.responseCount 
          : 0
      };
    }

    const successRate = totalSent > 0 ? Math.round((successCount / totalSent) * 100) : 100;
    const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      totalSent,
      successCount,
      failureCount,
      successRate,
      averageResponseTime,
      providerStats
    };
  } catch (error) {
    log.error('Failed to get SMS metrics', { error });
    return {
      totalSent: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 100,
      averageResponseTime: 0,
      providerStats: {}
    };
  }
}

// Get USSD metrics
async function getUSSDMetrics(): Promise<USSDMetrics> {
  try {
    // Get USSD session metrics from Redis
    const activeSessions = await redis.scard('ussd:active_sessions');
    
    // Get request metrics (simplified)
    const requestStats = await redis.hgetall('ussd:request_stats');
    const totalRequests = parseInt(requestStats.total || '0');
    const errorRequests = parseInt(requestStats.errors || '0');
    const errorRate = totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100) : 0;

    return {
      activeSessions,
      totalRequests,
      errorRate,
      averageSessionDuration: 0 // Would need session tracking
    };
  } catch (error) {
    log.error('Failed to get USSD metrics', { error });
    return {
      activeSessions: 0,
      totalRequests: 0,
      errorRate: 0,
      averageSessionDuration: 0
    };
  }
}

// Get queue metrics
async function getQueueMetrics(): Promise<QueueMetrics> {
  try {
    const invoiceSyncQueue = await redis.llen('bull:invoice-sync:waiting');
    const paymentQueue = await redis.llen('bull:payment-webhook:waiting');
    
    // This is a simplified version - in production, use BullMQ's built-in metrics
    return {
      invoiceSync: {
        waiting: invoiceSyncQueue,
        active: 0, // Would need to get from BullMQ
        completed: 0,
        failed: 0
      },
      payment: {
        waiting: paymentQueue,
        active: 0,
        completed: 0,
        failed: 0
      }
    };
  } catch (error) {
    log.error('Failed to get queue metrics', { error });
    return {
      invoiceSync: { waiting: 0, active: 0, completed: 0, failed: 0 },
      payment: { waiting: 0, active: 0, completed: 0, failed: 0 }
    };
  }
}

// Collect all system metrics
export async function collectMetrics(): Promise<SystemMetrics> {
  const startTime = Date.now();
  
  try {
    const [database, redisMetrics, sms, ussd, queue] = await Promise.all([
      getDatabaseMetrics(),
      getRedisMetrics(),
      getSMSMetrics(),
      getUSSDMetrics(),
      getQueueMetrics()
    ]);
    
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: getMemoryUsage(),
      database,
      redis: redisMetrics,
      sms,
      ussd,
      queue
    };
    
    // Store in history (circular buffer)
    metricsHistory.push(metrics);
    if (metricsHistory.length > MAX_HISTORY_SIZE) {
      metricsHistory.shift();
    }
    
    const duration = Date.now() - startTime;
    log.info('Metrics collected', { duration });
    
    return metrics;
  } catch (error) {
    log.error('Failed to collect metrics', { error });
    throw error;
  }
}

// Check for alerts
export function checkAlerts(metrics: SystemMetrics): string[] {
  const alerts: string[] = [];
  
  // Memory usage alert
  if (metrics.memory.percentage > ALERT_THRESHOLDS.memoryUsage) {
    alerts.push(`HIGH_MEMORY_USAGE: ${metrics.memory.percentage}% usage`);
  }
  
  // Database alerts
  if (!metrics.database.connected) {
    alerts.push('DATABASE_DISCONNECTED: Database is not responding');
  } else if (metrics.database.responseTime > ALERT_THRESHOLDS.databaseResponseTime) {
    alerts.push(`DATABASE_SLOW: ${metrics.database.responseTime}ms response time`);
  }
  
  // Redis alerts
  if (!metrics.redis.connected) {
    alerts.push('REDIS_DISCONNECTED: Redis is not responding');
  } else if (metrics.redis.responseTime > ALERT_THRESHOLDS.redisResponseTime) {
    alerts.push(`REDIS_SLOW: ${metrics.redis.responseTime}ms response time`);
  }
  
  // SMS alerts
  if (metrics.sms.successRate < (100 - ALERT_THRESHOLDS.smsFailureRate)) {
    alerts.push(`SMS_HIGH_FAILURE_RATE: ${100 - metrics.sms.successRate}% failure rate`);
  }
  
  // USSD alerts
  if (metrics.ussd.errorRate > ALERT_THRESHOLDS.errorRate) {
    alerts.push(`USSD_HIGH_ERROR_RATE: ${metrics.ussd.errorRate}% error rate`);
  }
  
  // Queue alerts
  const totalQueueDepth = metrics.queue.invoiceSync.waiting + metrics.queue.payment.waiting;
  if (totalQueueDepth > ALERT_THRESHOLDS.queueDepth) {
    alerts.push(`QUEUE_BACKLOG: ${totalQueueDepth} jobs waiting`);
  }
  
  if (alerts.length > 0) {
    log.warn('System alerts triggered', { alerts, metrics });
  }
  
  return alerts;
}

// Get metrics history
export function getMetricsHistory(minutes: number = 60): SystemMetrics[] {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return metricsHistory.filter(m => m.timestamp >= cutoff);
}

// Get system health summary
export function getHealthSummary(metrics: SystemMetrics): {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  uptime: number;
} {
  const alerts = checkAlerts(metrics);
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  if (alerts.some(alert => alert.includes('DISCONNECTED') || alert.includes('HIGH'))) {
    status = 'critical';
  } else if (alerts.length > 0) {
    status = 'warning';
  }
  
  return {
    status,
    issues: alerts,
    uptime: metrics.uptime
  };
}

export default {
  collectMetrics,
  checkAlerts,
  getMetricsHistory,
  getHealthSummary,
  ALERT_THRESHOLDS
};
