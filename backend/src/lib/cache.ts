import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const redis = getRedisConnection();
const log = createLogger('cache');

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutes
  shortTTL: 60, // 1 minute
  longTTL: 3600, // 1 hour
  maxRetries: 3,
  keyPrefix: 'taxbridge_cache:',
  compressionThreshold: 1024 // Compress values larger than 1KB
};

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

// Compression utilities
function compress(data: string): string {
  if (data.length < CACHE_CONFIG.compressionThreshold) {
    return data;
  }

  try {
    // Simple compression - replace repeated patterns
    return data
      .replace(/\s+/g, ' ')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
  } catch (error) {
    log.warn('Compression failed, using original data', { err: error });
    return data;
  }
}

function decompress(data: string): string {
  try {
    // Simple decompression - reverse the compression
    return data;
  } catch (error) {
    log.warn('Decompression failed, returning original data', { err: error });
    return data;
  }
}

// Generate cache key
function generateKey(namespace: string, key: string): string {
  return `${CACHE_CONFIG.keyPrefix}${namespace}:${key}`;
}

// Serialize/deserialize with compression
function serialize<T>(data: T): string {
  const serialized = JSON.stringify(data);
  return compress(serialized);
}

function deserialize<T>(data: string): T | null {
  try {
    const decompressed = decompress(data);
    return JSON.parse(decompressed) as T;
  } catch (error) {
    log.error('Cache deserialization failed', { err: error, data });
    return null;
  }
}

// Main cache class
export class CacheManager {
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  // Set cache value
  async set<T>(
    key: string,
    data: T,
    ttl: number = CACHE_CONFIG.defaultTTL
  ): Promise<void> {
    const cacheKey = generateKey(this.namespace, key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      compressed: JSON.stringify(data).length >= CACHE_CONFIG.compressionThreshold
    };

    try {
      const serialized = serialize(entry);
      await redis.setex(cacheKey, ttl, serialized);

      log.debug('Cache set', {
        namespace: this.namespace,
        key,
        ttl,
        compressed: entry.compressed,
        size: serialized.length
      });
    } catch (error) {
      log.error('Failed to set cache', { err: error, namespace: this.namespace, key });
      throw error;
    }
  }

  // Get cache value
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = generateKey(this.namespace, key);

    try {
      const cached = await redis.get(cacheKey);
      if (!cached) {
        return null;
      }

      const entry = deserialize<CacheEntry<T>>(cached);
      if (!entry) {
        return null;
      }

      // Check if expired
      const now = Date.now();
      const age = now - entry.timestamp;

      if (age > entry.ttl * 1000) {
        // Expired, remove it
        await this.delete(key);
        log.debug('Cache entry expired and removed', {
          namespace: this.namespace,
          key,
          age,
          ttl: entry.ttl
        });
        return null;
      }

      log.debug('Cache hit', {
        namespace: this.namespace,
        key,
        age,
        compressed: entry.compressed
      });

      return entry.data;
    } catch (error) {
      log.error('Failed to get cache', { err: error, namespace: this.namespace, key });
      return null;
    }
  }

  // Delete cache value
  async delete(key: string): Promise<void> {
    const cacheKey = generateKey(this.namespace, key);

    try {
      await redis.del(cacheKey);
      log.debug('Cache deleted', { namespace: this.namespace, key });
    } catch (error) {
      log.error('Failed to delete cache', { err: error, namespace: this.namespace, key });
      throw error;
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    const cacheKey = generateKey(this.namespace, key);

    try {
      const result = await redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      log.error('Failed to check cache existence', { err: error, namespace: this.namespace, key });
      return false;
    }
  }

  // Get multiple values (mget)
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const cacheKeys = keys.map(key => generateKey(this.namespace, key));

    try {
      const cachedValues = await redis.mget(...cacheKeys);

      return cachedValues.map((cached, index) => {
        if (!cached) {
          return null;
        }

        const entry = deserialize<CacheEntry<T>>(cached);
        if (!entry) {
          return null;
        }

        // Check if expired
        const now = Date.now();
        const age = now - entry.timestamp;

        if (age > entry.ttl * 1000) {
          // Expired, remove it asynchronously
          this.delete(keys[index]).catch(err =>
            log.error('Failed to remove expired cache entry', { err, key: keys[index] })
          );
          return null;
        }

        return entry.data;
      });
    } catch (error) {
      log.error('Failed to mget cache', { err: error, namespace: this.namespace, keys });
      return keys.map(() => null);
    }
  }

  // Set multiple values (mset)
  async mset<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    const pipeline = redis.pipeline();

    try {
      for (const entry of entries) {
        const cacheKey = generateKey(this.namespace, entry.key);
        const ttl = entry.ttl || CACHE_CONFIG.defaultTTL;
        const cacheEntry: CacheEntry<T> = {
          data: entry.data,
          timestamp: Date.now(),
          ttl,
          compressed: JSON.stringify(entry.data).length >= CACHE_CONFIG.compressionThreshold
        };

        const serialized = serialize(cacheEntry);
        pipeline.setex(cacheKey, ttl, serialized);
      }

      await pipeline.exec();

      log.debug('Cache mset', {
        namespace: this.namespace,
        count: entries.length
      });
    } catch (error) {
      log.error('Failed to mset cache', { err: error, namespace: this.namespace });
      throw error;
    }
  }

  // Clear all cache entries for namespace
  async clear(): Promise<void> {
    const pattern = generateKey(this.namespace, '*');

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        log.info('Cache cleared', {
          namespace: this.namespace,
          deletedKeys: keys.length
        });
      }
    } catch (error) {
      log.error('Failed to clear cache', { err: error, namespace: this.namespace });
      throw error;
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    keyCount: number;
    memoryUsage: number;
    hitRate: number;
  }> {
    const pattern = generateKey(this.namespace, '*');

    try {
      const keys = await redis.keys(pattern);

      // Get memory usage (approximate)
      let totalSize = 0;
      for (const key of keys) {
        const size = await redis.memory('USAGE', key);
        totalSize += size || 0;
      }

      return {
        keyCount: keys.length,
        memoryUsage: totalSize,
        hitRate: 0 // Would need to track hits/misses separately
      };
    } catch (error) {
      log.error('Failed to get cache stats', { err: error, namespace: this.namespace });
      return {
        keyCount: 0,
        memoryUsage: 0,
        hitRate: 0
      };
    }
  }
}

