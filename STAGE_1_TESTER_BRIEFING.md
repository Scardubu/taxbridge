# TaxBridge V5 Beta — Tester Briefing Guide

**Welcome to the TaxBridge Beta Program!** 🎉

**Date:** January 20, 2026  
**Program:** Stage 1 Internal Testing  
**Duration:** 7 Days  
**Testers:** 100 Beta Participants

---

## 🎯 What Is TaxBridge?

TaxBridge is Nigeria's first **offline-first tax compliance platform** designed specifically for SMEs. We help Nigerian business owners create NRS-compliant e-invoices, track payments, and manage tax obligations — even without internet access.

### Key Features You'll Test

✅ **Offline Invoice Creation** — Create invoices anywhere, sync later  
✅ **NRS e-Invoicing** — Generate tax-compliant invoices (mock mode in Stage 1)  
✅ **Receipt Scanning** — Snap photos, extract data with OCR  
✅ **Payment Tracking** — Link invoices to payments (mock mode in Stage 1)  
✅ **Multi-Language** — English & Nigerian Pidgin support  
✅ **Tax Calculator** — Automatic VAT, WHT, and income tax calculations  

---

## 🚀 Getting Started (10 Minutes)

### Step 1: Install TaxBridge

1. **Check your email** for the beta invitation link
2. **Click the link** (must be on your Android device)
3. **Accept the invitation** in Google Play Store
4. **Install TaxBridge** (app size: ~30 MB)
5. **Open the app** and begin!

**Requirements:**
- Android 5.0 (Lollipop) or higher
- ~50 MB free storage
- Internet connection for initial download (then works offline!)

---

### Step 2: Register Your Account

1. **Open TaxBridge app**
2. **Tap "Get Started"**
3. **Enter your phone number** (Nigerian: +234...)
4. **Receive SMS code** (⚠️ SMS not enabled in Stage 1 — use test code: `123456`)
5. **Set your password** (8+ characters, mix of letters & numbers)
6. **Complete business profile:**
   - Business name
   - Tax Identification Number (TIN) — use test TIN: `12345678-0001`
   - Business address
   - Industry

**⚠️ Stage 1 Note:** SMS verification is disabled. Use code `123456` for any phone number.

---

### Step 3: Explore the Dashboard

After registration, you'll see the **Dashboard** with:

- **Quick Stats:** Total invoices, payments, and tax summary
- **Recent Invoices:** Your last 5 invoices
- **Upcoming Tax Deadlines:** VAT, WHT, and income tax reminders
- **Sync Status:** Shows when you last synced with the server

**Pro Tip:** Tap the **hamburger menu** (☰) to access:
- Invoices
- Customers
- Products/Services
- Receipts
- Settings
- Help & Feedback

---

## 📝 Testing Tasks (Complete These!)

### Task 1: Create Your First Invoice (5 minutes)

**Goal:** Test invoice creation flow

1. **Tap "Create Invoice"** on dashboard
2. **Select or create a customer:**
   - Name: Test Customer Ltd.
   - TIN: `12345678-0002`
   - Email: test@example.com
3. **Add line items:**
   - Description: "Web Design Services"
   - Quantity: 1
   - Price: ₦50,000
4. **Review calculated totals:**
   - Subtotal
   - VAT (7.5% — should be ₦3,750)
   - WHT (5% — if applicable)
   - Total
5. **Save as draft** or **finalize invoice**
6. **Check invoice preview**

**What to test:**
- ✅ Can you create the invoice offline?
- ✅ Are calculations correct?
- ✅ Does the invoice look professional?
- ✅ Can you edit/delete the invoice?

**Report if:**
- ❌ App crashes when creating invoice
- ❌ Calculations are wrong
- ❌ Invoice preview doesn't load
- ❌ Can't save or finalize invoice

---

### Task 2: Test Receipt Scanning (3 minutes)

**Goal:** Test OCR functionality

1. **Go to "Receipts" tab**
2. **Tap "Scan Receipt"**
3. **Take a photo of a receipt** (or use sample receipt — see below)
4. **Wait for OCR extraction** (~5-10 seconds)
5. **Review extracted data:**
   - Vendor name
   - Date
   - Amount
   - Line items
