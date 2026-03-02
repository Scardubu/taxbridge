import { PrismaClient } from '@prisma/client';
import { attachEncryptionMiddleware } from '../services/encryption';
import { createLogger } from './logger';
import { recordSlowQuery } from '../services/pool-metrics';
import { createQueryLoggingMiddleware } from './query-logger';

const log = createLogger('prisma');

const DEFAULT_POOL_MAX = 10;
const DEFAULT_POOL_TIMEOUT_MS = 5000;
const DEFAULT_SLOW_QUERY_MS = 500;

// C-43: global.__prisma singleton guard — survives hot-reloads in dev
// Pattern: (global as any).__prisma ?? new PrismaClient() — prevents duplicate connections
declare const globalThis: { __prisma?: PrismaClient } & typeof global;

function coerceNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function describeDatabaseUrlIssues(databaseUrl: string): string[] {
  const issues: string[] = [];
  const trimmed = databaseUrl.trim();

  if (trimmed !== databaseUrl) {
    issues.push('contains leading or trailing whitespace');
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    issues.push('wrapped in quotes (remove surrounding quotes in Render env vars)');
  }

  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    issues.push('missing postgresql:// scheme');
  }

  if ((trimmed.match(/@/g) || []).length > 1) {
    issues.push('contains multiple "@" characters (URL-encode password)');
  }

  if (/\s/.test(trimmed)) {
    issues.push('contains whitespace (URL-encode special characters)');
  }

  return issues;
}

function buildDatasourceUrl(): string {
  const databaseUrl = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required but was not provided. (Optionally set DATABASE_POOL_URL for runtime pooling.)');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    const issues = describeDatabaseUrlIssues(databaseUrl);
    log.error('Invalid DATABASE_URL provided', {
      issues: issues.length ? issues : ['failed URL parsing (check for URL-encoding issues)']
    });
    throw new Error('Invalid database URL provided. Ensure DATABASE_URL is a valid postgresql:// URL and URL-encode special characters.');
  }

  const poolMax = coerceNumber(process.env.DATABASE_POOL_MAX ?? process.env.DB_POOL_MAX, DEFAULT_POOL_MAX);
  const poolTimeout = coerceNumber(
    process.env.DATABASE_POOL_TIMEOUT_MS ?? process.env.DB_CONNECTION_TIMEOUT,
    DEFAULT_POOL_TIMEOUT_MS
  );

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
  if (!globalThis.__prisma) {
    log.info('Creating new Prisma Client instance');

    const datasourceUrl = buildDatasourceUrl();
    const slowQueryThreshold = coerceNumber(process.env.PRISMA_SLOW_QUERY_MS, DEFAULT_SLOW_QUERY_MS);

    globalThis.__prisma = new PrismaClient({
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
    attachEncryptionMiddleware(globalThis.__prisma);

    // Attach query logging middleware for performance monitoring
    globalThis.__prisma.$use(createQueryLoggingMiddleware());

    // Log Prisma warnings and errors
    globalThis.__prisma.$on('warn' as never, (e: any) => {
      log.warn('Prisma warning', { message: e.message });
    });

    // Throttle identical Prisma errors (e.g. P1001 when DB is unreachable)
    let lastPrismaErrorMsg = '';
    let lastPrismaErrorAt = 0;
    let suppressedCount = 0;

    globalThis.__prisma.$on('error' as never, (e: any) => {
      const msg = String(e.message || '').split('\n')[0];
      const now = Date.now();

      if (msg === lastPrismaErrorMsg && now - lastPrismaErrorAt < 300_000) {
        // Same error within 5 minutes — suppress
        suppressedCount++;
        return;
      }

      // New error or cooldown expired — log it
      if (suppressedCount > 0) {
        log.warn('Suppressed repeated Prisma errors', { count: suppressedCount, lastError: lastPrismaErrorMsg });
      }
      lastPrismaErrorMsg = msg;
      lastPrismaErrorAt = now;
      suppressedCount = 0;
      log.error('Prisma error', { message: msg });
    });

    // Surface slow queries for easier performance tuning
    globalThis.__prisma.$use(async (params, next) => {
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

  return globalThis.__prisma;
}

/**
 * Disconnect the Prisma Client instance gracefully.
 * Should be called during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (globalThis.__prisma) {
    log.info('Disconnecting Prisma Client');
    await globalThis.__prisma.$disconnect();
    globalThis.__prisma = undefined;
  }
}

/**
 * Legacy export for backward compatibility.
 * New code should use getPrismaClient() instead.
 */
export const prisma = getPrismaClient();
