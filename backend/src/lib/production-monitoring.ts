/**
 * Production Monitoring & Performance Utilities
 * 
 * Comprehensive monitoring setup for production environment including:
 * - Query performance tracking
 * - Cache effectiveness monitoring
 * - Database health checks
 * - Alert configuration
 */

import * as Sentry from '@sentry/node';
import { getRedisConnection } from './redis';
import { prisma } from './prisma';

// =============================================================================
// Performance Metrics
// =============================================================================

export interface PerformanceMetrics {
  timestamp: string;
  database: {
    queryCount: number;
    slowQueries: number;
    averageQueryTime: number;
    connectionPoolUsage: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    evictions: number;
  };
  api: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

// =============================================================================
// Cache Effectiveness Monitoring
// =============================================================================

export async function getCacheMetrics(): Promise<{
  hitRate: number;
  missRate: number;
  totalRequests: number;
  evictions: number;
  memoryUsage: string;
  keyCount: number;
}> {
  const redis = getRedisConnection();
  
  if (!redis) {
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      evictions: 0,
      memoryUsage: '0MB',
      keyCount: 0,
    };
  }

  try {
    const info = await redis.info('stats');
    const memory = await redis.info('memory');
    const keyCount = await redis.dbsize();

    // Parse stats
    const statsLines = info.split('\r\n');
    const memoryLines = memory.split('\r\n');
    
    const getStatValue = (lines: string[], key: string): number => {
      const line = lines.find(l => l.startsWith(key));
      return line ? parseInt(line.split(':')[1]) : 0;
    };

    const hits = getStatValue(statsLines, 'keyspace_hits');
    const misses = getStatValue(statsLines, 'keyspace_misses');
    const evictions = getStatValue(statsLines, 'evicted_keys');
    const totalRequests = hits + misses;
    const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (misses / totalRequests) * 100 : 0;

    const usedMemory = getStatValue(memoryLines, 'used_memory');
    const memoryUsage = `${(usedMemory / 1024 / 1024).toFixed(2)}MB`;

    return {
      hitRate: parseFloat(hitRate.toFixed(2)),
      missRate: parseFloat(missRate.toFixed(2)),
      totalRequests,
      evictions,
      memoryUsage,
      keyCount,
    };
  } catch (error) {
    console.error('Error fetching cache metrics:', error);
    return {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      evictions: 0,
      memoryUsage: '0MB',
      keyCount: 0,
    };
  }
}

// =============================================================================
// Database Performance Monitoring
// =============================================================================

export async function getDatabaseMetrics(): Promise<{
  connectionPoolSize: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  slowQueryCount: number;
}> {
  try {
    // Get connection pool metrics from Prisma
    const poolMetrics = await prisma.$metrics.json();
    
    return {
      connectionPoolSize: 10, // From config
      activeConnections: poolMetrics.counters?.find((c: any) => c.key === 'prisma_client_queries_active')?.value || 0,
      idleConnections: 0, // Not directly available
      waitingRequests: 0, // Not directly available
      slowQueryCount: 0, // Tracked by query logger
    };
  } catch (error) {
    console.error('Error fetching database metrics:', error);
    return {
      connectionPoolSize: 10,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      slowQueryCount: 0,
    };
  }
}

// =============================================================================
// Index Usage Analysis
// =============================================================================

