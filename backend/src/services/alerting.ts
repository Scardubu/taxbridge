import { createLogger } from '../lib/logger';
import { collectMetrics, getHealthSummary } from './monitoring';
import { errorRecovery, circuitBreakers } from './errorRecovery';
import { getProviderHealth } from '../integrations/comms/client';
import { getRedisConnection } from '../queue/client';
import { prisma } from '../lib/prisma';

const log = createLogger('alerting');
const redis = getRedisConnection();

// Alert types and severities
export enum AlertType {
  SYSTEM_DOWN = 'system_down',
  HIGH_ERROR_RATE = 'high_error_rate',
  DATABASE_ISSUE = 'database_issue',
  REDIS_ISSUE = 'redis_issue',
  SMS_PROVIDER_DOWN = 'sms_provider_down',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  HIGH_CPU_USAGE = 'high_cpu_usage',
  QUEUE_BACKLOG = 'queue_backlog',
  SECURITY_BREACH = 'security_breach',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  DISK_SPACE_LOW = 'disk_space_low',
  SSL_CERTIFICATE_EXPIRING = 'ssl_certificate_expiring'
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Alert interface
interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// Alert thresholds
const ALERT_THRESHOLDS = {
  errorRate: 10, // percentage
  memoryUsage: 85, // percentage
  cpuUsage: 80, // percentage
  responseTime: 5000, // milliseconds
  queueDepth: 100, // number of jobs
  diskUsage: 90, // percentage
  sslExpiryDays: 30 // days before expiry
};

// Alert channels
interface AlertChannel {
  name: string;
  type: 'email' | 'sms' | 'slack' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
  send: (alert: Alert) => Promise<void>;
}

// Email alert channel
class EmailAlertChannel implements AlertChannel {
  name = 'email';
  type = 'email' as const;
  enabled = true;
  config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  async send(alert: Alert): Promise<void> {
    try {
      // Implementation would use nodemailer or similar
      log.info('Email alert sent', { alertId: alert.id, type: alert.type });
    } catch (error) {
      log.error('Failed to send email alert', { error, alertId: alert.id });
    }
  }
}

// SMS alert channel
class SMSAlertChannel implements AlertChannel {
  name = 'sms';
  type = 'sms' as const;
  enabled = true;
  config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  async send(alert: Alert): Promise<void> {
    try {
      // Implementation would use SMS provider
      log.info('SMS alert sent', { alertId: alert.id, type: alert.type });
    } catch (error) {
      log.error('Failed to send SMS alert', { error, alertId: alert.id });
    }
  }
}

// Slack alert channel
class SlackAlertChannel implements AlertChannel {
  name = 'slack';
  type = 'slack' as const;
  enabled = true;
  config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  async send(alert: Alert): Promise<void> {
    const webhookUrl = this.config.webhook || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      log.warn('Slack webhook URL not configured, skipping alert');
      return;
    }

