import dotenv from 'dotenv';
import { prisma } from '../lib/prisma';
import { sendSMS } from '../integrations/comms/client';
import { notifyInvoiceStamped, notifyPaymentConfirmed, notifyFilingDeadline } from '../services/notifications';
import { createLogger } from '../lib/logger';

dotenv.config();

const log = createLogger('test-ussd-sms');

async function testSMSIntegration() {
  log.info('🧪 Testing SMS Integration...\n');

  // Test 1: Basic SMS sending
  log.info('1. Testing basic SMS send...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    const result = await sendSMS(testPhone, 'TaxBridge Test: SMS integration working!');
    log.info('✅ SMS sent successfully', { result });
  } catch (error) {
    log.info('❌ SMS send failed', { err: error });
  }

  // Test 2: Invoice stamping notification
  log.info('\n2. Testing invoice stamping notification...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyInvoiceStamped(testPhone, 'TEST-INV-001', 'NRS-REF-12345');
    log.info('✅ Invoice stamping notification sent');
  } catch (error) {
    log.info('❌ Invoice stamping notification failed', { err: error });
  }

  // Test 3: Payment confirmation notification
  log.info('\n3. Testing payment confirmation notification...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyPaymentConfirmed(testPhone, 15000, 'RRR-123456789');
    log.info('✅ Payment confirmation notification sent');
  } catch (error) {
    log.info('❌ Payment confirmation notification failed', { err: error });
  }

  // Test 4: Deadline reminder
  log.info('\n4. Testing deadline reminder...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyFilingDeadline(testPhone, '2026-01-15');
    log.info('✅ Deadline reminder sent');
  } catch (error) {
    log.info('❌ Deadline reminder failed', { err: error });
  }

  log.info('\n🎯 SMS Integration tests completed!');
}

async function testUSSDFlow() {
  log.info('🧪 Testing USSD Flow Simulation...\n');

  // Create a test user with phone number
  const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000001';
  const testNIN = '12345678901';
  
  try {
    // Clean up existing test user if any
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        phone: testPhone,
        name: 'USSD Test User',
        tin: 'TEST-TIN-USSD',
        nin: testNIN,
        smsOptIn: true
      }
    });
    log.info('✅ Created test user', { userId: user.id });

    // Create test invoice
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        customerName: 'USSD Test Customer',
        items: [
          { description: 'Test Item', quantity: 1, unitPrice: 1000 }
        ] as any,
        subtotal: 1000,
        vat: 75,
        total: 1075,
        status: 'queued'
      }
    });
    log.info('✅ Created test invoice', { invoiceId: invoice.id });

    log.info('\n📱 USSD Test Scenarios:');
    log.info('1. Dial *384*2024# (or your USSD code)');
    log.info('2. Select "1" to check Tax ID (should show TIN)');
    log.info('3. Select "2" to check invoice status (use invoice ID: ' + invoice.id.slice(0, 8) + ')');
    log.info('4. Select "3" then "1" to generate RRR for invoice');
    log.info('5. Select "4" to subscribe to SMS reminders');
    log.info('6. Select "0" to toggle Pidgin mode');
    log.info('7. Select "5" for help');

    log.info('\n🎯 USSD setup completed!');
    log.info('📞 Test phone', { testPhone });
    log.info('🆔 Test NIN', { testNIN });
    log.info('🧾 Test invoice', { invoiceId: invoice.id.slice(0, 8) });

  } catch (error) {
    log.info('❌ USSD test setup failed', { err: error });
  }
}

async function testWebhookDelivery() {
  log.info('🧪 Testing SMS Delivery Webhook...\n');

  // Test webhook payload for different providers
  const testPayloads = {
    africastalking: {
      messageId: 'ATXid123456789',
      status: 'Success',
      to: '+2348000000000',
      date: '2026-01-06T12:00:00Z'
    },
    infobip: {
      messageId: 'INFOBIP123456789',
      to: '+2348000000000',
      status: 'DELIVERED',
      doneAt: '2026-01-06T12:00:00Z'
    },
    termii: {
      message_id: 'TERMII123456789',
      to: '+2348000000000',
      status: 'delivered',
      timestamp: '2026-01-06T12:00:00Z'
    }
  };

  log.info('📡 Sample webhook payloads for testing:');
  log.info('\n1. Africa\'s Talking:');
  log.info('POST /webhooks/sms/delivery');
  log.info('Content-Type: application/json');
  log.info('Body', { body: JSON.stringify(testPayloads.africastalking, null, 2) });

  log.info('\n2. Infobip:');
  log.info('POST /webhooks/sms/delivery');
  log.info('Content-Type: application/json');
  log.info('x-infobip-signature: [signature]');
  log.info('Body', { body: JSON.stringify(testPayloads.infobip, null, 2) });

  log.info('\n3. Termii:');
  log.info('POST /webhooks/sms/delivery');
  log.info('Content-Type: application/json');
  log.info('x-termii-signature: [signature]');
  log.info('Body', { body: JSON.stringify(testPayloads.termii, null, 2) });

  log.info('\n🎯 Use curl or Postman to test these endpoints');
}

async function main() {
  log.info('🚀 TaxBridge USSD & SMS Integration Tests\n');
  log.info('📋 Configuration:');
  log.info('- COMMS_PROVIDER', { value: process.env.COMMS_PROVIDER || 'africastalking' });
  log.info('- TEST_PHONE_NUMBER', { value: process.env.TEST_PHONE_NUMBER || 'Not set' });
  log.info('- AT_API_KEY', { value: process.env.AT_API_KEY ? 'Set' : 'Not set' });
  log.info('- INFOBIP_API_KEY', { value: process.env.INFOBIP_API_KEY ? 'Set' : 'Not set' });
  log.info('- TERMII_API_KEY', { value: process.env.TERMII_API_KEY ? 'Set' : 'Not set' });
  log.info('');

  await testSMSIntegration();
  log.info('\n' + '='.repeat(50) + '\n');
  await testUSSDFlow();
  log.info('\n' + '='.repeat(50) + '\n');
  await testWebhookDelivery();

  await prisma.$disconnect();
  log.info('\n✅ All tests completed!');
}

main().catch((err) => log.error('Unhandled error', { err }));