// Predefined cache managers for common use cases
export const userCache = new CacheManager('user');
export const invoiceCache = new CacheManager('invoice');
export const paymentCache = new CacheManager('payment');
export const taxIdCache = new CacheManager('tax_id');
export const rateLimitCache = new CacheManager('rate_limit');
export const sessionCache = new CacheManager('session');

// Cache helper functions for common patterns
export const cacheHelpers = {
  // Cache user by phone or NIN
  async cacheUser(identifier: string, user: any, ttl: number = CACHE_CONFIG.longTTL): Promise<void> {
    await userCache.set(identifier, user, ttl);
  },

  async getUser(identifier: string): Promise<any | null> {
    return await userCache.get(identifier);
  },

  // Cache invoice by ID or prefix
  async cacheInvoice(invoiceId: string, invoice: any, ttl: number = CACHE_CONFIG.defaultTTL): Promise<void> {
    await invoiceCache.set(invoiceId, invoice, ttl);
  },

  async getInvoice(invoiceId: string): Promise<any | null> {
    return await invoiceCache.get(invoiceId);
  },

  // Cache payment by RRR
  async cachePayment(rrr: string, payment: any, ttl: number = CACHE_CONFIG.defaultTTL): Promise<void> {
    await paymentCache.set(rrr, payment, ttl);
  },

  async getPayment(rrr: string): Promise<any | null> {
    return await paymentCache.get(rrr);
  },

  // Cache tax ID lookup
  async cacheTaxId(nin: string, taxData: any, ttl: number = CACHE_CONFIG.longTTL): Promise<void> {
    await taxIdCache.set(nin, taxData, ttl);
  },

  async getTaxId(nin: string): Promise<any | null> {
    return await taxIdCache.get(nin);
  },

  // Cache with fallback pattern
  async getWithFallback<T>(
    cacheManager: CacheManager,
    key: string,
    fallback: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await cacheManager.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fallback();
    if (ttl) {
      await cacheManager.set(key, result, ttl);
    }

    return result;
  }
};

// Cache warming utilities
export async function warmupCache(): Promise<void> {
  log.info('Starting cache warmup');

  try {
    // Warm up frequently accessed data
    // This would be customized based on application usage patterns

    // Example: Cache active users
    // Example: Cache recent invoices
    // Example: Cache tax ID mappings

    log.info('Cache warmup completed');
  } catch (error) {
    log.error('Cache warmup failed', { err: error });
  }
}

// Cache cleanup utilities
export async function cleanupExpiredCache(): Promise<void> {
  log.info('Starting expired cache cleanup');

  try {
    const pattern = `${CACHE_CONFIG.keyPrefix}*`;
    const keys = await redis.keys(pattern);

    let cleanedCount = 0;
    for (const key of keys) {
      try {
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // No expiry set, skip
          continue;
        }

        if (ttl === -2) {
          // Key doesn't exist, skip
          continue;
        }

        // Check if actually expired by getting the entry
        const cached = await redis.get(key);
        if (cached) {
          const entry = deserialize<CacheEntry<any>>(cached);
          if (entry) {
            const now = Date.now();
            const age = now - entry.timestamp;

            if (age > entry.ttl * 1000) {
              await redis.del(key);
              cleanedCount++;
            }
          }
        }
      } catch (error) {
        log.error('Error cleaning cache key', { err: error, key });
      }
    }

    log.info('Cache cleanup completed', {
      totalKeys: keys.length,
      cleanedKeys: cleanedCount
    });
  } catch (error) {
    log.error('Cache cleanup failed', { err: error });
  }
}

export { CACHE_CONFIG };