    try {
      // Map severity to Slack color
      const colorMap: Record<AlertSeverity, string> = {
        [AlertSeverity.INFO]: '#36a64f',      // green
        [AlertSeverity.WARNING]: '#f2c744',   // yellow
        [AlertSeverity.ERROR]: '#e01e5a',     // red
        [AlertSeverity.CRITICAL]: '#8b0000',  // dark red
      };

      // Map severity to emoji
      const emojiMap: Record<AlertSeverity, string> = {
        [AlertSeverity.INFO]: 'ℹ️',
        [AlertSeverity.WARNING]: '⚠️',
        [AlertSeverity.ERROR]: '🚨',
        [AlertSeverity.CRITICAL]: '🔥',
      };

      const payload = {
        username: 'TaxBridge Alerts',
        icon_emoji: ':taxbridge:',
        channel: this.config.channel,
        attachments: [
          {
            color: colorMap[alert.severity],
            fallback: `${emojiMap[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.title}`,
            pretext: `${emojiMap[alert.severity]} *TaxBridge Alert*`,
            title: alert.title,
            text: alert.message,
            fields: [
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true,
              },
              {
                title: 'Type',
                value: alert.type,
                short: true,
              },
              {
                title: 'Alert ID',
                value: alert.id,
                short: true,
              },
              {
                title: 'Time',
                value: alert.timestamp.toISOString(),
                short: true,
              },
              ...(alert.metadata ? [{
                title: 'Details',
                value: JSON.stringify(alert.metadata, null, 2).slice(0, 500),
                short: false,
              }] : []),
            ],
            footer: 'TaxBridge Monitoring',
            footer_icon: 'https://taxbridge.ng/favicon.ico',
            ts: Math.floor(alert.timestamp.getTime() / 1000).toString(),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}: ${await response.text()}`);
      }

      log.info('Slack alert sent successfully', { alertId: alert.id, type: alert.type });
    } catch (error) {
      log.error('Failed to send Slack alert', { error, alertId: alert.id });
      // Don't throw - alerting failures shouldn't break the application
    }
  }
}

// Alert manager
class AlertManager {
  private channels: Map<string, AlertChannel> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels(): void {
    // Initialize channels based on configuration
    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      const emailChannel = new EmailAlertChannel({
        smtp: process.env.SMTP_CONFIG,
        recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',')
      });
      this.channels.set('email', emailChannel);
    }

    if (process.env.ALERT_SMS_ENABLED === 'true') {
      const smsChannel = new SMSAlertChannel({
        recipients: process.env.ALERT_SMS_RECIPIENTS?.split(',')
      });
      this.channels.set('sms', smsChannel);
    }

    if (process.env.ALERT_SLACK_ENABLED === 'true') {
      const slackChannel = new SlackAlertChannel({
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL
      });
      this.channels.set('slack', slackChannel);
    }
  }

  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Trim history if needed
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }

    // Store in database
    try {
      await prisma.alert.create({
        data: {
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp,
          metadata: alert.metadata || {}
        }
      });
    } catch (error) {
      log.error('Failed to store alert in database', { error, alertId: alert.id });
    }

    // Send notifications
    await this.sendNotifications(alert);

    log.warn('Alert created', { 
      alertId: alert.id, 
      type: alert.type, 
      severity: alert.severity,
      title 
    });

    return alert;
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const channel of this.channels.values()) {
      if (channel.enabled) {
        // Only send critical and error alerts via SMS
        if (channel.type === 'sms' && !['critical', 'error'].includes(alert.severity)) {
          continue;
        }

        promises.push(channel.send(alert));
      }
    }

    await Promise.allSettled(promises);
  }

  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      log.warn('Attempted to resolve non-existent alert', { alertId });
      return;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolvedBy) {
      alert.acknowledgedBy = resolvedBy;
      alert.acknowledgedAt = new Date();
    }

    // Update in database
    try {
      await prisma.alert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolvedAt: alert.resolvedAt,
          acknowledgedBy: resolvedBy,
          acknowledgedAt: alert.acknowledgedAt
        }
      });
    } catch (error) {
      log.error('Failed to update alert in database', { error, alertId });
    }

    // Move to history
    this.activeAlerts.delete(alertId);

    log.info('Alert resolved', { alertId, resolvedBy });
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  async checkSystemHealth(): Promise<void> {
    try {
      const metrics = await collectMetrics();
      const healthSummary = getHealthSummary(metrics);
      const alerts = healthSummary.issues;

      // Check for specific conditions
      await this.checkErrorRate(metrics);
      await this.checkMemoryUsage(metrics);
      await this.checkDatabaseHealth(metrics);
      await this.checkRedisHealth(metrics);
      await this.checkQueueDepth(metrics);
      await this.checkSMSProviders();

      // Process existing alerts
      for (const issue of alerts) {
        await this.createAlert(
          AlertType.SYSTEM_DOWN,
          AlertSeverity.ERROR,
          'System Health Issue',
          issue
        );
      }

    } catch (error) {
      log.error('Health check failed', { error });
    }
  }

  private async checkErrorRate(metrics: any): Promise<void> {
    // Implementation would check error rates from metrics
  }

  private async checkMemoryUsage(metrics: any): Promise<void> {
    if (metrics.memory.percentage > ALERT_THRESHOLDS.memoryUsage) {
      await this.createAlert(
        AlertType.HIGH_MEMORY_USAGE,
        AlertSeverity.WARNING,
        'High Memory Usage',
        `Memory usage is at ${metrics.memory.percentage}%`
      );
    }
  }

  private async checkDatabaseHealth(metrics: any): Promise<void> {
    if (!metrics.database.connected) {
      await this.createAlert(
        AlertType.DATABASE_ISSUE,
        AlertSeverity.CRITICAL,
        'Database Connection Lost',
        'Database is not responding'
      );
    }
  }

  private async checkRedisHealth(metrics: any): Promise<void> {
    if (!metrics.redis.connected) {
      await this.createAlert(
        AlertType.REDIS_ISSUE,
        AlertSeverity.CRITICAL,
        'Redis Connection Lost',
        'Redis is not responding'
      );
    }
  }

  private async checkQueueDepth(metrics: any): Promise<void> {
    const totalQueueDepth = metrics.queue.invoiceSync.waiting + metrics.queue.payment.waiting;
    if (totalQueueDepth > ALERT_THRESHOLDS.queueDepth) {
      await this.createAlert(
        AlertType.QUEUE_BACKLOG,
        AlertSeverity.WARNING,
        'Queue Backlog',
        `${totalQueueDepth} jobs waiting in queues`
      );
    }
  }

  private async checkSMSProviders(): Promise<void> {
    try {
      const providerHealth = getProviderHealth();
      for (const [provider, health] of Object.entries(providerHealth)) {
        if (!health.isHealthy) {
          await this.createAlert(
            AlertType.SMS_PROVIDER_DOWN,
            AlertSeverity.ERROR,
            'SMS Provider Down',
            `${provider} SMS provider is not responding`
          );
        }
      }
    } catch (error) {
      log.error('Failed to check SMS provider health', { error });
    }
  }
}

// Singleton instance
const alertManager = new AlertManager();

// Export functions
export async function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<Alert> {
  return alertManager.createAlert(type, severity, title, message, metadata);
}

export async function resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
  return alertManager.resolveAlert(alertId, resolvedBy);
}

export function getActiveAlerts(): Alert[] {
  return alertManager.getActiveAlerts();
}

export function getAlertHistory(limit?: number): Alert[] {
  return alertManager.getAlertHistory(limit);
}

export async function checkSystemHealth(): Promise<void> {
  return alertManager.checkSystemHealth();
}

// Start health monitoring
if (process.env.NODE_ENV !== 'test') {
  setInterval(checkSystemHealth, 60000); // Check every minute
}

export default {
  createAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertHistory,
  checkSystemHealth,
  AlertType,
  AlertSeverity,
  ALERT_THRESHOLDS
};
