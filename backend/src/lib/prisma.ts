import { PrismaClient } from '@prisma/client';
import { attachEncryptionMiddleware } from '../services/encryption';
import { createLogger } from './logger';
import { recordSlowQuery } from '../services/pool-metrics';

const log = createLogger('prisma');

const DEFAULT_POOL_MAX = 10;
const DEFAULT_POOL_TIMEOUT_MS = 5000;
const DEFAULT_SLOW_QUERY_MS = 500;

// Singleton Prisma Client instance
let prismaInstance: PrismaClient | undefined;

function coerceNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildDatasourceUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required but was not provided.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL provided: ${(error as Error).message}`);
  }

  const poolMax = coerceNumber(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX);
  const poolTimeout = coerceNumber(process.env.DATABASE_POOL_TIMEOUT_MS, DEFAULT_POOL_TIMEOUT_MS);

  // Prisma forwards connection_limit/pool_timeout to the underlying driver (pg)
  parsedUrl.searchParams.set('connection_limit', String(poolMax));
  parsedUrl.searchParams.set('pool_timeout', String(poolTimeout));

  return parsedUrl.toString();
}

/**
 * Get the singleton Prisma Client instance.
 * Creates a new instance if one doesn't exist.
 * Attaches encryption middleware automatically.
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    log.info('Creating new Prisma Client instance');

    const datasourceUrl = buildDatasourceUrl();
    const slowQueryThreshold = coerceNumber(process.env.PRISMA_SLOW_QUERY_MS, DEFAULT_SLOW_QUERY_MS);

    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: datasourceUrl
        }
      },
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' }
      ]
    });

    // Attach encryption middleware
    attachEncryptionMiddleware(prismaInstance);

    // Log Prisma warnings and errors
    prismaInstance.$on('warn' as never, (e: any) => {
      log.warn('Prisma warning', { message: e.message });
    });

    prismaInstance.$on('error' as never, (e: any) => {
      log.error('Prisma error', { message: e.message });
    });

    // Surface slow queries for easier performance tuning
    prismaInstance.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;
      if (duration > slowQueryThreshold) {
        log.warn('Slow query detected', {
          model: params.model,
          action: params.action,
          duration
        });
        recordSlowQuery();
      }
      return result;
    });

    log.info('Prisma Client initialized with encryption middleware and pooling');
  }

  return prismaInstance;
}

/**
 * Disconnect the Prisma Client instance gracefully.
 * Should be called during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    log.info('Disconnecting Prisma Client');
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
}

/**
 * Legacy export for backward compatibility.
 * New code should use getPrismaClient() instead.
 */
export const prisma = getPrismaClient();