6. **Edit if needed** and **save**

**Sample Test Receipt:**
- Use a grocery receipt, fuel receipt, or restaurant bill
- Make sure text is clear and well-lit

**What to test:**
- ✅ OCR extracts text correctly?
- ✅ Amounts are parsed properly?
- ✅ Can you edit extracted data?
- ✅ Receipt is saved with photo?

**Report if:**
- ❌ Camera doesn't open
- ❌ OCR fails or extracts garbage
- ❌ App crashes after scanning
- ❌ Receipt doesn't save

---

### Task 3: Test Offline Sync (5 minutes)

**Goal:** Verify offline-first architecture

1. **Enable Airplane Mode** on your device
2. **Create 2-3 invoices offline**
3. **Navigate between screens** (Dashboard, Invoices, Customers)
4. **Disable Airplane Mode** (reconnect to internet)
5. **Tap "Sync Now"** in the app
6. **Wait for sync to complete**
7. **Verify all offline invoices appear** on backend (check in admin dashboard if you have access)

**What to test:**
- ✅ App works fully offline?
- ✅ Offline invoices sync successfully?
- ✅ No data loss during sync?
- ✅ Sync conflicts handled gracefully?

**Report if:**
- ❌ App crashes when offline
- ❌ Invoices disappear after sync
- ❌ Sync fails or hangs
- ❌ Duplicate invoices created

---

### Task 4: Test Language Switching (2 minutes)

**Goal:** Validate i18n coverage

1. **Go to Settings** (☰ → Settings)
2. **Tap "Language"**
3. **Switch to "Nigerian Pidgin"**
4. **Navigate through app:**
   - Dashboard
   - Invoice creation
   - Customer list
5. **Switch back to English**

**What to test:**
- ✅ All screens translate correctly?
- ✅ No hardcoded English strings in Pidgin mode?
- ✅ Numbers, dates, currency format properly?
- ✅ Buttons and labels make sense?

**Report if:**
- ❌ Some text remains in English (incomplete translation)
- ❌ Layout breaks in Pidgin mode
- ❌ Currency or dates don't format correctly

---

### Task 5: Explore Additional Features (10 minutes)

**Try these features:**

1. **Customer Management:**
   - Add 3-5 customers
   - Edit customer details
   - Delete a customer

2. **Product/Service Catalog:**
   - Add 5 products/services
   - Set default prices
   - Edit or delete items

3. **Tax Settings:**
   - Review tax rates (VAT, WHT, CIT)
   - Set tax reminders
   - Check tax calendar

4. **Reports (if available):**
   - View sales summary
   - Export invoices to PDF
   - Check payment status

5. **Help & Feedback:**
   - Read FAQ
   - Submit feedback or bug report

**What to test:**
- ✅ Are all features accessible?
- ✅ Is the UI intuitive?
- ✅ Any confusing workflows?
- ✅ Any features you expected but are missing?

---

## ⚠️ Important Limitations (Stage 1 Beta)

**This is a BETA release running in MOCK MODE. Please note:**

### Not Yet Functional:
- ❌ **Real NRS submission** — DigiTax integration is simulated (mock mode)
- ❌ **Real payments** — Remita integration is in sandbox mode
- ❌ **SMS notifications** — Phone verification uses test code `123456`
- ❌ **Email notifications** — Not yet enabled
- ❌ **USSD support** — Coming in Stage 2

### Use Test Data Only:
- ✅ **Use test TINs:** `12345678-0001`, `12345678-0002`, etc.
- ✅ **Use test amounts:** Small values (₦1,000 - ₦100,000)
- ✅ **Use test customer names:** "Test Customer Ltd.", "Sample Corp", etc.

**⚠️ DO NOT:**
- ❌ Enter real TINs or business data (privacy risk)
- ❌ Attempt real NRS submissions (will fail)
- ❌ Attempt real payments (sandbox only)
- ❌ Share sensitive financial information

---

## 🐛 How to Report Bugs

### In-App Feedback (Preferred)

1. **Tap ☰ → Help & Feedback**
2. **Tap "Report a Bug"**
3. **Fill out the form:**
   - What happened?
   - What did you expect?
   - Steps to reproduce
   - Attach screenshot (optional)
