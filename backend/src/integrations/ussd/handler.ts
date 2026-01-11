import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from '../../queue/client';
import { remitaAdapter } from '../remita/adapter';
import { createLogger } from '../../lib/logger';

const redis = getRedisConnection();
const log = createLogger('ussd-handler');

const continueResponse = (message: string) => `CON ${message}`;
const endResponse = (message: string) => `END ${message}`;

// Rate limiting: max 10 requests per minute per phone number
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 10;

// Input validation patterns
const NIN_PATTERN = /^\d{11}$/;
const INVOICE_ID_PATTERN = /^[A-Za-z0-9]{1,8}$/;
const RRR_PATTERN = /^\d{12}$/;
const PHONE_PATTERN = /^\+?[1-9]\d{1,14}$/;

// Sanitization helpers
const sanitizeInput = (input: string): string => {
  return input.trim().slice(0, 50); // Limit length and trim
};

const sanitizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

// Rate limiting helper
async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  const key = `ussd:rate:${sanitizePhone(phoneNumber)}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }
  
  return current <= RATE_LIMIT_MAX;
}

export class USSDHandler {
  prisma: PrismaClient;
  private requestCount = 0;
  private errorCount = 0;
  private lastHealthCheck = Date.now();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async healthCheck(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck > 60000) { // Check every minute
      try {
        await redis.ping();
        await this.prisma.$queryRaw`SELECT 1`;
        this.lastHealthCheck = now;
      } catch (error) {
        log.error('Health check failed', { err: error });
        throw error;
      }
    }
  }

  private async logUssdEvent(action: string, phoneNumber: string, data?: any): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: `ussd_${action}`,
          metadata: {
            phoneNumber: sanitizePhone(phoneNumber),
            timestamp: new Date().toISOString(),
            ...data
          }
        }
      });
    } catch (error) {
      log.error('Failed to log USSD event', { err: error, action, phoneNumber });
    }
  }

  async handle(req: { sessionId: string; phoneNumber: string; text: string; serviceCode?: string }) {
    const startTime = Date.now();
    const { sessionId, phoneNumber, text } = req;
    
    // Input sanitization
    const sanitizedPhone = sanitizePhone(phoneNumber);
    const sanitizedText = sanitizeInput(text || '');
    
    this.requestCount++;
    
    try {
      await this.healthCheck();
      
      // Rate limiting check
      if (!(await checkRateLimit(sanitizedPhone))) {
        log.warn('Rate limit exceeded', { phoneNumber: sanitizedPhone });
        await this.logUssdEvent('rate_limit', sanitizedPhone);
        return endResponse('Too many requests. Please try again later.');
      }
      
      // Phone number validation
      if (!PHONE_PATTERN.test(sanitizedPhone)) {
        log.warn('Invalid phone number format', { phoneNumber: sanitizedPhone });
        return endResponse('Invalid phone number. Please contact support.');
      }
      
      const raw = (await redis.get(`ussd:${sessionId}`)) || '{}';
      let session = JSON.parse(raw);
      if (!session.stage) {
        session = { stage: 'menu', data: {}, phoneNumber: sanitizedPhone, startTime: Date.now() };
        await redis.set(`ussd:${sessionId}`, JSON.stringify(session), 'EX', 300);
        await this.logUssdEvent('session_start', sanitizedPhone, { sessionId });
      }

      const inputs = sanitizedText.split('*').filter(Boolean);
      const lastInput = inputs[inputs.length - 1] || '';

      if (!sanitizedText) {
        await this.logUssdEvent('menu_display', sanitizedPhone);
        return continueResponse(`Welcome to TaxBridge (Pidgin: Wet in TaxBridge)\n1. Check Tax ID\n2. Invoice Status\n3. Payment (Remita)\n4. Subscribe to Reminders\n5. Help & Support\n0. Pidgin Mode`);
      }

      // pidgin toggle
      if (lastInput === '0') {
        session.pidgin = !session.pidgin;
        await redis.set(`ussd:${sessionId}`, JSON.stringify(session));
        await this.logUssdEvent('pidgin_toggle', sanitizedPhone, { pidgin: session.pidgin });
        return continueResponse(session.pidgin ? 'CON Pidgin mode on. Dial * for menu.' : 'CON English mode on. Dial * for menu.');
      }

      const msg = (en: string, pid: string) => (session.pidgin ? pid : en);

      // Option 1: Check Tax ID (NIN -> TIN)
      if (inputs[0] === '1') {
        if (inputs.length === 1) {
          await this.logUssdEvent('tax_id_prompt', sanitizedPhone);
          return continueResponse(msg('Enter your NIN (11 digits):', 'Enter your NIN (11 number):'));
        }
        
        const nin = sanitizeInput(lastInput);
        if (!NIN_PATTERN.test(nin)) {
          await this.logUssdEvent('invalid_nin', sanitizedPhone, { nin });
          return endResponse(msg('Invalid NIN format. Use 11 digits only.', 'NIN no correct. Use 11 number only.'));
        }
        
        try {
          const user = await this.prisma.user.findFirst({ 
            where: { nin },
            select: { tin: true, name: true }
          });
          
          if (user) {
            await this.logUssdEvent('tax_id_success', sanitizedPhone, { nin, hasTin: !!user.tin });
            return endResponse(msg(`Your Tax ID (TIN): ${user.tin || 'Not registered yet'}\nKeep this safe.`, `Your TIN: ${user.tin || 'No register yet'}\nKeep am safe.`));
          } else {
            await this.logUssdEvent('nin_not_found', sanitizedPhone, { nin });
            return endResponse(msg('NIN not registered. Register at taxbridge.ng or visit tax office.', 'NIN no dey registered. Go taxbridge.ng or tax office.'));
          }
        } catch (dbError) {
          log.error('Database error in tax ID lookup', { err: dbError, nin });
          return endResponse(msg('Service temporarily unavailable. Try again later.', 'Service no dey now. Try again later.'));
        }
      }

      // Option 2: Invoice Status
      if (inputs[0] === '2') {
        if (inputs.length === 1) {
          await this.logUssdEvent('invoice_status_prompt', sanitizedPhone);
          return continueResponse(msg('Enter invoice ID (first 8 characters):', 'Enter invoice ID (first 8 letter):'));
        }
        
        const invoiceId = sanitizeInput(lastInput).toUpperCase();
        if (!INVOICE_ID_PATTERN.test(invoiceId)) {
          await this.logUssdEvent('invalid_invoice_id', sanitizedPhone, { invoiceId });
          return endResponse(msg('Invalid invoice ID format. Use letters and numbers only.', 'Invoice ID no correct. Use letter and number only.'));
        }
        
        try {
          const invoice = await this.prisma.invoice.findFirst({ 
            where: { 
              id: { startsWith: invoiceId } as any, 
              user: { phone: sanitizedPhone } 
            },
            select: {
              id: true,
              status: true,
              total: true,
              nrsReference: true,
              createdAt: true
            }
          });
          
          if (!invoice) {
            await this.logUssdEvent('invoice_not_found', sanitizedPhone, { invoiceId });
            return endResponse(msg('Invoice not found or access denied.', 'Invoice no dey or you no get access.'));
          }
          
          const statusEmoji: Record<string, string> = { 
            queued: '⏳', 
            processing: '🔄', 
            stamped: '✅', 
            failed: '❌', 
            paid: '💰' 
          };
          
          const createdDate = invoice.createdAt.toLocaleDateString();
          await this.logUssdEvent('invoice_status_success', sanitizedPhone, { 
            invoiceId: invoice.id, 
            status: invoice.status 
          });
          
          return endResponse(msg(
            `Invoice: ${invoice.id.slice(0, 8)}\nStatus: ${statusEmoji[invoice.status] || ''} ${invoice.status.toUpperCase()}\nAmount: ₦${invoice.total}\nDate: ${createdDate}\n${invoice.nrsReference ? `NRS: ${invoice.nrsReference}` : ''}`,
            `Invoice: ${invoice.id.slice(0, 8)}\nStatus: ${statusEmoji[invoice.status] || ''} ${invoice.status}\nAmount: ₦${invoice.total}\nDate: ${createdDate}`
          ));
        } catch (dbError) {
          log.error('Database error in invoice status', { err: dbError, invoiceId });
          return endResponse(msg('Service temporarily unavailable. Try again later.', 'Service no dey now. Try again later.'));
        }
      }

      // Option 3: Payment (Remita)
      if (inputs[0] === '3') {
        if (inputs.length === 1) {
          await this.logUssdEvent('payment_menu', sanitizedPhone);
          return continueResponse(msg('1. Generate RRR for Invoice\n2. Check Payment Status', '1. Make RRR for Invoice\n2. Check Payment'));
        }

        if (inputs[1] === '1') {
          if (inputs.length === 2) {
            await this.logUssdEvent('rrr_prompt', sanitizedPhone);
            return continueResponse(msg('Enter invoice ID:', 'Enter invoice ID:'));
          }
          
          const invoiceId = sanitizeInput(inputs[2]).toUpperCase();
          if (!INVOICE_ID_PATTERN.test(invoiceId)) {
            await this.logUssdEvent('invalid_invoice_for_rrr', sanitizedPhone, { invoiceId });
            return endResponse(msg('Invalid invoice ID format.', 'Invoice ID no correct.'));
          }
          
          try {
            const invoice = await this.prisma.invoice.findFirst({ 
              where: { 
                id: { startsWith: invoiceId } as any, 
                user: { phone: sanitizedPhone } 
              },
              select: {
                id: true,
                total: true,
                customerName: true,
                status: true
              }
            });
            
            if (!invoice) {
              await this.logUssdEvent('invoice_not_found_for_rrr', sanitizedPhone, { invoiceId });
              return endResponse(msg('Invoice not found or access denied.', 'Invoice no dey or you no get access.'));
            }
            
            // Check if RRR already exists
            const existingPayment = await this.prisma.payment.findFirst({
              where: { invoiceId: invoice.id },
              select: { rrr: true, status: true }
            });
            
            if (existingPayment) {
              await this.logUssdEvent('rrr_already_exists', sanitizedPhone, { 
                invoiceId: invoice.id, 
                rrr: existingPayment.rrr 
              });
              return endResponse(msg(
                `RRR already exists: ${existingPayment.rrr}\nStatus: ${existingPayment.status.toUpperCase()}\nPay at bank or *737*50*${existingPayment.rrr}#`,
                `RRR don dey: ${existingPayment.rrr}\nStatus: ${existingPayment.status}\nPay for bank or *737*50*${existingPayment.rrr}#`
              ));
            }
            
            const rrrData = await remitaAdapter.generateRRR({
              amount: parseFloat(invoice.total.toString()),
              payerName: invoice.customerName || 'Customer',
              payerEmail: '',
              payerPhone: sanitizedPhone,
              description: `TaxBridge Invoice ${invoice.id}`,
              orderId: invoice.id
            });

            if (rrrData.success && rrrData.rrr) {
              await this.prisma.payment.create({ 
                data: { 
                  rrr: rrrData.rrr, 
                  amount: invoice.total, 
                  invoiceId: invoice.id, 
                  status: 'pending', 
                  payerPhone: sanitizedPhone, 
                  payerName: invoice.customerName || 'Customer', 
                  payerEmail: '' 
                } 
              });
              
              await this.logUssdEvent('rrr_generated', sanitizedPhone, { 
                invoiceId: invoice.id, 
                rrr: rrrData.rrr,
                amount: invoice.total 
              });
              
              return endResponse(msg(
                `RRR Generated: ${rrrData.rrr}\nPay at bank or *737*50*${rrrData.rrr}#\nAmount: ₦${invoice.total}\nValid for 24 hours`,
                `RRR: ${rrrData.rrr}\nPay for bank or *737*50*${rrrData.rrr}#\nAmount: ₦${invoice.total}\nValid for 24 hours`
              ));
            }
            
            await this.logUssdEvent('rrr_generation_failed', sanitizedPhone, { invoiceId, error: rrrData.error || 'Unknown error' });
            return endResponse(msg('Error generating RRR. Try later or contact support.', 'Error for RRR. Try later or call support.'));
          } catch (error) {
            log.error('RRR generation error', { err: error, invoiceId });
            await this.logUssdEvent('rrr_generation_error', sanitizedPhone, { invoiceId });
            return endResponse(msg('Service temporarily unavailable. Try again later.', 'Service no dey now. Try again later.'));
          }
        }

        if (inputs[1] === '2') {
          if (inputs.length === 2) {
            await this.logUssdEvent('payment_status_prompt', sanitizedPhone);
            return continueResponse(msg('Enter RRR (12 digits):', 'Enter RRR:'));
          }
          
          const rrr = sanitizeInput(inputs[2]);
          if (!RRR_PATTERN.test(rrr)) {
            await this.logUssdEvent('invalid_rrr', sanitizedPhone, { rrr });
            return endResponse(msg('Invalid RRR format. Use 12 digits only.', 'RRR no correct. Use 12 digit only.'));
          }
          
          try {
            const payment = await this.prisma.payment.findFirst({ 
              where: { rrr }, 
              include: { 
                invoice: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              } 
            });
            
            if (!payment) {
              await this.logUssdEvent('payment_not_found', sanitizedPhone, { rrr });
              return endResponse(msg('RRR not found. Check and try again.', 'RRR no dey. Check am try again.'));
            }
            
            await this.logUssdEvent('payment_status_success', sanitizedPhone, { 
              rrr, 
              status: payment.status 
            });
            
            const paidDate = payment.paidAt ? payment.paidAt.toLocaleDateString() : '';
            return endResponse(msg(
              `Payment: ${payment.status.toUpperCase()}\nRRR: ${rrr}\nAmount: ₦${payment.amount}\n${payment.status === 'paid' ? `Paid on: ${paidDate}` : 'Pending - Pay at bank or *737*50*' + rrr + '#'}`,
              `Payment: ${payment.status}\nRRR: ${rrr}\nAmount: ₦${payment.amount}\n${payment.status === 'paid' ? `Paid: ${paidDate}` : 'Still dey wait - Pay for bank or *737*50*' + rrr + '#'}`
            ));
          } catch (dbError) {
            log.error('Database error in payment status', { err: dbError, rrr });
            return endResponse(msg('Service temporarily unavailable. Try again later.', 'Service no dey now. Try again later.'));
          }
        }
      }

      // Option 4: Subscribe to Reminders
      if (inputs[0] === '4') {
        try {
          const result = await this.prisma.user.updateMany({ 
            where: { phone: sanitizedPhone }, 
            data: { smsOptIn: true } 
          });
          
          if (result.count > 0) {
            await this.logUssdEvent('sms_opt_in', sanitizedPhone);
            return endResponse(msg('✅ Subscribed to tax reminders! SMS will be sent for deadlines and important updates.', '✅ You don subscribe! SMS go come for deadline and important update.'));
          } else {
            await this.logUssdEvent('sms_opt_in_user_not_found', sanitizedPhone);
            return endResponse(msg('Phone number not registered. Please register first.', 'Phone number no dey registered. Please register first.'));
          }
        } catch (dbError) {
          log.error('Database error in SMS opt-in', { err: dbError, phoneNumber: sanitizedPhone });
          return endResponse(msg('Service temporarily unavailable. Try again later.', 'Service no dey now. Try again later.'));
        }
      }

      if (inputs[0] === '5') {
        await this.logUssdEvent('help_requested', sanitizedPhone);
        return endResponse(msg(
          `📞 TaxBridge Help\n📞 24/7: 0800-TAX-HELP\n💬 SMS: HELP to 2024\n🌐 Web: taxbridge.ng\n📧 Email: support@taxbridge.ng\n⏰ Mon-Fri 8AM-6PM`,
          `📞 TaxBridge Help\n📞 24/7: 0800-TAX-HELP\n💬 SMS: HELP to 2024\n🌐 Web: taxbridge.ng\n📧 Email: support@taxbridge.ng\n⏰ Mon-Fri 8AM-6PM`
        ));
      }

      await this.logUssdEvent('invalid_option', sanitizedPhone, { option: inputs[0] });
      return endResponse(msg('❌ Invalid option. Please try again.', '❌ Bad option. Try again.'));
    } catch (error) {
      this.errorCount++;
      const duration = Date.now() - startTime;
      log.error('USSD handler error', { 
        err: error, 
        sessionId, 
        phoneNumber: sanitizedPhone, 
        duration,
        requestCount: this.requestCount,
        errorCount: this.errorCount
      });
      
      await this.logUssdEvent('handler_error', sanitizedPhone, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      });
      
      return endResponse('⚠️ Service temporarily unavailable. Please try again later or call 0800-TAX-HELP.');
    } finally {
      const duration = Date.now() - startTime;
      log.info('USSD request completed', { 
        sessionId, 
        phoneNumber: sanitizedPhone, 
        duration,
        requestCount: this.requestCount
      });
    }
  }
  
  // Health check method for monitoring
  getHealth() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      lastHealthCheck: this.lastHealthCheck
    };
  }
}

export default USSDHandler;
