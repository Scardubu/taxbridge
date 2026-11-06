import { createHash } from 'node:crypto';
import type IORedis from 'ioredis';

const REFRESH_KEY_PREFIX = 'rt:v2:';
const ROLE_VERSION_PREFIX = 'role_version:';

/**
 * Compare-and-swap the current refresh-token digest and its authorization
 * version in one Redis transaction. A stale token hash increments the
 * account role version and revokes the family in the same atomic operation.
 */
export const ROTATE_REFRESH_SESSION_SCRIPT = [
  "local currentVersion = redis.call('GET', KEYS[2]) or '0'",
  "if currentVersion ~= ARGV[4] then",
  "  redis.call('DEL', KEYS[1])",
  '  return -2',
  'end',
  "local currentHash = redis.call('GET', KEYS[1])",
  'if not currentHash then return 0 end',
  'if currentHash ~= ARGV[1] then',
  "  redis.call('INCR', KEYS[2])",
  "  redis.call('DEL', KEYS[1])",
  '  return -1',
  'end',
  "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])",
  'return 1',
].join('\n');

export type RefreshRotationResult = 'ROTATED' | 'REPLAYED' | 'MISSING' | 'REVOKED';

type RefreshRedisClient = Pick<IORedis, 'set' | 'eval'>;

export function refreshSessionKey(userId: string, familyId: string): string {
  return REFRESH_KEY_PREFIX + userId + ':' + familyId;
}

export function roleVersionKey(userId: string): string {
  return ROLE_VERSION_PREFIX + userId;
}

/** Only a one-way digest is stored; raw refresh JWTs never enter Redis. */
export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken, 'utf8').digest('base64url');
}

export async function createRefreshSession(
  client: RefreshRedisClient,
  userId: string,
  familyId: string,
  refreshToken: string,
  ttlSeconds: number,
): Promise<void> {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('Refresh-token TTL must be a positive integer');
  }

  const result = await client.set(
    refreshSessionKey(userId, familyId),
    hashRefreshToken(refreshToken),
    'EX',
    ttlSeconds,
    'NX',
  );

  if (result !== 'OK') {
    throw new Error('Refresh-token family could not be created');
  }
}

export async function rotateRefreshSession(
  client: RefreshRedisClient,
  input: {
    userId: string;
    familyId: string;
    currentToken: string;
    replacementToken: string;
    expectedRoleVersion: number;
    ttlSeconds: number;
  },
): Promise<RefreshRotationResult> {
  if (!Number.isSafeInteger(input.expectedRoleVersion) || input.expectedRoleVersion < 0) {
    throw new RangeError('Expected role version must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(input.ttlSeconds) || input.ttlSeconds <= 0) {
    throw new RangeError('Refresh-token TTL must be a positive integer');
  }

  const rawResult = await client.eval(
    ROTATE_REFRESH_SESSION_SCRIPT,
    2,
    refreshSessionKey(input.userId, input.familyId),
    roleVersionKey(input.userId),
    hashRefreshToken(input.currentToken),
    hashRefreshToken(input.replacementToken),
    String(input.ttlSeconds),
    String(input.expectedRoleVersion),
  );
  const result = Number(rawResult);

  if (result === 1) return 'ROTATED';
  if (result === -1) return 'REPLAYED';
  if (result === -2) return 'REVOKED';
  if (result === 0) return 'MISSING';

  throw new Error('Redis returned an unknown refresh-token rotation result');
}
