import type { FastifyReply, FastifyRequest } from 'fastify';

const mockFindFirst = jest.fn();
jest.mock('../lib/prisma', () => ({
  prisma: { user: { findFirst: mockFindFirst } },
}));

import { requirePlatformAdmin } from '../plugins/requirePlatformAdmin';

function makeContext(userId = '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55') {
  const request = {
    user: { userId },
    log: { error: jest.fn() },
  } as unknown as FastifyRequest;
  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return { request, reply };
}

describe('requirePlatformAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['ADMIN', 'admin', 'SUPER_ADMIN', 'super_admin'])(
    'accepts global platform role %s',
    async (role) => {
      mockFindFirst.mockResolvedValue({ role });
      const { request, reply } = makeContext();

      await requirePlatformAdmin(request, reply);

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { id: request.user.userId, deleted: false },
        select: { role: true },
      });
      expect(reply.code).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    },
  );

  it.each(['OWNER', 'owner', 'ACCOUNTANT', 'VIEWER', 'member'])(
    'rejects organization-scoped role %s',
    async (role) => {
      mockFindFirst.mockResolvedValue({ role });
      const { request, reply } = makeContext();

      await requirePlatformAdmin(request, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({ error: 'PLATFORM_ADMIN_REQUIRED' });
    },
  );

  it('rejects missing or deleted platform identities', async () => {
    mockFindFirst.mockResolvedValue(null);
    const { request, reply } = makeContext();

    await requirePlatformAdmin(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'PLATFORM_IDENTITY_NOT_ACTIVE' });
  });

  it('fails closed when the platform-role lookup is unavailable', async () => {
    mockFindFirst.mockRejectedValue(new Error('database unavailable'));
    const { request, reply } = makeContext();

    await requirePlatformAdmin(request, reply);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({ error: 'PLATFORM_AUTHORIZATION_UNAVAILABLE' });
    expect(request.log.error).toHaveBeenCalledTimes(1);
  });

  it('rejects requests without an authenticated user ID', async () => {
    const { request, reply } = makeContext('');
    (request as any).user = undefined;

    await requirePlatformAdmin(request, reply);

    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: 'UNAUTHENTICATED' });
  });
});
