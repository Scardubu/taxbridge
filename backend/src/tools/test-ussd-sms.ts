import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { sendSMS } from '../integrations/comms/client';
import { notifyInvoiceStamped, notifyPaymentConfirmed, notifyFilingDeadline } from '../services/notifications';

dotenv.config();

const prisma = new PrismaClient();

async function testSMSIntegration() {
  console.log('🧪 Testing SMS Integration...\n');

  // Test 1: Basic SMS sending
  console.log('1. Testing basic SMS send...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    const result = await sendSMS(testPhone, 'TaxBridge Test: SMS integration working!');
    console.log('✅ SMS sent successfully:', result);
  } catch (error) {
    console.log('❌ SMS send failed:', error);
  }

  // Test 2: Invoice stamping notification
  console.log('\n2. Testing invoice stamping notification...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyInvoiceStamped(testPhone, 'TEST-INV-001', 'NRS-REF-12345');
    console.log('✅ Invoice stamping notification sent');
  } catch (error) {
    console.log('❌ Invoice stamping notification failed:', error);
  }

  // Test 3: Payment confirmation notification
  console.log('\n3. Testing payment confirmation notification...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyPaymentConfirmed(testPhone, 15000, 'RRR-123456789');
    console.log('✅ Payment confirmation notification sent');
  } catch (error) {
    console.log('❌ Payment confirmation notification failed:', error);
  }

  // Test 4: Deadline reminder
  console.log('\n4. Testing deadline reminder...');
  try {
    const testPhone = process.env.TEST_PHONE_NUMBER || '+2348000000000';
    await notifyFilingDeadline(testPhone, '2026-01-15');
    console.log('✅ Deadline reminder sent');
  } catch (error) {
    console.log('❌ Deadline reminder failed:', error);
  }

  console.log('\n🎯 SMS Integration tests completed!');
}

async function testUSSDFlow() {
  console.log('🧪 Testing USSD Flow Simulation...\n');

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
    console.log('✅ Created test user:', user.id);

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
    console.log('✅ Created test invoice:', invoice.id);

    console.log('\n📱 USSD Test Scenarios:');
    console.log('1. Dial *384*2024# (or your USSD code)');
    console.log('2. Select "1" to check Tax ID (should show TIN)');
    console.log('3. Select "2" to check invoice status (use invoice ID: ' + invoice.id.slice(0, 8) + ')');
    console.log('4. Select "3" then "1" to generate RRR for invoice');
    console.log('5. Select "4" to subscribe to SMS reminders');
    console.log('6. Select "0" to toggle Pidgin mode');
    console.log('7. Select "5" for help');

    console.log('\n🎯 USSD setup completed!');
    console.log('📞 Test phone:', testPhone);
    console.log('🆔 Test NIN:', testNIN);
    console.log('🧾 Test invoice:', invoice.id.slice(0, 8));

  } catch (error) {
    console.log('❌ USSD test setup failed:', error);
  }
}

async function testWebhookDelivery() {
  console.log('🧪 Testing SMS Delivery Webhook...\n');

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

  console.log('📡 Sample webhook payloads for testing:');
  console.log('\n1. Africa\'s Talking:');
  console.log('POST /webhooks/sms/delivery');
  console.log('Content-Type: application/json');
  console.log('Body:', JSON.stringify(testPayloads.africastalking, null, 2));

  console.log('\n2. Infobip:');
  console.log('POST /webhooks/sms/delivery');
  console.log('Content-Type: application/json');
  console.log('x-infobip-signature: [signature]');
  console.log('Body:', JSON.stringify(testPayloads.infobip, null, 2));

  console.log('\n3. Termii:');
  console.log('POST /webhooks/sms/delivery');
  console.log('Content-Type: application/json');
  console.log('x-termii-signature: [signature]');
  console.log('Body:', JSON.stringify(testPayloads.termii, null, 2));

  console.log('\n🎯 Use curl or Postman to test these endpoints');
}

async function main() {
  console.log('🚀 TaxBridge USSD & SMS Integration Tests\n');
  console.log('📋 Configuration:');
  console.log('- COMMS_PROVIDER:', process.env.COMMS_PROVIDER || 'africastalking');
  console.log('- TEST_PHONE_NUMBER:', process.env.TEST_PHONE_NUMBER || 'Not set');
  console.log('- AT_API_KEY:', process.env.AT_API_KEY ? 'Set' : 'Not set');
  console.log('- INFOBIP_API_KEY:', process.env.INFOBIP_API_KEY ? 'Set' : 'Not set');
  console.log('- TERMII_API_KEY:', process.env.TERMII_API_KEY ? 'Set' : 'Not set');
  console.log('');

  await testSMSIntegration();
  console.log('\n' + '='.repeat(50) + '\n');
  await testUSSDFlow();
  console.log('\n' + '='.repeat(50) + '\n');
  await testWebhookDelivery();

  await prisma.$disconnect();
  console.log('\n✅ All tests completed!');
}

main().catch(console.error);
