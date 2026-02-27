# MODULE M07 — MONETIZATION & ANALYTICS
## TaxBridge AI Operating Context
**Token budget:** ~700 tokens | **Inject:** Growth, billing, analytics tasks

---

## PURPOSE
Reference for subscription tiers, referral engine, analytics events, and
growth instrumentation.

## SCOPE
`backend/src/services/referral.ts`, `backend/src/routes/billing.ts`,
analytics event tracking across all layers.

---

## SUBSCRIPTION TIERS

```
TIER      PRICE/mo    KEY LIMITS
─────────────────────────────────────────────────────────
Free      ₦0          3 invoices, basic PIT calc, USSD only
Starter   ₦2,500      Unlimited invoices, 50 OCR scans, VAT wizard, 2 team members
Pro       ₦7,500      Unlimited OCR, payroll+PAYE, document vault 5GB, AI anomaly, 5 team
Enterprise₦25,000     Multi-entity, accountant portal, dedicated support, 15% ref share

Feature gating: middleware checks user.subscriptionTier before serving premium endpoints
Billing:  Paystack Subscriptions API (recurring monthly)
```

---

## REFERRAL PROGRAM

```
Tier        Referrals  Reward
────────────────────────────────────────────────────────────
Ambassador  1-4        10% monthly discount per active referral
Champion    5-9        20% discount + 1 free month bonus
Partner     10+        15% revenue share on referred accounts (paid monthly)

Tracking:
  - referralCode: unique 8-char code per user (generated at registration)
  - Referral record created on code use (status: pending)
  - Becomes 'active' when referred user completes first paid month
  - Revenue share paid via Paystack on 1st of each month

Share content (WhatsApp-optimised, 160-char friendly):
  EN:     "Join TaxBridge — Nigeria's smartest tax app. 1 month free: {url}"
  Pidgin: "Omo! TaxBridge sort my taxes. Join with my link, 1 month free: {url}"
```

---

## ANALYTICS EVENTS (Track across all layers)

```
Event Name                Properties Required
──────────────────────────────────────────────────────────────
onboarding_completed      businessType, annualIncome, annualTurnover
first_invoice_created     invoiceAmount, hasCustomerTin, vatApplied
first_nrs_stamp           timeToStampMs, invoiceAmount
vat_return_filed          period, totalSales, vatPayable, filedOnTime
pit_return_filed          annualIncome, pitLiability, reliefsClaimed
ocr_scan_completed        confidence, category, requiresReview
anomaly_detected          signal, severity, dismissed (on dismiss event)
tax_health_score_viewed   score, grade, trend
lesson_completed          lessonId, quizScore, xpEarned
referral_converted        referrerCode, referredPlan
subscription_upgraded     fromTier, toTier, revenue
payment_failed            gateway, attemptNumber, error
ussd_session_completed    menuPath, action, converted
```

---

## ADMIN ANALYTICS PANELS (admin-dashboard)

```
Panel 1: Daily Active Users (DAU/WAU/MAU)
Panel 2: Revenue by tier — MRR, churn, expansion
Panel 3: Tax filings per type per month (VAT/PIT/PAYE/CIT)
Panel 4: NRS submission success rate (target > 97%)
Panel 5: OCR scan volume + confidence distribution
Panel 6: Anomaly detection — signals by type and severity
Panel 7: Tax Health Score distribution (histogram)
Panel 8: Referral funnel — codes issued → used → converted
```

---

## INPUTS / OUTPUTS

```
Inputs:  User actions (in-app events), payment webhooks (Paystack),
         referral code usage, subscription state changes
Outputs: Analytics events (to custom DB or Mixpanel/PostHog),
         Subscription state updates, referral reward triggers,
         Monthly revenue share payment batches via Paystack
```

---

## DEPENDENCIES

```
Internal: backend/src/routes/billing.ts, referral.ts
External: Paystack Subscriptions API, analytics platform (Mixpanel or PostHog)
```
