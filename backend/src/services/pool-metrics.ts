/**
 * Connection Pool Metrics Service
 * 
 * Monitors PostgreSQL and Redis connection pool health.
 * Provides metrics for observability and alerts when pools are under pressure.
 */

import { createLogger } from '../lib/logger';
import { getPrismaClient } from '../lib/prisma';
import { getRedisConnection } from '../queue/client';
import * as Sentry from '@sentry/node';

const log = createLogger('pool-metrics');

export interface PoolMetrics {
  postgres: {
    activeConnections: number;
    idleConnections: number;
    maxConnections: number;
    utilizationPercent: number;
    slowQueries: number;
  };
  redis: {
    status: string;
    connected: boolean;
    ready: boolean;
    commandsSent: number;
  };
  timestamp: Date;
}

const METRICS_COLLECTION_INTERVAL = Number(process.env.POOL_METRICS_INTERVAL_MS || '60000'); // 1 minute
const UTILIZATION_WARNING_THRESHOLD = Number(process.env.POOL_UTILIZATION_WARNING || '0.8'); // 80%

export class ConnectionPoolMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private slowQueryCount = 0;

  /**
   * Start collecting pool metrics
   */
  start(): void {
    if (this.intervalId) {
      log.warn('Pool metrics monitor already running');
      return;
    }

    log.info('Starting connection pool metrics monitor', {
      interval: METRICS_COLLECTION_INTERVAL,
      warningThreshold: UTILIZATION_WARNING_THRESHOLD,
    });

    // Initial collection
    this.collectMetrics();

    // Periodic collection
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, METRICS_COLLECTION_INTERVAL);
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Pool metrics monitor stopped');
    }
  }

  /**
   * Collect current pool metrics
   */
  async collectMetrics(): Promise<PoolMetrics> {
    const metrics: PoolMetrics = {
      postgres: await this.getPostgresMetrics(),
      redis: await this.getRedisMetrics(),
      timestamp: new Date(),
    };

    // Log metrics
    log.debug('Connection pool metrics', {
      postgresActive: metrics.postgres.activeConnections,
      postgresIdle: metrics.postgres.idleConnections,
      postgresUtilization: metrics.postgres.utilizationPercent,
      redisConnected: metrics.redis.connected,
      redisReady: metrics.redis.ready,
    });

    // Check for warnings
    if (metrics.postgres.utilizationPercent >= UTILIZATION_WARNING_THRESHOLD * 100) {
      log.warn('PostgreSQL connection pool utilization high', {
        utilization: metrics.postgres.utilizationPercent,
        activeConnections: metrics.postgres.activeConnections,
        maxConnections: metrics.postgres.maxConnections,
      });

      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage('High PostgreSQL connection pool utilization', {
          level: 'warning',
          tags: { component: 'pool-metrics' },
          contexts: { postgres: metrics.postgres },
        });
      }
    }

    return metrics;
  }

  /**
   * Get PostgreSQL pool metrics
   */
  private async getPostgresMetrics(): Promise<PoolMetrics['postgres']> {
    try {
      const prisma = getPrismaClient();

      // Query pg_stat_activity to get connection counts
      const result: any = await prisma.$queryRaw`
        SELECT 
          COUNT(*) FILTER (WHERE state = 'active') as active,
          COUNT(*) FILTER (WHERE state = 'idle') as idle,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `;

      const active = Number(result[0]?.active || 0);
      const idle = Number(result[0]?.idle || 0);
      const max = Number(result[0]?.max_connections || 100);

      return {
        activeConnections: active,
        idleConnections: idle,
        maxConnections: max,
        utilizationPercent: Math.round((active / max) * 100),
        slowQueries: this.slowQueryCount,
      };
    } catch (error) {
      log.error('Failed to get Postgres metrics', { error });
      return {
        activeConnections: -1,
        idleConnections: -1,
        maxConnections: -1,
        utilizationPercent: -1,
        slowQueries: this.slowQueryCount,
      };
    }
  }

  /**
   * Get Redis connection metrics
   */
  private async getRedisMetrics(): Promise<PoolMetrics['redis']> {
    try {
      const redis = getRedisConnection();

      return {
        status: redis.status,
        connected: redis.status === 'ready',
        ready: redis.status === 'ready',
        commandsSent: (redis as any).commandQueue?.length || 0,
      };
    } catch (error) {
      log.error('Failed to get Redis metrics', { error });
      return {
        status: 'error',
        connected: false,
        ready: false,
        commandsSent: -1,
      };
    }
  }

  /**
   * Increment slow query counter (called by Prisma middleware)
   */
  recordSlowQuery(): void {
    this.slowQueryCount++;
  }

  /**
   * Get current metrics without logging
   */
  async getCurrentMetrics(): Promise<PoolMetrics> {
    return {
      postgres: await this.getPostgresMetrics(),
      redis: await this.getRedisMetrics(),
      timestamp: new Date(),
    };
  }

  /**
   * Check if system is healthy
   */
  async isHealthy(): Promise<{ healthy: boolean; reason?: string }> {
    const metrics = await this.getCurrentMetrics();

    // Check Postgres utilization
    if (metrics.postgres.utilizationPercent >= 95) {
      return {
        healthy: false,
        reason: `PostgreSQL pool at ${metrics.postgres.utilizationPercent}% capacity`,
      };
    }

    // Check Redis connection
    if (!metrics.redis.connected) {
      return {
        healthy: false,
        reason: 'Redis connection not ready',
      };
    }

    return { healthy: true };
  }
}

// Singleton instance
let poolMonitor: ConnectionPoolMonitor | null = null;

/**
 * Initialize connection pool monitoring
 */
export function initializePoolMonitoring(): ConnectionPoolMonitor {
  if (!poolMonitor) {
    poolMonitor = new ConnectionPoolMonitor();
    poolMonitor.start();
  }
  return poolMonitor;
}

/**
 * Get pool monitor instance
 */
export function getPoolMonitor(): ConnectionPoolMonitor | null {
  return poolMonitor;
}

/**
 * Shutdown pool monitoring
 */
export function shutdownPoolMonitoring(): void {
  if (poolMonitor) {
    poolMonitor.stop();
    poolMonitor = null;
  }
}

/**
 * Record a slow query (called from Prisma middleware)
 */
export function recordSlowQuery(): void {
  if (poolMonitor) {
    poolMonitor.recordSlowQuery();
  }
}
