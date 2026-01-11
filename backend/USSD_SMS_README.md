# TaxBridge USSD & SMS Implementation

This document outlines the complete USSD and SMS inclusion features for TaxBridge, enabling accessibility for feature phone users and extending tax compliance to all Nigerians.

## 🎯 Features Implemented

### USSD Gateway
- **Multi-language support**: English and Pidgin English
- **Core functions**: Tax ID lookup, invoice status, Remita payments, SMS opt-in
- **Session management**: Redis-based with 5-minute timeout
- **Security**: Phone number-based access control, input validation

### SMS Communications
- **Multi-provider support**: Africa's Talking, Infobip, Termii
- **Automated notifications**: Invoice stamping, payment confirmations, deadline reminders
- **Webhook handling**: Delivery reports with signature verification
- **Cost optimization**: Dynamic provider switching based on volume

### Remita Integration
- **RRR generation**: Direct from USSD menu
- **Payment status checking**: Real-time verification
- **Webhook processing**: Automated payment confirmation

## 📁 Architecture

```
backend/src/
├── integrations/
│   ├── ussd/
│   │   └── handler.ts          # USSD menu logic
│   └── comms/
│       ├── client.ts           # Multi-provider SMS client
│       └── providers/
│           ├── infobip.ts      # Infobip integration
│           └── termii.ts       # Termii integration
├── services/
│   ├── notifications.ts        # SMS notification functions
│   └── deadlineReminder.ts     # Cron job for deadline reminders
├── routes/
│   ├── ussd.ts                 # USSD endpoint
│   └── sms.ts                  # SMS webhook endpoint
└── queue/
    ├── index.ts                # Invoice sync worker with SMS
    └── paymentWorker.ts        # Payment worker with SMS
```

## 🚀 Quick Start

### 1. Environment Variables

```bash
# Core Configuration
COMMS_PROVIDER=africastalking  # or infobip, termii
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Africa's Talking (default)
AT_API_KEY=your_api_key
AT_USERNAME=sandbox
AT_SHORTCODE=TaxBridge

# Infobip (alternative)
INFOBIP_API_KEY=your_api_key
INFOBIP_API_URL=https://api.infobip.com
INFOBIP_SIGNATURE_SECRET=your_secret
INFOBIP_SENDER=TaxBridge

# Termii (alternative)
TERMII_API_KEY=your_api_key
TERMII_API_URL=https://api.termii.com
TERMII_SIGNATURE_SECRET=your_secret
TERMII_SENDER=TaxBridge

# Optional Features
ENABLE_DEADLINE_REMINDERS=true
REQUIRE_SMS_SIGNATURE=1
TEST_PHONE_NUMBER=+2348000000000
```

### 2. Database Setup

Ensure your Prisma schema includes these fields:

```prisma
model User {
  // ... existing fields
  phone        String   @unique
  nin          String?  @unique
  tin          String?
  smsOptIn     Boolean  @default(false)
}

model Invoice {
  // ... existing fields
  user         User     @relation(fields: [userId], references: [id])
  nrsReference String?
  qrCode       String?
}

model Payment {
  rrr          String   @unique
  status       String
  amount       Float
  invoiceId    String
  paidAt       DateTime?
  payerPhone   String?
  payerName    String?
  payerEmail   String?
}

model SMSDelivery {
  id           String   @id @default(cuid())
  to           String
  messageId    String?
  provider     String
  status       String
  providerPayload Json?
  createdAt    DateTime @default(now())
}

model AuditLog {
  id           String   @id @default(cuid())
  action       String
  userId       String?
  metadata     Json?
  createdAt    DateTime @default(now())
}
```

### 3. Start Services

```bash
# Start backend with USSD & SMS
cd backend
yarn dev

# Start workers (separate process)
yarn worker

# Run tests
yarn test
```

## 📱 USSD Menu Flow

### Main Menu
```
Welcome to TaxBridge
1. Check Tax ID
2. Invoice Status  
3. Payment (Remita)
4. Subscribe to Reminders
5. Help & Support
0. Pidgin Mode
```

### Option 1: Check Tax ID
```
Enter your NIN (11 digits):
[User enters NIN]
Your Tax ID (TIN): 12345678901
Keep safe.
```

### Option 2: Invoice Status
```
Enter invoice ID (8 chars):
[User enters invoice ID]
Invoice: INV12345
Status: ✅ STAMPED
Amount: ₦1,075
NRS: NRS-REF-12345
```

### Option 3: Payment (Remita)
```
1. Generate RRR for Invoice
2. Check Payment Status

[Select 1]
Enter invoice ID:
[User enters invoice ID]
RRR Generated: 123456789012
Pay at bank or *737*50*123456789012#
Amount: ₦1,075
```

