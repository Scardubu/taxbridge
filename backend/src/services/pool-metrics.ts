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
  private lastPostgresErrorLogAt = 0;
  private lastPostgresErrorSignature: string | null = null;
  private metricsCache: { metrics: PoolMetrics; cachedAt: number } | null = null;
  private readonly CACHE_TTL_MS = 30000; // Cache metrics for 30 seconds

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
    // Return cached metrics if fresh (within TTL)
    if (this.metricsCache && Date.now() - this.metricsCache.cachedAt < this.CACHE_TTL_MS) {
      return this.metricsCache.metrics;
    }

    const metrics: PoolMetrics = {
      postgres: await this.getPostgresMetrics(),
      redis: await this.getRedisMetrics(),
      timestamp: new Date(),
    };

    // Cache the metrics
    this.metricsCache = { metrics, cachedAt: Date.now() };

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
   * 
   * Note: pg_stat_activity requires elevated privileges on many managed DBs.
   * Fallback to Prisma internal pool if query fails.
   */
  private async getPostgresMetrics(): Promise<PoolMetrics['postgres']> {
    try {
      const prisma = getPrismaClient();
      const poolMax = Number(process.env.DATABASE_POOL_MAX || 10);
      const dbUrl = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || '';
      
      // Detect pooler/transaction mode environments:
      // - pgbouncer=true (explicit)
      // - pooler.supabase.com (Supabase pooler)
      // - Port 6543 (Supabase transaction pooler default)
      // - transaction_mode=true / statement_mode=true
      const isPoolerMode = 
        dbUrl.includes('pgbouncer=true') || 
        dbUrl.includes('pooler.supabase.com') ||
        dbUrl.includes(':6543') ||
        dbUrl.includes('transaction') ||
        dbUrl.includes('statement');

      // Skip expensive pg_stat_activity query in pooler/transaction mode
      // These environments don't support system catalog queries and cause 700-1300ms+ delays
      // (Observed in production: "Slow query detected", "action":"queryRaw", "duration":1307")
      if (isPoolerMode) {
        // Lightweight health check only (no system catalogs or pg_stat views)
        await prisma.$queryRaw`SELECT 1 AS health`;
        return {
          activeConnections: 1,
          idleConnections: poolMax - 1,
          maxConnections: poolMax,
          utilizationPercent: Math.round((1 / poolMax) * 100),
          slowQueries: this.slowQueryCount,
        };
      }

      // Try to query pg_stat_activity (may fail on managed DBs without superuser)
      try {
        const result: any = await prisma.$queryRaw`
          SELECT 
            COUNT(*) FILTER (WHERE state = 'active') as active,
            COUNT(*) FILTER (WHERE state = 'idle') as idle
          FROM pg_stat_activity
          WHERE datname = current_database()
        `;

        const active = Number(result[0]?.active || 0);
        const idle = Number(result[0]?.idle || 0);

        return {
          activeConnections: active,
          idleConnections: idle,
          maxConnections: poolMax,
          utilizationPercent: Math.round((active / poolMax) * 100),
          slowQueries: this.slowQueryCount,
        };
      } catch (statError: any) {
        // Fallback: use Prisma pool config (no DB query needed)
        const poolMax = Number(process.env.DATABASE_POOL_MAX || 10);
        
        // Log privilege error once, then suppress
        const now = Date.now();
        const signature = 'pg_stat_activity_access_denied';
        const shouldLog = signature !== this.lastPostgresErrorSignature || now - this.lastPostgresErrorLogAt >= 300000;

        if (shouldLog) {
          this.lastPostgresErrorSignature = signature;
          this.lastPostgresErrorLogAt = now;
          log.info('pg_stat_activity unsupported (managed DB or pooler), using lightweight fallback');
        }

        return {
          activeConnections: 1, // Assume at least 1 (this query)
          idleConnections: poolMax - 1,
          maxConnections: poolMax,
          utilizationPercent: Math.round((1 / poolMax) * 100),
          slowQueries: this.slowQueryCount,
        };
      }
    } catch (error) {
      const now = Date.now();
      const signature =
        error instanceof Error
          ? `${error.name}:${error.message}`
          : error
            ? String(error)
            : 'unknown';

      // Avoid noisy logs during cold start / DB misconfig; log at most every 5 minutes unless error changes.
      const shouldLog =
        signature !== this.lastPostgresErrorSignature || now - this.lastPostgresErrorLogAt >= 300000;

      if (shouldLog) {
        this.lastPostgresErrorSignature = signature;
        this.lastPostgresErrorLogAt = now;
        log.warn('Failed to get Postgres metrics', { error });
      } else {
        log.debug('Failed to get Postgres metrics (suppressed)', { signature });
      }

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

      if (!redis) {
        return {
          status: 'disconnected',
          connected: false,
          ready: false,
          commandsSent: 0,
        };
      }

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
