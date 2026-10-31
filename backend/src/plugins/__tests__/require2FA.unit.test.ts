import { require2FA } from '../require2FA';
import { redis } from '../../lib/redis';

jest.mock('../../lib/redis', () => ({
  redis: {
    get: jest.fn(),
  },
}));

describe('require2FA', () => {
  const makeReply = () => ({
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts a verification proof scoped to the current user and token jti', async () => {
    (redis.get as jest.Mock).mockResolvedValue('1');
    const request = {
      user: { userId: 'user-1', jti: 'session-a' },
      log: { error: jest.fn() },
    } as any;
    const reply = makeReply();

    await require2FA(request, reply as any);

    expect(redis.get).toHaveBeenCalledWith('totp:verified:user-1:session-a');
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('does not accept another session proof', async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    const request = {
      user: { userId: 'user-1', jti: 'session-b' },
      log: { error: jest.fn() },
    } as any;
    const reply = makeReply();

    await require2FA(request, reply as any);

    expect(redis.get).toHaveBeenCalledWith('totp:verified:user-1:session-b');
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: '2FA_REQUIRED' }));
  });

  it('fails closed when the access token has no session identifier', async () => {
    const request = {
      user: { userId: 'user-1' },
      log: { error: jest.fn() },
    } as any;
    const reply = makeReply();

    await require2FA(request, reply as any);

    expect(redis.get).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('returns 503 rather than bypassing the guard when Redis is unavailable', async () => {
    (redis.get as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));
    const request = {
      user: { userId: 'user-1', jti: 'session-a' },
      log: { error: jest.fn() },
    } as any;
    const reply = makeReply();

    await require2FA(request, reply as any);

    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'AUTHENTICATION_DEPENDENCY_UNAVAILABLE',
    });
    expect(request.log.error).toHaveBeenCalledTimes(1);
  });
});
