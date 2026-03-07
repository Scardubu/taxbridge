/**
 * Prisma Singleton — TaxBridge V13 Sovereign
 * C-43: global.__prisma singleton — no new PrismaClient in routes or services.
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

/**
 * Legacy compat helper — callers that previously used getPrismaClient()
 * should migrate to `import { prisma } from '../lib/prisma'`.
 */
export function getPrismaClient(): PrismaClient {
  return prisma;
}

/**
 * Graceful disconnect — call during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