export async function analyzeIndexUsage(): Promise<Array<{
  tableName: string;
  indexName: string;
  indexScans: number;
  indexSize: string;
  recommendation: string;
}>> {
  try {
    const result = await prisma.$queryRaw<Array<{
      schemaname: string;
      tablename: string;
      indexname: string;
      idx_scan: bigint;
      idx_tup_read: bigint;
      idx_tup_fetch: bigint;
    }>>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan ASC
      LIMIT 20
    `;

    return result.map(row => ({
      tableName: row.tablename,
      indexName: row.indexname,
      indexScans: Number(row.idx_scan),
      indexSize: 'N/A', // Would need additional query
      recommendation: Number(row.idx_scan) === 0 
        ? 'Consider removing unused index' 
        : Number(row.idx_scan) < 100 
        ? 'Low usage - monitor for removal' 
        : 'Index is being used effectively',
    }));
  } catch (error) {
    console.error('Error analyzing index usage:', error);
    return [];
  }
}

// =============================================================================
// Performance Alerts
// =============================================================================

export async function checkPerformanceAlerts(): Promise<{
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }>;
  healthy: boolean;
}> {
  const alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }> = [];

  // Check cache hit rate
  const cacheMetrics = await getCacheMetrics();
  if (cacheMetrics.hitRate < 70 && cacheMetrics.totalRequests > 100) {
    alerts.push({
      severity: 'warning',
      category: 'cache',
      message: 'Cache hit rate below target',
      metric: 'cache_hit_rate',
      value: cacheMetrics.hitRate,
      threshold: 70,
    });
  }

  // Check cache evictions
  if (cacheMetrics.evictions > 1000) {
    alerts.push({
      severity: 'warning',
      category: 'cache',
      message: 'High cache eviction rate - consider increasing memory',
      metric: 'cache_evictions',
      value: cacheMetrics.evictions,
      threshold: 1000,
    });
  }

  // Check database connection pool
  const dbMetrics = await getDatabaseMetrics();
  const poolUsage = (dbMetrics.activeConnections / dbMetrics.connectionPoolSize) * 100;
  
  if (poolUsage > 80) {
    alerts.push({
      severity: 'critical',
      category: 'database',
      message: 'Database connection pool near capacity',
      metric: 'pool_usage_percent',
      value: poolUsage,
      threshold: 80,
    });
  }

  return {
    alerts,
    healthy: alerts.filter(a => a.severity === 'critical').length === 0,
  };
}

// =============================================================================
// Sentry Performance Monitoring Configuration
// =============================================================================

export function configureSentryPerformanceMonitoring() {
  // Set up custom performance monitoring
  Sentry.addGlobalEventProcessor((event) => {
    // Add custom context to all events
    if (event.contexts) {
      event.contexts.performance = {
        cache_enabled: !!getRedisConnection(),
        query_logging: true,
      };
    }
    return event;
  });

  console.log('✅ Sentry performance monitoring configured');
}

// =============================================================================
// Health Check Endpoint Data
// =============================================================================

export async function getProductionHealthMetrics(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  metrics: {
    cache: Awaited<ReturnType<typeof getCacheMetrics>>;
    database: Awaited<ReturnType<typeof getDatabaseMetrics>>;
    alerts: Awaited<ReturnType<typeof checkPerformanceAlerts>>;
  };
}> {
  const [cache, database, alerts] = await Promise.all([
    getCacheMetrics(),
    getDatabaseMetrics(),
    checkPerformanceAlerts(),
  ]);

  const criticalAlerts = alerts.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.alerts.filter(a => a.severity === 'warning');

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (criticalAlerts.length > 0) {
    status = 'unhealthy';
  } else if (warningAlerts.length > 0) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    metrics: {
      cache,
      database,
      alerts,
    },
  };
}

// =============================================================================
// Monitoring Scheduler
// =============================================================================

let monitoringInterval: NodeJS.Timeout | null = null;

export function startProductionMonitoring(intervalMs: number = 60000) {
  if (monitoringInterval) {
    console.log('⚠️  Production monitoring already running');
    return;
  }

  console.log(`🔍 Starting production monitoring (interval: ${intervalMs}ms)`);

  // Initial check
  void checkAndReportMetrics();

  // Schedule periodic checks
  monitoringInterval = setInterval(() => {
    void checkAndReportMetrics();
  }, intervalMs);
}

export function stopProductionMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Production monitoring stopped');
  }
}

async function checkAndReportMetrics() {
  try {
    const health = await getProductionHealthMetrics();
    
    // Log metrics
    console.log('📊 Production Metrics:', {
      status: health.status,
      cacheHitRate: `${health.metrics.cache.hitRate}%`,
      cacheKeys: health.metrics.cache.keyCount,
      dbConnections: health.metrics.database.activeConnections,
      alerts: health.metrics.alerts.alerts.length,
    });

    // Send critical alerts to Sentry
    for (const alert of health.metrics.alerts.alerts) {
      if (alert.severity === 'critical') {
        Sentry.captureMessage(alert.message, {
          level: 'error',
          tags: {
            category: alert.category,
            metric: alert.metric,
          },
          extra: {
            value: alert.value,
            threshold: alert.threshold,
          },
        });
      }
    }

    // Send performance metrics to Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: 'Production metrics collected',
      level: 'info',
      data: {
        cache_hit_rate: health.metrics.cache.hitRate,
        db_connections: health.metrics.database.activeConnections,
        alert_count: health.metrics.alerts.alerts.length,
      },
    });
  } catch (error) {
    console.error('❌ Error checking production metrics:', error);
    Sentry.captureException(error);
  }
}
