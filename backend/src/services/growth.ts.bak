import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from '../queue/client';
import { createLogger } from '../lib/logger';

const logger = createLogger('growth-service');

// Email queue for campaign automation
const emailQueue = new Queue('email-campaign', {
  connection: getRedisConnection()
});

// SMS queue for targeted messaging
const smsQueue = new Queue('sms-campaign', {
  connection: getRedisConnection()
});

export interface CampaignSchedule {
  userId: string;
  template: string;
  delay: number; // milliseconds
  channel: 'email' | 'sms' | 'push';
}

export interface ChurnRiskProfile {
  userId: string;
  riskScore: number; // 0-1
  lastActivity: Date;
  invoiceCount: number;
  daysSinceLastInvoice: number;
  triggers: string[];
}

export class GrowthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Start welcome campaign for new users
   * Day 0: Welcome email
   * Day 3: Feature highlight (OCR)
   * Day 7: Tax tips + NPS survey
   * Day 14: Referral program intro
   */
  async startWelcomeCampaign(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, createdAt: true }
      });

      if (!user) {
        logger.warn('User not found for welcome campaign', { userId });
        return;
      }

      // Day 0: Immediate welcome
      await emailQueue.add(
        'welcome',
        {
          userId,
          template: 'welcome',
          subject: 'Welcome to TaxBridge – Let\'s Get Started!',
          userName: user.name
        },
        { delay: 0 }
      );

      // Day 3: Feature highlight (OCR)
      await emailQueue.add(
        'feature_ocr',
        {
          userId,
          template: 'feature_ocr',
          subject: 'Snap & Upload: Digitize Receipts in Seconds',
          userName: user.name
        },
        { delay: 3 * 24 * 60 * 60 * 1000 } // 3 days
      );

      // Day 7: Tax tips + NPS survey
      await emailQueue.add(
        'tax_tips_nps',
        {
          userId,
          template: 'tax_tips_nps',
          subject: 'Quick Tax Tips + We\'d Love Your Feedback',
          userName: user.name,
          npsLink: `https://taxbridge.ng/survey?user=${userId}`
        },
        { delay: 7 * 24 * 60 * 60 * 1000 } // 7 days
      );

      // Day 14: Referral program
      await emailQueue.add(
        'referral_intro',
        {
          userId,
          template: 'referral',
          subject: 'Earn ₦500 for Every Friend You Refer',
          userName: user.name,
          referralCode: await this.generateReferralCode(userId)
        },
        { delay: 14 * 24 * 60 * 60 * 1000 } // 14 days
      );

      await this.prisma.auditLog.create({
        data: {
          action: 'WELCOME_CAMPAIGN_STARTED',
          userId,
          metadata: { startedAt: new Date().toISOString() }
        }
      });

      logger.info('Welcome campaign started', { userId });
    } catch (error) {
      logger.error('Failed to start welcome campaign', { err: error, userId });
      throw error;
    }
  }

  /**
   * Re-engage users who haven't created an invoice in 7+ days
   * Targets traders, freelancers with <30 days since signup
   */
  async reengageInactiveUsers(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const inactiveUsers = await this.prisma.user.findMany({
        where: {
          AND: [
            { lastInvoiceCreatedAt: { lt: sevenDaysAgo } },
            { createdAt: { gt: thirtyDaysAgo } },
            {
              OR: [
                { segment: 'trader' },
                { segment: 'freelancer' }
              ]
            }
          ]
        },
        select: {
          id: true,
          phone: true,
          name: true,
          segment: true,
          lastInvoiceCreatedAt: true
        },
        take: 50 // Batch limit
      });

      for (const user of inactiveUsers) {
        const message = `Hi ${user.name}! 👋 We noticed you haven't created an invoice lately. Need help? Reply STOP to unsubscribe.`;

        await smsQueue.add(
          'reactivation',
          {
            userId: user.id,
            phone: user.phone,
            message,
            template: 'reactivation'
          },
          { attempts: 3, backoff: { type: 'exponential', delay: 60000 } }
        );

        await this.prisma.auditLog.create({
          data: {
            action: 'REACTIVATION_SMS_SENT',
            userId: user.id,
            metadata: {
              segment: user.segment,
              daysSinceLastInvoice: Math.floor(
                (Date.now() - (user.lastInvoiceCreatedAt?.getTime() || Date.now())) /
                  (24 * 60 * 60 * 1000)
              )
            }
          }
        });
      }

      logger.info('Reactivation campaign executed', {
        usersTargeted: inactiveUsers.length
      });
    } catch (error) {
      logger.error('Failed to re-engage inactive users', { err: error });
      throw error;
    }
  }

  /**
   * Send referral reminder to active users with no referrals yet
   */
  async sendReferralReminder(): Promise<void> {
    try {
      const activeUsers = await this.prisma.user.findMany({
        where: {
          AND: [
            { createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
            { referralCode: { not: null } }
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          referralCode: true,
          _count: {
            select: { referrals: true }
          }
        },
        take: 100
      });

      const usersWithNoReferrals = activeUsers.filter(u => u._count.referrals === 0);

      for (const user of usersWithNoReferrals) {
        await emailQueue.add(
          'referral_reminder',
          {
            userId: user.id,
            template: 'referral_reminder',
            subject: 'Share TaxBridge & Earn ₦500 per Referral',
            userName: user.name,
            referralCode: user.referralCode,
            referralLink: `https://taxbridge.ng/signup?ref=${user.referralCode}`
          },
          { delay: 0 }
        );
      }

      logger.info('Referral reminders sent', {
        usersTargeted: usersWithNoReferrals.length
      });
    } catch (error) {
      logger.error('Failed to send referral reminders', { err: error });
      throw error;
    }
  }

  /**
   * Prompt users to upgrade to premium based on usage patterns
   * Triggers: >10 invoices, >₦1M total value, or using advanced features
   */
  async promptPremiumUpgrade(): Promise<void> {
    try {
      const eligibleUsers = await this.prisma.user.findMany({
        where: {
          AND: [
            { plan: 'free' },
            { createdAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          _count: {
            select: { invoices: true }
          }
        },
        take: 50
      });

      const qualifiedUsers = eligibleUsers.filter(u => u._count.invoices >= 10);

      for (const user of qualifiedUsers) {
        await emailQueue.add(
          'upgrade_prompt',
          {
            userId: user.id,
            template: 'upgrade_premium',
            subject: 'Unlock Premium: Advanced Features Await',
            userName: user.name,
            invoiceCount: user._count.invoices,
            premiumFeatures: [
              'Unlimited invoices',
              'Priority support',
              'Advanced reporting',
              'Multi-user access',
              'API integrations'
            ]
          },
          { delay: 0 }
        );

        await this.prisma.auditLog.create({
          data: {
            action: 'UPGRADE_PROMPT_SENT',
            userId: user.id,
            metadata: { invoiceCount: user._count.invoices }
          }
        });
      }

      logger.info('Premium upgrade prompts sent', {
        usersTargeted: qualifiedUsers.length
      });
    } catch (error) {
      logger.error('Failed to send upgrade prompts', { err: error });
      throw error;
    }
  }

  /**
   * Collect NPS feedback from users after 30 days
   */
  async collectNPSFeedback(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

      const users = await this.prisma.user.findMany({
        where: {
          AND: [
            { createdAt: { gte: thirtyFiveDaysAgo, lte: thirtyDaysAgo } },
            {
              NOT: {
                auditLogs: {
                  some: {
                    action: 'NPS_SURVEY_SENT'
                  }
                }
              }
            }
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true
        },
        take: 50
      });

      for (const user of users) {
        const surveyLink = `https://taxbridge.ng/nps?user=${user.id}`;

        // Send via email
        await emailQueue.add(
          'nps_survey',
          {
            userId: user.id,
            template: 'nps_survey',
            subject: 'Quick Question: How Likely Are You to Recommend TaxBridge?',
            userName: user.name,
            surveyLink
          },
          { delay: 0 }
        );

        // Also send SMS reminder after 24 hours if no response
        await smsQueue.add(
          'nps_reminder',
          {
            userId: user.id,
            phone: user.phone,
            message: `Hi ${user.name}! We'd love your feedback on TaxBridge. ${surveyLink}`,
            template: 'nps_reminder'
          },
          { delay: 24 * 60 * 60 * 1000 }
        );

        await this.prisma.auditLog.create({
          data: {
            action: 'NPS_SURVEY_SENT',
            userId: user.id,
            metadata: { sentAt: new Date().toISOString(), surveyLink }
          }
        });
      }

      logger.info('NPS surveys sent', { usersTargeted: users.length });
    } catch (error) {
      logger.error('Failed to collect NPS feedback', { err: error });
      throw error;
    }
  }

  /**
   * ML-based churn prediction (placeholder for TensorFlow integration)
   * Analyzes user behavior to predict churn risk
   * 
   * For production: Load pre-trained model from ML_MODEL_PATH
   * Features: invoice_count, days_since_last_invoice, payment_success_rate, support_tickets
   */
  async predictChurnRisk(userId: string): Promise<ChurnRiskProfile | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          invoices: {
            select: {
              createdAt: true,
              status: true
            },
            orderBy: { createdAt: 'desc' }
          },
          payments: {
            select: {
              status: true
            }
          }
        }
      });

      if (!user) {
        logger.warn('User not found for churn prediction', { userId });
        return null;
      }

      const invoiceCount = user.invoices.length;
      const lastInvoice = user.invoices[0];
      const daysSinceLastInvoice = lastInvoice
        ? Math.floor((Date.now() - lastInvoice.createdAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      const successfulPayments = user.payments.filter(p => p.status === 'successful').length;
      const totalPayments = user.payments.length;
      const paymentSuccessRate = totalPayments > 0 ? successfulPayments / totalPayments : 1;

      // Simple heuristic-based risk score (replace with ML model in production)
      let riskScore = 0;

      // Factor 1: Inactivity
      if (daysSinceLastInvoice > 14) riskScore += 0.3;
      if (daysSinceLastInvoice > 30) riskScore += 0.3;

      // Factor 2: Low invoice count
      if (invoiceCount < 3) riskScore += 0.2;

      // Factor 3: Payment failures
      if (paymentSuccessRate < 0.7) riskScore += 0.2;

      const triggers: string[] = [];
      if (daysSinceLastInvoice > 14) triggers.push('Inactive 14+ days');
      if (invoiceCount < 3) triggers.push('Low invoice count');
      if (paymentSuccessRate < 0.7) triggers.push('Payment failures');

      const profile: ChurnRiskProfile = {
        userId,
        riskScore: Math.min(riskScore, 1),
        lastActivity: lastInvoice?.createdAt || user.createdAt,
        invoiceCount,
        daysSinceLastInvoice,
        triggers
      };

      // If high risk, trigger reactivation campaign
      if (riskScore > 0.5) {
        await this.reengageInactiveUsers();
        logger.info('High churn risk detected, triggered reactivation', {
          userId,
          riskScore
        });
      }

      return profile;
    } catch (error) {
      logger.error('Failed to predict churn risk', { err: error, userId });
      return null;
    }
  }

  /**
   * Generate unique referral code for user
   */
  private async generateReferralCode(userId: string): Promise<string> {
    const code = `TAX${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code }
    });

    return code;
  }

  /**
   * Health check for growth service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded'; queueStatus: any }> {
    try {
      const emailQueueHealth = await emailQueue.getJobCounts();
      const smsQueueHealth = await smsQueue.getJobCounts();

      const status =
        emailQueueHealth.failed + smsQueueHealth.failed > 10 ? 'degraded' : 'healthy';

      return {
        status,
        queueStatus: {
          email: emailQueueHealth,
          sms: smsQueueHealth
        }
      };
    } catch (error) {
      logger.error('Growth service health check failed', { err: error });
      return {
        status: 'degraded',
        queueStatus: { error: 'Health check failed' }
      };
    }
  }
}

// Singleton instance
let growthServiceInstance: GrowthService | null = null;

export function getGrowthService(prisma: PrismaClient): GrowthService {
  if (!growthServiceInstance) {
    growthServiceInstance = new GrowthService(prisma);
  }
  return growthServiceInstance;
}

export default GrowthService;
