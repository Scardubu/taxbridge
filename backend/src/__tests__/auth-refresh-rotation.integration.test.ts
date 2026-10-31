import { randomUUID } from 'node:crypto';
import type IORedis from 'ioredis';
import {
  createRefreshSession,
  hashRefreshToken,
  refreshSessionKey,
  roleVersionKey,
  rotateRefreshSession,
} from '../services/refreshTokenRotation';

const redisConfigured = Boolean(process.env.REDIS_URL);
const describeRedis = redisConfigured ? describe : describe.skip;

describeRedis('atomic refresh-token rotation (Redis integration)', () => {
  let redisClient: IORedis;
  const cleanupKeys: string[] = [];

  beforeAll(async () => {
    const redisModule = await import('../lib/redis');
    redisClient = redisModule.redis;
    await redisClient.ping();
  });

  afterEach(async () => {
    if (cleanupKeys.length > 0) {
      await redisClient.del(...cleanupKeys);
      cleanupKeys.length = 0;
    }
  });

  function makeFixture() {
    const userId = randomUUID();
    const familyId = randomUUID();
    const key = refreshSessionKey(userId, familyId);
    const versionKey = roleVersionKey(userId);
    cleanupKeys.push(key, versionKey);
    return { userId, familyId, key, versionKey };
  }

  async function seedSession(userId: string, familyId: string, token: string): Promise<void> {
    await createRefreshSession(redisClient, userId, familyId, token, 60);
  }

  it('stores only a one-way digest and rotates a valid refresh token once', async () => {
    const fixture = makeFixture();
    const oldToken = 'refresh-token-original';
    const replacementToken = 'refresh-token-replacement';

    await seedSession(fixture.userId, fixture.familyId, oldToken);

    expect(await redisClient.get(fixture.key)).toBe(hashRefreshToken(oldToken));
    expect(await redisClient.get(fixture.key)).not.toBe(oldToken);

    await expect(rotateRefreshSession(redisClient, {
      userId: fixture.userId,
      familyId: fixture.familyId,
      currentToken: oldToken,
      replacementToken,
      expectedRoleVersion: 0,
      ttlSeconds: 60,
    })).resolves.toBe('ROTATED');

    expect(await redisClient.get(fixture.key)).toBe(hashRefreshToken(replacementToken));
  });

  it('detects replay, increments role_version atomically, and revokes the family', async () => {
    const fixture = makeFixture();
    const oldToken = 'refresh-token-replay';
    await seedSession(fixture.userId, fixture.familyId, oldToken);

    await expect(rotateRefreshSession(redisClient, {
      userId: fixture.userId,
      familyId: fixture.familyId,
      currentToken: oldToken,
      replacementToken: 'refresh-token-first-rotation',
      expectedRoleVersion: 0,
      ttlSeconds: 60,
    })).resolves.toBe('ROTATED');

    await expect(rotateRefreshSession(redisClient, {
      userId: fixture.userId,
      familyId: fixture.familyId,
      currentToken: oldToken,
      replacementToken: 'refresh-token-second-rotation',
      expectedRoleVersion: 0,
      ttlSeconds: 60,
    })).resolves.toBe('REPLAYED');

    expect(await redisClient.get(fixture.versionKey)).toBe('1');
    expect(await redisClient.get(fixture.key)).toBeNull();
  });

  it('allows only one concurrent request to consume a token', async () => {
    const fixture = makeFixture();
    const oldToken = 'refresh-token-concurrent';
    await seedSession(fixture.userId, fixture.familyId, oldToken);

    const outcomes = await Promise.all([
      rotateRefreshSession(redisClient, {
        userId: fixture.userId,
        familyId: fixture.familyId,
        currentToken: oldToken,
        replacementToken: 'refresh-token-concurrent-a',
        expectedRoleVersion: 0,
        ttlSeconds: 60,
      }),
      rotateRefreshSession(redisClient, {
        userId: fixture.userId,
        familyId: fixture.familyId,
        currentToken: oldToken,
        replacementToken: 'refresh-token-concurrent-b',
        expectedRoleVersion: 0,
        ttlSeconds: 60,
      }),
    ]);

    expect(outcomes.filter((result) => result === 'ROTATED')).toHaveLength(1);
    expect(outcomes.filter((result) => result === 'REPLAYED')).toHaveLength(1);
    expect(await redisClient.get(fixture.versionKey)).toBe('1');
    expect(await redisClient.get(fixture.key)).toBeNull();
  });

  it('rejects a stale role version and removes the obsolete family', async () => {
    const fixture = makeFixture();
    await seedSession(fixture.userId, fixture.familyId, 'refresh-token-stale-role');
    await redisClient.set(fixture.versionKey, '2');

    await expect(rotateRefreshSession(redisClient, {
      userId: fixture.userId,
      familyId: fixture.familyId,
      currentToken: 'refresh-token-stale-role',
      replacementToken: 'refresh-token-replacement-stale-role',
      expectedRoleVersion: 1,
      ttlSeconds: 60,
    })).resolves.toBe('REVOKED');

    expect(await redisClient.get(fixture.key)).toBeNull();
  });

  it('returns MISSING when the family has expired or already been removed', async () => {
    const fixture = makeFixture();

    await expect(rotateRefreshSession(redisClient, {
      userId: fixture.userId,
      familyId: fixture.familyId,
      currentToken: 'refresh-token-missing',
      replacementToken: 'refresh-token-replacement-missing',
      expectedRoleVersion: 0,
      ttlSeconds: 60,
    })).resolves.toBe('MISSING');
  });
});
