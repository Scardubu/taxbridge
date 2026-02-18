/**
 * Advanced Query Logging and Performance Monitoring
 * 
 * Provides detailed query performance tracking, N+1 detection,
 * and integration with monitoring systems
 */

import { Prisma } from '@prisma/client';
import { createLogger } from './logger';
import * as Sentry from '@sentry/node';

const log = createLogger('query-logger');

interface QueryMetrics {
  model: string;
  action: string;
  duration: number;
  timestamp: number;
  args?: any;
}

interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  averageDuration: number;
  queryBreakdown: Record<string, number>;
}

class QueryLogger {
  private queries: QueryMetrics[] = [];
  private slowQueryThreshold: number;
  private n1DetectionWindow: number;
  private maxStoredQueries: number;

  constructor() {
    this.slowQueryThreshold = parseInt(process.env.PRISMA_SLOW_QUERY_MS || '500');
    this.n1DetectionWindow = 1000; // 1 second window
    this.maxStoredQueries = 1000;
  }

  /**
   * Log a query execution
   */
  logQuery(metrics: QueryMetrics): void {
    // Store query for analysis
    this.queries.push(metrics);
    
    // Prevent memory leak by limiting stored queries
    if (this.queries.length > this.maxStoredQueries) {
      this.queries.shift();
    }

    // Log slow queries
    if (metrics.duration > this.slowQueryThreshold) {
      this.logSlowQuery(metrics);
    }

    // Detect potential N+1 queries
    this.detectN1Queries(metrics);
  }

  /**
   * Log slow query with context
   */
  private logSlowQuery(metrics: QueryMetrics): void {
    log.warn('Slow query detected', {
      model: metrics.model,
      action: metrics.action,
      duration: metrics.duration,
      threshold: this.slowQueryThreshold,
      args: this.sanitizeArgs(metrics.args),
    });

    // Send to Sentry for production monitoring
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage('Slow database query', {
        level: 'warning',
        tags: {
          model: metrics.model,
          action: metrics.action,
        },
        contexts: {
          query: {
            duration: metrics.duration,
            threshold: this.slowQueryThreshold,
          },
        },
      });
    }
  }

  /**
   * Detect potential N+1 query patterns
   */
  private detectN1Queries(metrics: QueryMetrics): void {
    const now = Date.now();
    const windowStart = now - this.n1DetectionWindow;

    // Get queries within detection window for same model/action
    const similarQueries = this.queries.filter(
      q =>
        q.timestamp >= windowStart &&
        q.model === metrics.model &&
        q.action === metrics.action
    );

    // If we see many similar queries in a short time, likely N+1
    if (similarQueries.length > 5) {
      log.warn('Potential N+1 query pattern detected', {
        model: metrics.model,
        action: metrics.action,
        count: similarQueries.length,
        windowMs: this.n1DetectionWindow,
      });

      // Alert in production
      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage('N+1 query pattern detected', {
          level: 'warning',
          tags: {
            model: metrics.model,
            action: metrics.action,
          },
          contexts: {
            n1_detection: {
              queryCount: similarQueries.length,
              windowMs: this.n1DetectionWindow,
            },
          },
        });
      }
    }
  }

  /**
   * Get query statistics
   */
  getStats(): QueryStats {
    const totalQueries = this.queries.length;
    const slowQueries = this.queries.filter(q => q.duration > this.slowQueryThreshold).length;
    
    const totalDuration = this.queries.reduce((sum, q) => sum + q.duration, 0);
    const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;

    const queryBreakdown: Record<string, number> = {};
    this.queries.forEach(q => {
      const key = `${q.model}.${q.action}`;
      queryBreakdown[key] = (queryBreakdown[key] || 0) + 1;
    });

    return {
      totalQueries,
      slowQueries,
      averageDuration,
      queryBreakdown,
    };
  }

  /**
   * Get top slow queries
   */
  getTopSlowQueries(limit: number = 10): QueryMetrics[] {
    return [...this.queries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(q => ({
        ...q,
        args: this.sanitizeArgs(q.args),
      }));
  }

  /**
   * Sanitize query arguments for logging
   */
  private sanitizeArgs(args: any): any {
    if (!args) return undefined;

    // Remove sensitive data
    const sanitized = { ...args };
    const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'apiKey'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }

  /**
   * Clear stored queries
   */
  clear(): void {
    this.queries = [];
  }
}

// Singleton instance
export const queryLogger = new QueryLogger();

/**
 * Prisma middleware for query logging
 */
export function createQueryLoggingMiddleware(): (params: any, next: (params: any) => Promise<any>) => Promise<any> {
  return async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    // Log the query
    queryLogger.logQuery({
      model: params.model || 'unknown',
      action: params.action,
      duration,
      timestamp: Date.now(),
      args: params.args,
    });

    return result;
  };
}

/**
 * Get query performance report
 */
export function getQueryPerformanceReport(): {
  stats: QueryStats;
  topSlowQueries: QueryMetrics[];
  recommendations: string[];
} {
  const stats = queryLogger.getStats();
  const topSlowQueries = queryLogger.getTopSlowQueries(10);
  const recommendations: string[] = [];

  // Generate recommendations
  if (stats.slowQueries > stats.totalQueries * 0.1) {
    recommendations.push('More than 10% of queries are slow. Consider adding indexes or optimizing queries.');
  }

  if (stats.averageDuration > 200) {
    recommendations.push('Average query duration is high. Review database indexes and query patterns.');
  }

  // Check for repeated queries that might indicate N+1 issues
  const queryBreakdown = Object.entries(stats.queryBreakdown);
  const repeatedQueries = queryBreakdown.filter(([, count]) => count > 10);
  
  if (repeatedQueries.length > 0) {
    recommendations.push(
      `Found ${repeatedQueries.length} query patterns with high repetition. Consider using select/include to reduce queries.`
    );
  }

  return {
    stats,
    topSlowQueries,
    recommendations,
  };
}
