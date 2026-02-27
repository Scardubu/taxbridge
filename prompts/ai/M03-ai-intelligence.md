# MODULE M03 — AI INTELLIGENCE LAYER
## TaxBridge AI Operating Context
**Token budget:** ~1,000 tokens | **Inject:** AI/ML tasks, anomaly detection, OCR

---

## PURPOSE
Reference for all AI/ML services: OCR pipeline, anomaly detection, tax health scoring,
smart compliance calendar, and predictive liability engine.

## SCOPE
`backend/src/services/anomaly-detection.ts`, `ocr-enhanced.ts`, `tax-health-score.ts`,
`compliance-calendar.ts` · `ml/ocr_service/` Python microservice.

---

## OCR PIPELINE

```
Decision tree (in order — do not skip steps):
1. Size gate:        > 5MB → reject 413
2. Sharp enhance:    grayscale → contrast normalize → deskew ≤15° → sharpen
3. Google Vision:    confidence ≥ 0.70 → proceed to parse
                     confidence < 0.70 → Tesseract fallback
4. Tesseract:        confidence ≥ 0.60 → parse with review_required=true
                     confidence < 0.60 → return raw_text only
5. Parse:            merchant_name, amount (₦), vat_amount, date, tin
6. Classify:         13 Nigerian expense categories (keyword scoring)
7. Enrich:           vendor DB lookup → auto-fill TIN, VAT status

Confidence threshold: 0.70 is calibrated — do not raise above 0.85 without A/B test
```

---

## 13 EXPENSE CATEGORIES

```
fuel | meals | office_supplies | transport | utilities | rent |
professional_fees | advertising | repairs | insurance | medical | education | other

Classification: keyword matching → score → highest wins (min score 2 for non-'other')
TIN presence: +2 bonus points
VAT-eligible categories: office_supplies, professional_fees, equipment, raw_materials, advertising
```

---

## ANOMALY DETECTION — 9 SIGNALS

```
Signal                    Min Sev  High Trigger        Critical Trigger
──────────────────────────────────────────────────────────────────────
duplicate_amount          low      > ₦500k             > ₦5M
zscore_spike              medium   z-score > 4         z-score > 6
vat_mismatch              high     always high         claimed VAT > ₦1M
round_number_clustering   low      > 75% round nums    —
weekend_business_expense  low      > ₦200k on Sunday   —
rapid_succession          medium   same vendor ₦1M+    > ₦10M total
phantom_vendor            high     always high         claim > ₦500k
cashflow_cliff            high     < 30 days runway    deadline < 7 days
vat_threshold_approach    medium   revenue > ₦80M      revenue > ₦95M
```

**Implementation rules:**
- Always return `AnomalyResult[]` — empty array if clean, never throw
- Idempotent — same inputs always produce same outputs
- Redis cache: `anomaly:{userId}:{recordId}` TTL 15 minutes
- Prisma queries use `any` types (R01)
- Include `explanation.en` AND `explanation.pidgin` in every result

---

## TAX HEALTH SCORE — 100-POINT MODEL

```
Component              Weight  Calculation
──────────────────────────────────────────────────────────
filingTimeliness        30pts  % of deadlines met on time (trailing 12 months)
dataCompleteness        25pts  % of invoices with TIN, category, VAT flag
complianceCalendar      20pts  % of upcoming deadlines acknowledged/actioned
nrsSubmissions          15pts  % of invoices with confirmed IRN stamps
paymentHistory          10pts  % of tax payments completed before due date

Grades:  90-100 "Tax Champion" | 75-89 "Good" | 50-74 "Fair" | 25-49 "Poor" | 0-24 "Critical"
Pidgin:  "You sabi am!"       | "E dey go"  | "E okay"     | "Wahala dey"  | "E bad well well"
Trend:   Compare this month vs prior 3-month average → improving/stable/declining
```

---

## COMPLIANCE CALENDAR — NTA 2025 DEADLINES

```
Tax Type  Frequency  Due Date           Penalty (late)
─────────────────────────────────────────────────────────
VAT       Monthly    21st following mo  ₦10,000 + 0.5%/day
PIT       Annual     31 March           10% + 21%/yr interest
CIT       Annual     6mo after year-end 10% + 21%/yr interest
PAYE      Monthly    10th following mo  10% + 21%/yr interest
WHT       Monthly    21st following mo  10% + 21%/yr interest
CGT       Event      30 days post-sale  10% + 21%/yr interest

Reminder cadence:
  ≥ 90% on-time user:  T-14, T-7, T-1
  70-90% on-time:      T-30, T-14, T-7, T-3, T-1
  < 70% on-time:       T-30, T-21, T-14, T-7, T-3, T-1, T+1 (overdue alert)
```

---

## SMART COMPLIANCE CALENDAR FEATURES

```typescript
computeProjectedLiability(userId, trailing90Days) → { taxType, amount, confidence }
generateSmartReminders(userId)                   → PushNotification[]
identifySavingsWindow(userId)                    → { startDate, endDate, savingsOpportunity }
computePenaltyAccrual(taxType, daysLate, amount) → { fixedPenalty, dailyAccrual, total }
```

---

## INPUTS / OUTPUTS

```
Inputs:  userId, expense records, invoice records, tax return history (from PostgreSQL)
Outputs: AnomalyResult[], TaxHealthSnapshot, ComplianceDeadline[], OCRResult
```

---

## DEPENDENCIES

```
Internal: packages/contracts (tax engine), backend/src/services/
External: Google Cloud Vision, Tesseract.js, Sharp, Youverify (TIN validation),
          Redis (anomaly cache), PostgreSQL (history queries)
```
