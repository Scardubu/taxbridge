import { prisma } from '../../lib/prisma';
import { revokeUserRefreshSessions } from '../session-revocation';
import { PrivacyService } from '../privacy';

jest.mock('../../lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('../session-revocation', () => ({
  bumpAuthVersion: jest.fn().mockResolvedValue(4),
  revokeUserRefreshSessions: jest.fn().mockResolvedValue(undefined),
}));

describe('privacy erasure lifecycle', () => {
  const service = new PrivacyService();
  const userId = '11111111-1111-4111-8111-111111111111';
  const tx = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    invoice: { updateMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({ id: userId, deleted: false });
    tx.user.update.mockResolvedValue({ id: userId, deleted: true, authVersion: 4 });
    tx.auditLog.create.mockResolvedValue({});
    tx.invoice.updateMany.mockResolvedValue({ count: 2 });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  it('atomically records erasure, anonymizes records and increments authVersion', async () => {
    await service.deleteUserData(userId, 'User requested account erasure');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: { action: 'user_data_deletion', userId, metadata: { reason: 'User requested account erasure' } },
    });
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: userId },
      data: expect.objectContaining({
        email: null, passwordHash: null, verificationToken: null,
        mfaSecret: null, mfaTempSecret: null, mfaEnabled: false, deleted: true,
      }),
    }));
    expect(tx.invoice.updateMany).toHaveBeenCalledWith({
      where: { userId }, data: { customerName: '[REDACTED]' },
    });
    const { bumpAuthVersion } = jest.requireMock('../session-revocation');
    expect(bumpAuthVersion).toHaveBeenCalledWith(tx, userId);
    expect(revokeUserRefreshSessions).toHaveBeenCalledWith(userId);
  });

  it('does not repeat erasure or session revocation for an already-erased user', async () => {
    tx.user.findUnique.mockResolvedValue({ id: userId, deleted: true });
    await service.deleteUserData(userId, 'Repeated erasure request');
    const { bumpAuthVersion } = jest.requireMock('../session-revocation');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(bumpAuthVersion).not.toHaveBeenCalled();
    expect(revokeUserRefreshSessions).not.toHaveBeenCalled();
  });

  it('does not revoke sessions when the database transaction fails', async () => {
    tx.user.update.mockRejectedValue(new Error('database write failed'));
    await expect(service.deleteUserData(userId, 'User requested account erasure')).rejects.toThrow('database write failed');
    expect(revokeUserRefreshSessions).not.toHaveBeenCalled();
  });

  it('rejects an erasure request for a missing user', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(service.deleteUserData(userId, 'User requested account erasure')).rejects.toThrow('User not found');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(revokeUserRefreshSessions).not.toHaveBeenCalled();
  });
});
