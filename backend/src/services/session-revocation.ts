import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

const log = logger.child({ service: 'session-revocation' });

const REVOKE_USER_REFRESH_SESSIONS_SCRIPT = `
local families = redis.call('SMEMBERS', KEYS[1])
local revoked = 0
for _, family in ipairs(families) do
  local hashes = redis.call('SMEMBERS', ARGV[1] .. family)
  for _, tokenHash in ipairs(hashes) do
    revoked = revoked + redis.call('DEL', ARGV[2] .. tokenHash)
  end
  redis.call('DEL', ARGV[1] .. family)
end
redis.call('DEL', KEYS[1], KEYS[2])
return revoked
`;

/** Increment auth_version inside the same transaction as the security change. */
export async function bumpAuthVersion(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const updated = await tx.user.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 } },
    select: { authVersion: true },
  });
  return updated.authVersion;
}

/**
 * Best-effort cleanup of Redis refresh-token indexes. PostgreSQL auth_version
 * is the authorization authority, so Redis failure cannot restore a revoked
 * access or refresh token.
 */
export async function revokeUserRefreshSessions(userId: string): Promise<void> {
  try {
    await redis.eval(
      REVOKE_USER_REFRESH_SESSIONS_SCRIPT,
      2,
      `rtfamilies:${userId}`,
      `sessions:${userId}`,
      `rtf:${userId}:`,
      `rt:${userId}:`,
    );
  } catch (error) {
    log.warn({ userId, err: error }, 'Refresh-token cleanup deferred; auth_version remains authoritative');
  }
}

/** Revoke all sessions after a suspicious refresh-token reuse event. */
export async function invalidateUserSessions(userId: string): Promise<number> {
  const version = await prisma.$transaction((tx) => bumpAuthVersion(tx, userId));
  await revokeUserRefreshSessions(userId);
  return version;
}