4. **Submit**

**Your report automatically includes:**
- Device model
- Android version
- App version
- Session ID (for log correlation)

---

### Email Feedback

**Send to:** beta@taxbridge.ng

**Include:**
- **Subject:** [BETA] Brief description
- **Body:**
  - What you were trying to do
  - What happened vs. what you expected
  - Steps to reproduce
  - Screenshots (if helpful)
  - Your device: [Model, Android version]

**Example:**
```
Subject: [BETA] Invoice calculation wrong for multiple line items

I created an invoice with 3 line items:
- Item A: ₦10,000
- Item B: ₦20,000  
- Item C: ₦30,000

Expected subtotal: ₦60,000
Actual subtotal: ₦30,000 (only counted Item C)

Steps to reproduce:
1. Create new invoice
2. Add 3 line items
3. Check subtotal

Device: Samsung Galaxy A12, Android 11
Screenshot attached.
```

---

### WhatsApp Support (Urgent Issues)

**Number:** +234 XXX XXX XXXX  
**Hours:** 9 AM - 6 PM WAT (Mon-Fri)

**Use for:**
- App crashes on launch
- Cannot register
- Data loss
- Urgent questions

---

## 📊 What We're Measuring

**Your usage helps us validate:**

1. **Crash-Free Rate** — Target: 99%+  
   We want zero crashes for you!

2. **Sync Reliability** — Target: 99%+  
   Offline invoices should always sync

3. **Feature Adoption** — Which features you use most  
   Helps prioritize improvements

4. **User Engagement** — Session duration, return rate  
   Validates product-market fit

5. **UX Friction Points** — Where you get stuck  
   Guides onboarding improvements

**Your Privacy:**
- We collect **usage data only** (feature clicks, screen views)
- We **do NOT** collect invoice content or customer data
- All data is **encrypted** in transit and at rest
- You can **delete your account** anytime (Settings → Account → Delete)

---

## ❓ Frequently Asked Questions

### General

**Q: How long is the beta period?**  
A: Stage 1 is 7 days (Jan 20-27, 2026). If successful, we'll expand to Stage 2 (1,000 users).

**Q: Will my data be deleted after beta?**  
A: No. Your data will be preserved if you continue using TaxBridge after Stage 1.

**Q: Can I use TaxBridge for real business?**  
A: Not yet. Stage 1 is mock mode only. Real NRS integration comes in Stage 2/3.

**Q: What if I find a critical bug?**  
A: Report immediately via WhatsApp (+234 XXX XXX XXXX) or in-app feedback. We'll deploy a hotfix within 24 hours.

---

### Technical

**Q: Why does the app ask for camera permission?**  
A: For receipt scanning (OCR feature). You can skip this and still use other features.

**Q: Does TaxBridge work offline?**  
A: Yes! You can create invoices, add customers, scan receipts — all offline. Sync when you have internet.

**Q: How much data does sync use?**  
A: Very little. ~1-2 KB per invoice. A full sync of 100 invoices uses <200 KB.

**Q: Can I use TaxBridge on multiple devices?**  
A: Not yet. Multi-device sync comes in Stage 3. For now, use one device only.

**Q: Why is SMS verification not working?**  
A: SMS is disabled in Stage 1. Use test code `123456` for any phone number.

---

### Features

**Q: Can I export invoices to PDF?**  
A: Yes! View invoice → Tap "Export" → Select PDF → Share.

**Q: Does TaxBridge support multiple currencies?**  
A: Stage 1 is NGN (₦) only. USD/EUR support comes later.

**Q: Can I customize invoice templates?**  
A: Not yet. Custom branding comes in Stage 3.

**Q: How accurate is the tax calculator?**  
A: Very accurate. We follow NRS guidelines (VAT 7.5%, WHT 5%/10%, CIT 30%). But always verify with your accountant.

---

### Billing & Access

**Q: Is TaxBridge free during beta?**  
A: Yes! All beta testers get **lifetime access** (or 1 year free premium, TBD).

**Q: What happens after beta?**  
A: We'll announce pricing for general availability. Beta testers get priority pricing.

**Q: Can I invite colleagues to beta?**  
A: Not yet. We're limiting Stage 1 to 100 testers. You can refer them for Stage 2.