### Option 4: SMS Reminders
```
Subscribed to tax reminders.
SMS will be sent for deadlines.
```

### Pidgin Mode
```
Pidgin mode on. Dial * for menu.
```

## 📨 SMS Notifications

### 1. Invoice Stamped
```
TaxBridge: Invoice INV12345 stamped! Ref: NRS-12345. Details at taxbridge.ng
```

### 2. Payment Confirmed
```
TaxBridge: Payment ₦1,075 confirmed (RRR: 123456789012). Compliant!
```

### 3. Deadline Reminder
```
Reminder: Tax deadline 2026-01-15. File via *384*2024# or taxbridge.ng
```

## 🔧 Testing

### Local Testing

```bash
# Run comprehensive tests
yarn ts-node src/tools/test-ussd-sms.ts

# Test USSD flow simulation
yarn ts-node src/tools/test-ussd-sms.ts

# Test SMS sending
TEST_PHONE_NUMBER=+2348000000000 yarn ts-node src/tools/test-ussd-sms.ts
```

### USSD Testing with Ngrok

```bash
# Start ngrok
ngrok http 3000

# Update Africa's Talking callback URL to:
# https://your-ngrok-id.ngrok.io/ussd

# Test with AT simulator:
# https://simulator.africastalking.com:1518/simulator/ussd
```

### SMS Webhook Testing

```bash
# Test delivery webhook
curl -X POST http://localhost:3000/webhooks/sms/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "messageId": "TEST123",
    "status": "Success", 
    "to": "+2348000000000"
  }'
```

## 💰 Cost Analysis

### Africa's Talking (Sandbox)
- **SMS**: ₦2.50 per message
- **USSD**: ₦5 per session
- **Free tier**: 100 SMS/month
- **Sender ID**: $35 setup

### Infobip (Production)
- **SMS**: ₦2-4 per message (volume-based)
- **Coverage**: 98% uptime
- **Direct operator ties**: Better for >10K/month

### Termii (Nigeria-focused)
- **SMS**: ₦3.8 per message
- **USSD support**: Available
- **Local expertise**: Nigeria-focused

### Budget Recommendations
- **MVP**: Africa's Talking sandbox (free)
- **Pilot**: ₦50K/month (20K SMS/USSD)
- **Production**: Switch to Infobip for >50K users

## 🔒 Security Features

### Input Validation
- NIN format validation (11 digits)
- Invoice ID format checking
- RRR validation (12 digits)

### Signature Verification
- Infobip: HMAC-SHA256
- Termii: Custom signature
- Optional enforcement via `REQUIRE_SMS_SIGNATURE=1`

### Rate Limiting
- USSD session timeout (5 minutes)
- Redis-based session management
- Phone number access control

### NDPC Compliance
- User consent for SMS opt-in
- Data minimization
- Audit logging
- Data export capability

## 📊 Monitoring

### Key Metrics
- USSD session success rate
- SMS delivery rates by provider
- Payment conversion rates
- Opt-in subscription rates

### Logs
- USSD menu navigation
- SMS delivery confirmations
- Payment webhook processing
- Error tracking and retries

## 🚀 Deployment

### Production Checklist
- [ ] Configure production API keys
- [ ] Set up USSD shortcode
- [ ] Configure webhook URLs
- [ ] Enable signature verification
- [ ] Set up monitoring
- [ ] Test with real providers
- [ ] Document emergency procedures

### Environment-Specific Config
```bash
# Development
COMMS_PROVIDER=africastalking
AT_USERNAME=sandbox

# Staging  
COMMS_PROVIDER=infobip
REQUIRE_SMS_SIGNATURE=1

# Production
COMMS_PROVIDER=infobip
INFOBIP_SIGNATURE_SECRET=production_secret
ENABLE_DEADLINE_REMINDERS=true
```

## 🆘 Troubleshooting

### Common Issues

1. **USSD not responding**
   - Check Redis connection
   - Verify webhook URL accessibility
   - Check session timeout settings

2. **SMS not sending**
   - Verify API keys
   - Check phone number format
   - Review provider-specific formatting

3. **Payment webhook failing**
   - Verify Remita configuration
   - Check RRR format
   - Review webhook signature

### Debug Commands
```bash
# Check Redis sessions
redis-cli keys "ussd:*"

# Check SMS delivery logs
grep "sms_delivery" logs/app.log

# Test provider connectivity
curl -X POST https://api.infobip.com/sms/1/text/single
```

## 📞 Support

### Provider Support
- **Africa's Talking**: support@africastalking.com
- **Infobip**: https://www.infobip.com/support
- **Termii**: support@termii.com

### Internal Support
- **Technical**: dev@taxbridge.ng
- **Compliance**: compliance@taxbridge.ng
- **Customer**: 0800-TAX-HELP

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Compliance**: NRS 2026, NDPC 2025
