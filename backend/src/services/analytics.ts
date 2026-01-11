import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';

const logger = createLogger('analytics-service');

export interface ChatbotMetrics {
  totalQueries: number;
  uniqueUsers: number;
  queriesByLanguage: Record<string, number>;
  queriesByAction: Record<string, number>;
  averageResponseTime: number;
  successRate: number;
  topQueries: Array<{ query: string; count: number }>;
  period: {
    startDate?: Date;
    endDate?: Date;
  };
}

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getChatbotMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<ChatbotMetrics> {
    try {
      const whereClause: any = {
        action: {
          startsWith: 'chatbot_'
        }
      };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startDate;
        if (endDate) whereClause.createdAt.lte = endDate;
      }

      // Total queries
      const totalQueries = await this.prisma.auditLog.count({
        where: whereClause
      });

      // Unique users
      const uniqueUsers = await this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: whereClause,
        _count: true
      });

      // Queries by language
      const queriesByLanguageRaw = await this.prisma.auditLog.groupBy({
        by: ['metadata'],
        where: whereClause,
        _count: true
      });

      const queriesByLanguage = this.extractLanguageStats(queriesByLanguageRaw);

      // Queries by action
      const queriesByActionRaw = await this.prisma.auditLog.groupBy({
        by: ['action'],
        where: whereClause,
        _count: true
      });

      const queriesByAction = queriesByActionRaw.reduce((acc, item) => {
        acc[item.action] = item._count;
        return acc;
      }, {} as Record<string, number>);

      // Top queries
      const topQueriesRaw = await this.prisma.auditLog.findMany({
        where: whereClause,
        select: {
          metadata: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      });

      const topQueries = this.extractTopQueries(topQueriesRaw);

      // Success rate (based on completed actions)
      const successActions = await this.prisma.auditLog.count({
        where: {
          ...whereClause,
          action: {
            in: ['chatbot_einvoice_submit', 'chatbot_payment_generate']
          }
        }
      });

      const successRate = totalQueries > 0 ? (successActions / totalQueries) * 100 : 0;

      // Average response time (mock - would need timing data)
      const averageResponseTime = 850; // milliseconds

      return {
        totalQueries,
        uniqueUsers: uniqueUsers.length,
        queriesByLanguage,
        queriesByAction,
        averageResponseTime,
        successRate,
        topQueries,
        period: { startDate, endDate }
      };

    } catch (error) {
      logger.error('Failed to get chatbot metrics', { err: error });
      throw error;
    }
  }

  async getComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    try {
      // Get all chatbot-related audit logs
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          action: {
            startsWith: 'chatbot_'
          },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Group by action type for compliance tracking
      const complianceData = {
        totalQueries: auditLogs.length,
        einvoiceSubmissions: 0,
        paymentGenerations: 0,
        failedActions: 0,
        userActivity: {} as Record<string, number>,
        dailyActivity: {} as Record<string, number>
      };

      auditLogs.forEach(log => {
        // Count action types
        if (log.action === 'chatbot_einvoice_submit') {
          complianceData.einvoiceSubmissions++;
        } else if (log.action === 'chatbot_payment_generate') {
          complianceData.paymentGenerations++;
        }

        // Count user activity
        if (log.userId) {
          complianceData.userActivity[log.userId] = 
            (complianceData.userActivity[log.userId] || 0) + 1;
        }

        // Count daily activity
        const dateKey = log.createdAt.toISOString().split('T')[0];
        complianceData.dailyActivity[dateKey] = 
          (complianceData.dailyActivity[dateKey] || 0) + 1;
      });

      return complianceData;

    } catch (error) {
      logger.error('Failed to generate compliance report', { err: error });
      throw error;
    }
  }

  async exportAnalyticsData(
    format: 'json' | 'csv' = 'json',
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    try {
      const metrics = await this.getChatbotMetrics(startDate, endDate);
      
      if (format === 'csv') {
        return this.convertToCSV(metrics);
      }
      
      return JSON.stringify(metrics, null, 2);

    } catch (error) {
      logger.error('Failed to export analytics data', { err: error });
      throw error;
    }
  }

  private extractLanguageStats(queriesByLanguageRaw: any[]): Record<string, number> {
    const languageStats: Record<string, number> = { en: 0, pidgin: 0 };

    queriesByLanguageRaw.forEach(item => {
      const metadata = item.metadata as any;
      if (metadata?.language) {
        languageStats[metadata.language] = (languageStats[metadata.language] || 0) + item._count;
      }
    });

    return languageStats;
  }

  private extractTopQueries(topQueriesRaw: any[]): Array<{ query: string; count: number }> {
    const queryCounts: Record<string, number> = {};

    topQueriesRaw.forEach(item => {
      const metadata = item.metadata as any;
      if (metadata?.query) {
        const query = metadata.query.toLowerCase().trim();
        queryCounts[query] = (queryCounts[query] || 0) + 1;
      }
    });

    return Object.entries(queryCounts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private convertToCSV(metrics: ChatbotMetrics): string {
    const headers = [
      'Metric',
      'Value',
      'Details'
    ];

    const rows = [
      ['Total Queries', metrics.totalQueries.toString(), ''],
      ['Unique Users', metrics.uniqueUsers.toString(), ''],
      ['English Queries', metrics.queriesByLanguage.en?.toString() || '0', ''],
      ['Pidgin Queries', metrics.queriesByLanguage.pidgin?.toString() || '0', ''],
      ['E-Invoice Submissions', metrics.queriesByAction['chatbot_einvoice_submit']?.toString() || '0', ''],
      ['Payment Generations', metrics.queriesByAction['chatbot_payment_generate']?.toString() || '0', ''],
      ['Success Rate', `${metrics.successRate.toFixed(2)}%`, ''],
      ['Average Response Time', `${metrics.averageResponseTime}ms`, ''],
      ['Period Start', metrics.period.startDate?.toISOString() || 'All time', ''],
      ['Period End', metrics.period.endDate?.toISOString() || 'Now', '']
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }

  // Real-time monitoring
  async getRealTimeStats(): Promise<any> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentQueries = await this.prisma.auditLog.count({
      where: {
        action: {
          startsWith: 'chatbot_'
        },
        createdAt: {
          gte: oneHourAgo
        }
      }
    });

    const activeUsers = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        action: {
          startsWith: 'chatbot_'
        },
        createdAt: {
          gte: oneHourAgo
        }
      },
      _count: true
    });

    return {
      queriesLastHour: recentQueries,
      activeUsersLastHour: activeUsers.length,
      timestamp: now.toISOString()
    };
  }
}

export default AnalyticsService;
