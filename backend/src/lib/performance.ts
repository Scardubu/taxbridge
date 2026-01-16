/**
 * Performance Monitoring & Optimization Utilities
 * Provides request timing, database query optimization, and performance metrics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from './logger';

const logger = createLogger('performance');

export interface PerformanceMetrics {
  requestCount: number;
  totalDuration: number;
  avgDuration: number;
  p50: number;
  p95: number;
  p99: number;
  slowQueries: number;
  cacheHits: number;
  cacheMisses: number;
}

class PerformanceMonitor {
  private requestTimes: number[] = [];
  private slowQueryThreshold = 1000; // 1 second
  private slowQueries: Array<{ query: string; duration: number; timestamp: Date }> = [];
  private maxStoredMetrics = 1000;

  /**
   * Record request duration
   */
  recordRequest(duration: number): void {
    this.requestTimes.push(duration);
    
    // Keep only last N metrics to prevent memory leak
    if (this.requestTimes.length > this.maxStoredMetrics) {
      this.requestTimes.shift();
    }

    // Log slow requests
    if (duration > 500) {
      logger.warn('Slow request detected', { duration });
    }
  }

  /**
   * Record slow database query
   */
  recordSlowQuery(query: string, duration: number): void {
    if (duration > this.slowQueryThreshold) {
      this.slowQueries.push({
        query,
        duration,
        timestamp: new Date()
      });

      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }

      logger.warn('Slow database query', { query, duration });
    }
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const total = sorted.reduce((sum, time) => sum + time, 0);

    return {
      requestCount: sorted.length,
      totalDuration: total,
      avgDuration: sorted.length > 0 ? total / sorted.length : 0,
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      slowQueries: this.slowQueries.length,
      cacheHits: 0, // Populated by cache service
      cacheMisses: 0
    };
  }

  /**
   * Get recent slow queries
   */
  getSlowQueries(limit = 10): Array<{ query: string; duration: number; timestamp: Date }> {
    return this.slowQueries.slice(-limit);
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.requestTimes = [];
    this.slowQueries = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Fastify plugin for performance monitoring
 */
export async function performancePlugin(app: FastifyInstance) {
  // Request timing hook
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.startTime) {
      const duration = Date.now() - request.startTime;
      performanceMonitor.recordRequest(duration);

      // Add response time header
      reply.header('X-Response-Time', `${duration}ms`);

      // Log slow requests with details
      if (duration > 500) {
        logger.warn('Slow request', {
          method: request.method,
          url: request.url,
          duration,
          statusCode: reply.statusCode
        });
      }
    }
  });

  // Performance metrics endpoint (admin only)
  app.get('/metrics/performance', async (request, reply) => {
    const metrics = performanceMonitor.getMetrics();
    const slowQueries = performanceMonitor.getSlowQueries(20);

    return reply.send({
      timestamp: new Date().toISOString(),
      metrics,
      slowQueries,
      systemInfo: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    });
  });

  logger.info('Performance monitoring plugin registered');
}

/**
 * Database query performance wrapper
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordSlowQuery(queryName, duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Query failed', { queryName, duration, error });
    throw error;
  }
}

/**
 * Function execution timer decorator
 */
export function timed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now();
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;
      
      if (duration > 100) {
        logger.debug('Method execution', { method: propertyKey, duration });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Method failed', { method: propertyKey, duration, error });
      throw error;
    }
  };

  return descriptor;
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    arrayBuffers: `${Math.round(usage.arrayBuffers / 1024 / 1024)}MB`
  };
}

/**
 * Check if response should be compressed
 */
export function shouldCompress(contentType: string, contentLength: number): boolean {
  // Compress if:
  // 1. Content type is compressible (text, json, xml)
  // 2. Content length > 1KB
  const compressibleTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript'
  ];

  const isCompressible = compressibleTypes.some(type => 
    contentType.toLowerCase().startsWith(type)
  );

  return isCompressible && contentLength > 1024;
}

// Type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}
