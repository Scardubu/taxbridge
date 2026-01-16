/**
 * TaxBridge Growth Service - Production Stub
 * 
 * This service provides growth-oriented features like:
 * - Welcome campaigns
 * - Churn risk analysis
 * - Referral programs
 * - Upgrade prompts
 * 
 * NOTE: Full implementation requires additional schema fields:
 * - User.segment, User.referralCode, User.plan, User.lastInvoiceCreatedAt
 * - User.payments relation
 * 
 * These features are scheduled for Phase G (Growth & ML Instrumentation)
 * See: PHASE_F_MASTER_REPORT.md for roadmap
 * 
 * @version 5.0.2 - Production stub
 * @date January 2026
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';

const logger = createLogger('growth-service');

export interface CampaignSchedule {
  userId: string;
  template: string;
  delay: number;
  channel: 'email' | 'sms' | 'push';
}

export interface ChurnRiskProfile {
  userId: string;
  riskScore: number;
  lastActivity: Date;
  invoiceCount: number;
  daysSinceLastInvoice: number;
  triggers: string[];
}

export interface ReferralCandidate {
  userId: string;
  name: string;
  referralCode: string | null;
  referralLink: string;
}

export interface UpgradeCandidate {
  userId: string;
  name: string;
  invoiceCount: number;
  qualifiesForPro: boolean;
  savingsEstimate: number;
}

export interface UserHealthReport {
  userId: string;
  name: string;
  invoiceCount: number;
  daysSinceLastInvoice: number | null;
  paymentSuccessRate: number;
  healthScore: number;
  recommendations: string[];
}

/**
 * Growth Service - Handles user engagement and retention
 * 
 * Production stub - returns empty/default data until
 * schema is extended with growth-specific fields.
 */
export class GrowthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Start welcome campaign for new users
   * Production stub - logs intent but does not schedule emails
   */
  async startWelcomeCampaign(userId: string): Promise<void> {
    logger.info('Welcome campaign requested (stub)', { userId });
    // Full implementation requires email queue setup
    // See: growth.ts.bak for planned implementation
  }

  /**
   * Get users at risk of churning
   * Production stub - returns empty array
   */
  async getChurnRiskUsers(): Promise<ChurnRiskProfile[]> {
    logger.info('Churn risk analysis requested (stub)');
    return [];
  }

  /**
   * Generate re-engagement content for at-risk user
   * Production stub - returns placeholder content
   */
  async generateReengagementContent(profile: ChurnRiskProfile): Promise<{
    subject: string;
    body: string;
    cta: string;
  }> {
    logger.info('Re-engagement content requested (stub)', { userId: profile.userId });
    return {
      subject: 'We miss you at TaxBridge!',
      body: 'Your tax compliance journey awaits. Come back and see what\'s new!',
      cta: 'Open TaxBridge'
    };
  }

  /**
   * Get candidates for referral program
   * Production stub - returns empty array
   */
  async getReferralCandidates(): Promise<ReferralCandidate[]> {
    logger.info('Referral candidates requested (stub)');
    return [];
  }

  /**
   * Get candidates for pro plan upgrade
   * Production stub - returns empty array
   */
  async getUpgradeCandidates(): Promise<UpgradeCandidate[]> {
    logger.info('Upgrade candidates requested (stub)');
    return [];
  }

  /**
   * Get comprehensive user health report
   * Production implementation - uses available schema fields
   */
  async getUserHealthReport(userId: string): Promise<UserHealthReport | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!user) {
        return null;
      }

      const invoiceCount = user.invoices.length;
      const lastInvoice = user.invoices[0];
      const daysSinceLastInvoice = lastInvoice
        ? Math.floor((Date.now() - lastInvoice.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      // Calculate health score based on available data
      let healthScore = 50; // Base score
      
      if (invoiceCount > 0) healthScore += 20;
      if (invoiceCount >= 5) healthScore += 10;
      if (daysSinceLastInvoice !== null && daysSinceLastInvoice < 7) healthScore += 20;
      
      // Cap at 100
      healthScore = Math.min(100, healthScore);

      const recommendations: string[] = [];
      
      if (invoiceCount === 0) {
        recommendations.push('Create your first invoice to get started');
      }
      if (daysSinceLastInvoice !== null && daysSinceLastInvoice > 14) {
        recommendations.push('Create an invoice to maintain tax compliance');
      }
      if (!user.tin) {
        recommendations.push('Add your TIN for NRS compliance');
      }

      return {
        userId: user.id,
        name: user.name,
        invoiceCount,
        daysSinceLastInvoice,
        paymentSuccessRate: 0, // Not yet implemented
        healthScore,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to generate health report', { userId, error });
      return null;
    }
  }

  /**
   * Generate referral code for user
   * Production stub - returns placeholder
   */
  async generateReferralCode(userId: string): Promise<string> {
    logger.info('Referral code generation requested (stub)', { userId });
    // In production, this would update User.referralCode field
    return `REF-${userId.substring(0, 8).toUpperCase()}`;
  }

  /**
   * Run all growth campaigns
   * Production stub - logs intent
   */
  async runGrowthCampaigns(): Promise<{
    welcomeCampaigns: number;
    churnPrevention: number;
    referralOutreach: number;
    upgradePrompts: number;
  }> {
    logger.info('Growth campaigns execution requested (stub)');
    return {
      welcomeCampaigns: 0,
      churnPrevention: 0,
      referralOutreach: 0,
      upgradePrompts: 0
    };
  }
}

// Export singleton factory
let growthServiceInstance: GrowthService | null = null;

export function getGrowthService(prisma: PrismaClient): GrowthService {
  if (!growthServiceInstance) {
    growthServiceInstance = new GrowthService(prisma);
  }
  return growthServiceInstance;
}

export default GrowthService;
