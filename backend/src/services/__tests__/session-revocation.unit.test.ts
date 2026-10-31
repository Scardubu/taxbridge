import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { bumpAuthVersion, invalidateUserSessions, revokeUserRefreshSessions } from '../session-revocation';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));
jest.mock('../../lib/redis', () => ({
  redis: { eval: jest.fn() },
}));

describe('session revocation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('increments the durable auth version in a Prisma transaction', async () => {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ authVersion: 7 }) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
    (redis.eval as jest.Mock).mockResolvedValue(2);

    await expect(invalidateUserSessions('user-1')).resolves.toBe(7);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { authVersion: { increment: 1 } },
      select: { authVersion: true },
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('SMEMBERS'),
      2,
      'rtfamilies:user-1',
      'sessions:user-1',
      'rtf:user-1:',
      'rt:user-1:',
    );
  });

  it('does not undo the durable invalidation when Redis cleanup is unavailable', async () => {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ authVersion: 8 }) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
    (redis.eval as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));

    await expect(invalidateUserSessions('user-2')).resolves.toBe(8);
  });

  it('uses the supplied transaction for version bumps', async () => {
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ authVersion: 9 }) },
    };
    await expect(bumpAuthVersion(tx as never, 'user-3')).resolves.toBe(9);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('treats direct refresh-session cleanup as best effort', async () => {
    (redis.eval as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));
    await expect(revokeUserRefreshSessions('user-4')).resolves.toBeUndefined();
  });
});
