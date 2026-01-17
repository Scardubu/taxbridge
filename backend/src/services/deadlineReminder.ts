import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { notifyFilingDeadline } from '../services/notifications';
import { createLogger } from '../lib/logger';

const log = createLogger('deadline-reminder');

// Run daily at 9 AM to check for upcoming deadlines (7 days from now)
const task = cron.schedule('0 9 * * *', async () => {
  log.info('Running daily deadline reminder check');
  
  try {
    // Calculate deadline date (7 days from now)
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 7);
    const deadlineStr = deadlineDate.toISOString().slice(0, 10);
    
    // Find all users who have opted in for SMS reminders
    const users = await prisma.user.findMany({
      where: {
        smsOptIn: true,
        phone: {
          not: ''
        }
      }
    });
    
    if (users.length === 0) {
      log.info('No users with SMS opt-in found');
      return;
    }
    
    log.info(`Sending deadline reminders to ${users.length} users`);
    
    // Send reminder to each opted-in user
    for (const user of users) {
      try {
        if (user.phone) {
          await notifyFilingDeadline(user.phone, deadlineStr);
          log.info(`Sent deadline reminder to user ${user.id}`);
        }
      } catch (err) {
        log.error(`Failed to send reminder to user ${user.id}`, { err });
      }
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'deadline_reminders_sent',
        metadata: {
          deadlineDate: deadlineStr,
          userCount: users.length,
          sentAt: new Date().toISOString()
        }
      }
    });
    
    log.info(`Completed deadline reminder processing for ${deadlineStr}`);
  } catch (error) {
    log.error('Error in deadline reminder cron job', { error });
  }
}, {
  timezone: 'Africa/Lagos'
});

export function startDeadlineReminderCron() {
  task.start();
  log.info('Deadline reminder cron job started (daily at 9 AM)');
}

export function stopDeadlineReminderCron() {
  task.stop();
  log.info('Deadline reminder cron job stopped');
}

export { task as deadlineReminderTask };
