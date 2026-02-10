/**
 * API Response Caching Middleware
 * 
 * Provides Redis-based HTTP response caching for GET endpoints
 * with automatic cache invalidation and ETags support
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { CacheManager } from '../lib/cache';
import { createLogger } from '../lib/logger';

const log = createLogger('cache-middleware');

// Cache TTL configurations per endpoint pattern
const CACHE_TTL_CONFIG: Record<string, number> = {
  // Tax calculations (rarely change)
  '/api/v1/tax/calculate': 3600, // 1 hour
  
  // User profile (changes infrequently)
  '/api/v1/business/profile': 600, // 10 minutes
  '/api/v1/users/me': 300, // 5 minutes
  
  // Invoice lists (moderate changes)
  '/api/v1/invoices': 60, // 1 minute
  '/api/v1/expenses': 60, // 1 minute
  
  // Analytics/stats (can be cached longer)
  '/api/v1/analytics': 300, // 5 minutes
  '/api/v1/dashboard/stats': 180, // 3 minutes
  
  // Payment status (short cache)
  '/api/v1/payments': 30, // 30 seconds
  
  // Public data (cache longer)
  '/api/v1/health': 10, // 10 seconds
  '/api/v1/faq': 7200, // 2 hours
};

// Endpoints to exclude from caching
const CACHE_EXCLUDE_PATTERNS = [
  '/api/v1/auth',
  '/api/v1/webhooks',
  '/api/v1/admin',
  '/api/v1/sync',
];

interface CacheMetadata {
  etag: string;
  cacheControl: string;
  age: number;
}

/**
 * Generate cache key from request
 */
function generateCacheKey(request: FastifyRequest): string {
  const { method, url, headers } = request;
  const userId = (request as any).user?.id || 'anonymous';
  
  // Include query parameters and user ID in cache key
  const keyComponents = [
    method,
    url,
    userId,
    headers.accept || '',
  ];
  
  return createHash('sha256')
    .update(keyComponents.join('|'))
    .digest('hex')
    .substring(0, 32);
}

/**
 * Generate ETag from response body
 */
function generateETag(body: string | object): string {
  const content = typeof body === 'string' ? body : JSON.stringify(body);
  return createHash('md5')
    .update(content)
    .digest('hex');
}

/**
 * Get cache TTL for request path
 */
function getCacheTTL(path: string): number {
  // Exact match
  if (CACHE_TTL_CONFIG[path]) {
    return CACHE_TTL_CONFIG[path];
  }
  
  // Pattern match
  for (const [pattern, ttl] of Object.entries(CACHE_TTL_CONFIG)) {
    if (path.startsWith(pattern)) {
      return ttl;
    }
  }
  
  // Default TTL
  return 60; // 1 minute
}

/**
 * Check if request should be cached
 */
function shouldCache(request: FastifyRequest): boolean {
  // Only cache GET requests
  if (request.method !== 'GET') {
    return false;
  }
  
  // Check exclude patterns
  const path = request.url;
  for (const pattern of CACHE_EXCLUDE_PATTERNS) {
    if (path.startsWith(pattern)) {
      return false;
    }
  }
  
  // Don't cache if Cache-Control: no-cache header present
  if (request.headers['cache-control']?.includes('no-cache')) {
    return false;
  }
  
  return true;
}

/**
 * API Response Caching Middleware
 */
export async function apiCacheMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip if caching not applicable
  if (!shouldCache(request)) {
    return;
  }
  
  const cacheKey = generateCacheKey(request);
  const cache = new CacheManager('api_response');
  
  try {
    // Check for cached response
    const cached = await cache.get<{ body: any; metadata: CacheMetadata }>(cacheKey);
    
    if (cached) {
      const { body, metadata } = cached;
      
      // Check ETag for 304 Not Modified
      const clientETag = request.headers['if-none-match'];
      if (clientETag && clientETag === metadata.etag) {
        reply.code(304);
        reply.header('ETag', metadata.etag);
        reply.header('Cache-Control', metadata.cacheControl);
        reply.send();
        return;
      }
      
      // Send cached response
      reply.code(200);
      reply.header('X-Cache', 'HIT');
      reply.header('ETag', metadata.etag);
      reply.header('Cache-Control', metadata.cacheControl);
      reply.header('Age', Math.floor((Date.now() - metadata.age) / 1000).toString());
      reply.send(body);
      
      log.debug('Cache hit', { path: request.url, cacheKey });
      return;
    }
    
    // Cache miss - intercept response
    reply.header('X-Cache', 'MISS');
    
    // Hook into response to cache it
    reply.hijack();
    const originalSend = reply.send.bind(reply);
    
    reply.send = function(payload: any) {
      // Only cache successful responses
      if (reply.statusCode === 200) {
        const ttl = getCacheTTL(request.url);
        const etag = generateETag(payload);
        const cacheControl = `public, max-age=${ttl}`;
        
        const metadata: CacheMetadata = {
          etag,
          cacheControl,
          age: Date.now(),
        };
        
        // Cache response asynchronously
        cache.set(cacheKey, { body: payload, metadata }, ttl)
          .catch(err => log.error('Failed to cache response', { err, path: request.url }));
        
        // Set cache headers
        reply.header('ETag', etag);
        reply.header('Cache-Control', cacheControl);
        
        log.debug('Response cached', { path: request.url, cacheKey, ttl });
      }
      
      return originalSend(payload);
    };
    
  } catch (error) {
    // Log error but don't fail the request
    log.error('Cache middleware error', { error, path: request.url });
    reply.header('X-Cache', 'ERROR');
  }
}

/**
 * Cache invalidation helper
 */
export class CacheInvalidator {
  private cache: CacheManager;
  
  constructor() {
    this.cache = new CacheManager('api_response');
  }
  
  /**
   * Invalidate cache for specific user
   */
  async invalidateUser(userId: string): Promise<void> {
    // In a real implementation, you'd need to track user-specific cache keys
    // For now, this is a placeholder
    log.info('Invalidating user cache', { userId });
  }
  
  /**
   * Invalidate cache for specific resource
   */
  async invalidateResource(resourceType: string, resourceId: string): Promise<void> {
    log.info('Invalidating resource cache', { resourceType, resourceId });
    // Implementation would depend on cache key strategy
  }
  
  /**
   * Clear all API response cache
   */
  async clearAll(): Promise<void> {
    await this.cache.clear();
    log.info('All API response cache cleared');
  }
}

// Export singleton invalidator
export const cacheInvalidator = new CacheInvalidator();
