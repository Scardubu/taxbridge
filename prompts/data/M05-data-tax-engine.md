# MODULE M05 — DATA LAYER & TAX ENGINE
## TaxBridge AI Operating Context
**Token budget:** ~1,000 tokens | **Inject:** Tax calculation tasks, DB schema tasks

---

## PURPOSE
Reference for the shared tax engine (packages/contracts), database schema, migration
rules, and data engineering patterns.

## SCOPE
`packages/contracts/` — shared by backend, mobile, admin.
Database: PostgreSQL via Prisma 5.22. Mobile SQLite via expo-sqlite.

---

## TAX ENGINE — NTA 2025 RULES (packages/contracts/src/tax-engine/)

### PIT — Personal Income Tax (6 bands, NTA 2025 §1-40)

```
Band  Taxable Income Range     Rate
────────────────────────────────────
1     First ₦800,000           7%
2     Next ₦2,200,000          11%
3     Next ₦3,200,000          15%
4     Next ₦8,000,000          19%
5     Next ₦36,000,000         21%
6     Above ₦50,200,000        24%

CRA (Consolidated Relief Allowance, §33):
  = ₦200,000 + 20% of gross income
  Pension (8% employee), NHF (2.5% of basic) are also deductible

Taxable income = Gross − CRA − Pension − NHF
```

### VAT — Value Added Tax (NTA 2025 §11)

```
Rate:              7.5%
Registration:      Required if annual turnover ≥ ₦100,000,000
Filing:            Monthly by 21st of following month
Late penalty:      ₦10,000 flat + 0.5% per day
Zero-rated:        Exports, basic foodstuffs (Schedule 1)
Exempt:            Medical, educational, financial services
```

### CIT — Company Income Tax (NTA 2025 §55)

```
Turnover < ₦25M:        0% (small companies)
₦25M ≤ Turnover < ₦100M: 20%
Turnover ≥ ₦100M:        30%
Development Levy:        4% of profits (NTA 2025 §60A)
Filing:                  6 months after year-end
```

### WHT — Withholding Tax (NTA 2025 §78)

```
Professional services:   5%
Dividends:               10%
Rent:                    10%
Construction:            5%
Technical services:      5%
Filing:                  21st of following month
```

### PAYE — Employer obligations (NTA 2025 §82)

```
Employer deducts:        PIT computed on employee gross income
Pension (employer):      10% of gross (PRA 2014)
Pension (employee):      8% of gross (deductible)
NHF:                     2.5% of basic salary (employee only)
Due date:                10th of following month
Authority:               State of employee's residence (LIRS, SIRS, KIRS, etc.)
```

---

## DATABASE SCHEMA — KEY MODELS (Prisma, types as `any`)

```prisma
// CRITICAL: All where/input/create/update types must use `any`
// Never write: prisma.invoice.findMany({ where: Prisma.InvoiceWhereInput })
// Always write: prisma.invoice.findMany({ where: { userId: id } as any })

model Invoice {
  id            String    @id @default(cuid())
  userId        String
  nrsStatus     String    @default("PENDING")  // PENDING | STAMPED | FAILED
  irn           String?
  csid          String?
  nrsReference  String    @unique              // Idempotency key
  retryCount    Int       @default(0)
  amount        Float
  vatAmount     Float?
  customerTin   String?
  createdAt     DateTime  @default(now())
}

model Expense {
  id            String    @id @default(cuid())
  userId        String
  amount        Float
  vatAmount     Float?
  vatEligible   Boolean   @default(false)
  category      String    // One of 13 Nigerian expense categories
  vendorName    String?
  vendorTin     String?
  ocrConfidence Float?
  date          DateTime
  createdAt     DateTime  @default(now())
}

model AnomalyRecord {
  id            String    @id @default(cuid())
  userId        String
  signal        String    // One of 9 AnomalySignal values
  severity      String    // low | medium | high | critical
  explanationEn String
  explanationPidgin String
  confidence    Float
  dismissed     Boolean   @default(false)
  detectedAt    DateTime  @default(now())
}

model TaxHealthSnapshot {
  id            String    @id @default(cuid())
  userId        String
  score         Int       // 0-100
  grade         String    // champion | good | fair | poor | critical
  trend         String    // improving | stable | declining
  trendDelta    Float
  components    Json      // filingTimeliness, dataCompleteness, etc.
  computedAt    DateTime  @default(now())
}

model VaultDocument {
  id            String    @id @default(cuid())
  userId        String
  category      String
  name          String
  storageKey    String
  mimeType      String
  sizeBytes     Int
  encrypted     Boolean   @default(true)
  checksum      String    // SHA-256
  iv            String    // AES-256-GCM IV
  authTag       String    // AES-256-GCM auth tag
  retentionUntil DateTime
  tags          String[]
  taxPeriod     String?
  metadata      Json      @default("{}")
  uploadedAt    DateTime  @default(now())
}
```

---

## MIGRATION RULES

```
ALWAYS:   Add via new migration file in prisma/migrations/
          Test on staging before applying to production
          Write rollback script for every migration
          Use ADD COLUMN with DEFAULT (never rename or drop)

NEVER:    DROP COLUMN (soft-delete instead: deletedAt DateTime?)
          Run prisma db push in production (use prisma migrate deploy)
          Modify existing migrations (create new ones)
```

---

## MOBILE SQLite (expo-sqlite)

```typescript
// Tables: invoices, expenses, employees, payroll_runs,
//         app_settings, sentry_queue, sync_events, vault_index

// Pattern: read SQLite first (instant, offline), sync to API when online
// Key settings:
//   app_settings: onboarding_completed, language, lastSyncAt
//   sentry_queue: offline Sentry events pending flush
```

---

## COUNTRY CONFIG SYSTEM

```typescript
// packages/contracts/src/countries/index.ts
// Active:  NG (Nigeria) — full implementation
// Stubbed: GH (Ghana), KE (Kenya), SN (Senegal) — activate when expanding

interface CountryConfig {
  code: 'NG' | 'GH' | 'KE' | 'SN';
  currency: { code: string; symbol: string; locale: string; }
  taxAuthority: { name: string; filingPortal: string; }
  taxRules: CountryTaxRules;
  languages: string[];
}
// ACTIVE_COUNTRIES = ['NG'] — gate all country-specific features behind this
```

---

## INPUTS / OUTPUTS

```
Inputs:  Raw financial data (income, expenses, sales, payroll)
Outputs: Tax liability amounts, filing data structures, penalty calculations,
         anomaly signals, health scores, compliance deadlines
```

## DEPENDENCIES

```
Internal: packages/contracts (owns all tax calculation truth)
Runtime:  PostgreSQL via Prisma 5.22 (backend), expo-sqlite (mobile)
External: None — tax engine is fully self-contained (no external API calls)
```
