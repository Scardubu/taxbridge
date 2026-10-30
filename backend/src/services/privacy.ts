import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { bumpAuthVersion, revokeUserRefreshSessions } from './session-revocation';

const log = createLogger('privacy');

export class PrivacyService {
  async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        invoices: {
          include: { payments: true }
        },
        auditLogs: true,
        consents: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      personal: {
        name: user.name,
        phone: user.phone,
        email: user.email,
        createdAt: user.createdAt,
        verified: user.verified,
        smsOptIn: user.smsOptIn
      },
      invoices: user.invoices.map(inv => ({
        id: inv.id,
        status: inv.status,
        subtotal: inv.subtotal,
        vat: inv.vat,
        total: inv.total,
        createdAt: inv.createdAt,
        payments: inv.payments.map(payment => ({
          id: payment.id,
          rrr: payment.rrr,
          status: payment.status,
          amount: payment.amount,
          paidAt: payment.paidAt
        }))
      })),
      auditTrail: user.auditLogs,
      consents: user.consents
    };
  }

  async deleteUserData(userId: string, reason: string): Promise<void> {
    const anonPhone = `+234${crypto.randomInt(1000000000, 9999999999)}`;

    // Erasure, audit evidence and auth-version increment commit atomically.
    // The JWT verifier checks authVersion on every request, so a committed
    // erasure immediately invalidates every previously issued access token.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, deleted: true },
      });
      if (!user) throw new Error('User not found');
      if (user.deleted) return;

      await tx.auditLog.create({
        data: {
          action: 'user_data_deletion',
          userId,
          metadata: { reason },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          name: `[DELETED-${userId.slice(0, 8)}]`,
          phone: anonPhone,
          email: null,
          passwordHash: null,
          tin: null,
          nin: null,
          duploClientId: null,
          duploClientSecret: null,
          remitaMerchantId: null,
          remitaApiKey: null,
          ecdsaPrivateKey: null,
          verificationToken: null,
          verificationTokenExpiry: null,
          mfaSecret: null,
          mfaTempSecret: null,
          mfaEnabled: false,
          deleted: true,
          deletedAt: new Date(),
        },
      });

      await tx.invoice.updateMany({
        where: { userId },
        data: { customerName: '[REDACTED]' },
      });

      await bumpAuthVersion(tx, userId);
    });

    // PostgreSQL authVersion is authoritative; Redis indexes are cleanup only.
    await revokeUserRefreshSessions(userId);
    log.info('User data erased and sessions invalidated', { userId });
  }

  async exportPortableData(userId: string): Promise<Buffer> {
    const snapshot = await this.exportUserData(userId);
    const csv = this.convertToCSV(snapshot);
    return Buffer.from(csv, 'utf8');
  }

  async updateConsent(userId: string, consentType: string, granted: boolean): Promise<void> {
    await prisma.userConsent.upsert({
      where: {
        userId_consentType: { userId, consentType }
      },
      create: {
        userId,
        consentType,
        granted,
        grantedAt: granted ? new Date() : null
      },
      update: {
        granted,
        grantedAt: granted ? new Date() : null,
        revokedAt: granted ? null : new Date()
      }
    });
  }

  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const consent = await prisma.userConsent.findUnique({
      where: {
        userId_consentType: { userId, consentType }
      }
    });
    return Boolean(consent?.granted);
  }

  private convertToCSV(data: any): string {
    let csv = 'Section,Field,Value\n';
    Object.entries(data.personal).forEach(([field, value]) => {
      csv += `Personal,${field},${value ?? ''}\n`;
    });

    data.invoices.forEach((invoice: any) => {
      csv += `Invoice,id,${invoice.id}\n`;
      csv += `Invoice,status,${invoice.status}\n`;
      csv += `Invoice,total,${invoice.total}\n`;
    });

    return csv;
  }
}

export const privacyService = new PrivacyService();
