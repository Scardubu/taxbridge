/**
 * VAT Credit Service — TaxBridge V13 Sovereign
 *
 * C-22: VAT credit read from VATCreditBalance — never recompute from transactions.
 * Read and write VATCreditBalance. Never recalculates from invoice history.
 */
import { prisma }  from '../lib/prisma';
import { logger }  from '../lib/logger';

export const vatCreditService = {
  /**
   * Get the current VAT credit balance for an org.
   * Returns 0 if no record exists.
   */
  async getBalance(orgId: string): Promise<number> {
    try {
      const record = await (prisma as any).vATCreditBalance.findFirst({
        where:   { orgId },
        orderBy: { createdAt: 'desc' },
      });
      return record?.balance ?? 0;
    } catch (err) {
      logger.warn({ err, orgId }, 'vatCreditService.getBalance failed');
      return 0;
    }
  },

  /**
   * Set the VAT credit balance for an org.
   * Creates or updates the record.
   */
  async setBalance(orgId: string, balance: number): Promise<void> {
    try {
      await (prisma as any).vATCreditBalance.upsert({
        where:  { orgId },
        update: { balance, updatedAt: new Date() },
        create: { orgId, balance },
      });
    } catch (err) {
      logger.warn({ err, orgId }, 'vatCreditService.setBalance failed');
    }
  },
};
