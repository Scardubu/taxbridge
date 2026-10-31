import Fastify, { FastifyInstance } from 'fastify';
import totpRoutes from '../../v1/auth/totp';
import { prisma } from '../../../lib/prisma';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    userTotp: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../lib/redis', () => ({
  redis: {
    setex: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../../services/audit', () => ({
  writeAuditEvent: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('TOTP enrollment protection', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();
    (app as any).decorate('authenticate', async (request: any) => {
      request.user = {
        userId: 'user-1',
        jti: 'session-1',
        email: 'user@example.test',
      };
    });
    await app.register(totpRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not permit an authenticated password-only session to replace an active authenticator', async () => {
    (prisma.userTotp.findUnique as jest.Mock).mockResolvedValue({ active: true });

    const response = await app.inject({ method: 'POST', url: '/setup' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual(expect.objectContaining({ error: 'TOTP_ALREADY_ENABLED' }));
    expect(prisma.userTotp.updateMany).not.toHaveBeenCalled();
    expect(prisma.userTotp.create).not.toHaveBeenCalled();
  });

  it('updates a pending enrollment only while the record remains inactive', async () => {
    (prisma.userTotp.findUnique as jest.Mock).mockResolvedValue({ active: false });
    (prisma.userTotp.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const response = await app.inject({ method: 'POST', url: '/setup' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      secret: expect.any(String),
      uri: expect.stringContaining('otpauth://totp/'),
    }));
    expect(prisma.userTotp.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', active: false },
      data: { pendingSecret: expect.any(String) },
    });
    expect(prisma.userTotp.upsert).not.toHaveBeenCalled();
  });

  it('rejects a setup write if the active flag changes between read and update', async () => {
    (prisma.userTotp.findUnique as jest.Mock).mockResolvedValue({ active: false });
    (prisma.userTotp.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const response = await app.inject({ method: 'POST', url: '/setup' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'TOTP_SETUP_CONFLICT' });
  });

  it('creates a pending enrollment when no TOTP record exists', async () => {
    (prisma.userTotp.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userTotp.create as jest.Mock).mockResolvedValue({ userId: 'user-1', active: false });

    const response = await app.inject({ method: 'POST', url: '/setup' });

    expect(response.statusCode).toBe(200);
    expect(prisma.userTotp.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        pendingSecret: expect.any(String),
        active: false,
      },
    });
  });

  it('maps concurrent first-enrollment uniqueness races to a conflict', async () => {
    (prisma.userTotp.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userTotp.create as jest.Mock).mockRejectedValue({ code: 'P2002' });

    const response = await app.inject({ method: 'POST', url: '/setup' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'TOTP_SETUP_CONFLICT' });
  });
});