---

## 🎁 Beta Tester Perks

**As a thank-you for testing, you'll get:**

✅ **Early access** to all new features  
✅ **Priority support** (faster responses)  
✅ **Influence roadmap** (your feedback shapes the product)  
✅ **Lifetime discount** (or free tier, TBD)  
✅ **Beta tester badge** in the app (coming soon!)  
✅ **Exclusive beta tester community** (Slack/WhatsApp group)

---

## 📞 Support Channels

| Channel | Best For | Response Time |
|---------|----------|---------------|
| **In-App Feedback** | Bug reports, feature requests | <24 hours |
| **Email (beta@taxbridge.ng)** | Detailed questions, suggestions | <24 hours |
| **WhatsApp (+234 XXX)** | Urgent issues, quick questions | <4 hours (9 AM-6 PM WAT) |
| **Play Store Reviews** | Public feedback (internal testers only) | <48 hours |

---

## 🗓️ What Happens Next?

### This Week (Jan 20-27, 2026)
- **Day 1-2:** Get comfortable with the app, report any crashes
- **Day 3-5:** Test all features thoroughly, submit feedback
- **Day 6-7:** Final testing, help us hit success metrics

### Week 2 (Jan 28 - Feb 3, 2026)
- **Team reviews all feedback** and metrics
- **Go/No-Go decision** for Stage 2
- **If successful:** Expand to 1,000 testers + enable real DigiTax/Remita sandbox
- **If issues found:** Deploy fixes, extend Stage 1

### Stage 2 (February 2026)
- **1,000 closed beta testers**
- **Real DigiTax sandbox** (submit to NRS test environment)
- **Real Remita sandbox** (test payments)
- **SMS notifications enabled**

### Stage 3 (March 2026)
- **5,000 testers** (public beta)
- **Full NRS integration** (production)
- **Full Remita integration** (live payments)
- **Custom invoice templates**
- **Multi-device sync**

### General Availability (April 2026)
- **Launch to all Nigerian SMEs**
- **Mobile (Android + iOS)**
- **Web dashboard**
- **API access**

---

## ✅ Daily Testing Checklist

**Copy this checklist each day you test:**

### Day ___ of 7 (Date: _________)

**Morning (10 minutes):**
- [ ] Open app, check dashboard
- [ ] Create 1-2 invoices
- [ ] Test offline mode (Airplane Mode)
- [ ] Sync and verify

**Afternoon (10 minutes):**
- [ ] Scan 1-2 receipts
- [ ] Add new customer or product
- [ ] Explore a new feature

**Evening (5 minutes):**
- [ ] Submit feedback on today's experience
- [ ] Check for any crashes or bugs
- [ ] Note any suggestions for improvement

**Today's Feedback:**
- What worked well? ___________________________________
- What was confusing? ___________________________________
- What would you improve? ___________________________________
- Any bugs found? ___________________________________

---

## 🎯 Success Criteria (Help Us Hit These!)

**For Stage 1 to succeed, we need:**

✅ **99% crash-free rate** — If you experience crashes, report ASAP!  
✅ **99% sync success** — Offline invoices should always sync  
✅ **70+ active testers** — Use the app daily  
✅ **5+ invoices/day** — Test invoice creation frequently  
✅ **3+ feedback submissions/day** — Your input is crucial  

**Your participation directly determines if we can expand to Stage 2!**

---

## 🙏 Thank You!

Thank you for joining the TaxBridge beta program. Your feedback is invaluable in building a product that truly serves Nigerian SMEs.

Together, we're making tax compliance **simple, accessible, and stress-free** for millions of business owners.

**Let's build TaxBridge together!** 🚀

---

**Questions?** Email beta@taxbridge.ng or WhatsApp +234 XXX XXX XXXX

**Follow our progress:**
- Twitter: @TaxBridgeNG
- LinkedIn: TaxBridge
- Website: https://taxbridge.ng
- Docs: https://docs.taxbridge.ng

---

**The TaxBridge Team**  
*Compliance without fear. Technology without exclusion.*

---

**Last Updated:** January 20, 2026  
**Version:** Stage 1 Beta Briefing v1.0
