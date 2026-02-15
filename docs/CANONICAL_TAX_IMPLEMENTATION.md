# 🎯 CANONICAL TAX COMPLIANCE IMPLEMENTATION
## NTA 2025 & NRS 2026 Hardening - Phase 1 Complete

**Date**: February 2026  
**Status**: ✅ Backend Complete | 🔄 Mobile In Progress

---

## 📋 IMPLEMENTATION SUMMARY

### ✅ Completed Tasks

#### 1. Canonical Tax Rules Establishment
- **File**: `packages/contracts/src/tax-rules.ts`
- **Status**: ✅ Extended with NTA 2025 compliance
- **Changes**:
  - Added `DEVELOPMENT_LEVY_RATE` (4% of assessable profits)
  - Added `MINIMUM_ETR` (15% for companies > ₦1B turnover)
  - Added `MINIMUM_ETR_THRESHOLD` (₦1B)
  - Added `DIGITAL_TAX_THRESHOLD` (₦25M annual digital income)
  - Updated `NTA_2025_RULES` aggregate object

#### 2. Backend CIT Calculation Extension
- **File**: `backend/src/services/tax-engine.ts`
- **Status**: ✅ Fully compliant with NTA 2025
- **Changes**:
  - Extended `CITInput` interface with `employeeCount` and `digitalIncome`
  - Extended `CITResult` interface with:
    - `developmentLevy`: 4% of profit
    - `edt`: Educational Development Tax (2% if ≥10 employees)
    - `totalTax`: Sum of all tax components
    - `minimumETRApplied`: Boolean flag
    - `digitalTaxApplicable`: Boolean flag
  - Implemented Development Levy calculation (mandatory for all companies)
  - Implemented EDT calculation (conditional on employee count)
  - Implemented Minimum ETR check (15% for large companies)
  - Implemented Digital Tax threshold detection

#### 3. API Route Updates
- **File**: `backend/src/routes/tax.ts`
- **Status**: ✅ Schema updated
- **Changes**:
  - Updated `CITBodySchema` to accept optional `employeeCount` and `digitalIncome`

#### 4. Tax Rules API Endpoint
- **File**: `backend/src/routes/tax-rules.ts` (NEW)
- **Status**: ✅ Created and registered
- **Endpoints**:
  - `GET /api/v1/tax/rules` - Returns all NTA 2025 rules
  - `GET /api/v1/tax/rules/:type` - Returns specific tax type rules (pit, vat, cit, cgt, wht, paye, penalties, compliance)

#### 5. Canonical JSON Rules File
- **File**: `backend/config/nta2025-rules.json` (NEW)
- **Status**: ✅ Created
- **Purpose**: JSON representation of canonical rules for backend consumption

#### 6. Test Coverage Enhancement
- **File**: `backend/src/__tests__/tax-engine.unit.test.ts`
- **Status**: ✅ All tests passing (423 passed)
- **New Tests**:
  - Development Levy application (4% for all companies)
  - EDT application (2% for companies with ≥10 employees)
  - Minimum ETR enforcement (15% for companies > ₦1B)
  - Digital Tax threshold detection (≥₦25M digital income)
  - Tax component breakdown validation
  - Total tax calculation with all components
  - Updated existing tests to account for Development Levy

#### 7. Mobile Tax Engine Consolidation
- **File**: `mobile/src/services/tax/engine.ts`
- **Status**: ✅ Refactored to use canonical rules
- **Changes**:
  - Removed duplicate tax constants
  - Imported canonical constants from `@taxbridge/contracts`:
    - `PIT_BRACKETS`
    - `VAT_RATE`
    - `CIT_TIERS`
    - `MINIMUM_WAGE_ANNUAL`
    - `CRA_FIXED`
    - `DEVELOPMENT_LEVY_RATE`
    - `MINIMUM_ETR`
    - `MINIMUM_ETR_THRESHOLD`
    - `DIGITAL_TAX_THRESHOLD`
    - `EDT_RATE`
  - Created `MOBILE_PIT_BRACKETS` adapter for mobile format
  - Extended `calculateCIT()` with Development Levy, EDT, and Minimum ETR logic
  - Updated `CITCalculation` interface to match backend

---

## 🎯 TAX COMPLIANCE RULES (NTA 2025)

### Personal Income Tax (PIT)
- **6-Band Progressive System** (0% - 25%)
  - ₦0 - ₦800,000: 0% (Tax-Free)
  - ₦800,001 - ₦3,000,000: 15%
  - ₦3,000,001 - ₦12,000,000: 18%
  - ₦12,000,001 - ₦25,000,000: 21%
  - ₦25,000,001 - ₦50,000,000: 23%
  - Above ₦50,000,000: 25%

### Company Income Tax (CIT)
- **3-Tier System** (0% / 20% / 30%)
  - Small Companies (≤₦25M): 0%
  - Medium Companies (≤₦100M): 20%
  - Large Companies (>₦100M): 30%

- **Additional Tax Components**:
  1. **Development Levy**: 4% of assessable profits (ALL companies)
  2. **Educational Development Tax (EDT)**: 2% of profit (companies with ≥10 employees)
  3. **Minimum Effective Tax Rate (ETR)**: 15% of profit (companies with turnover > ₦1B)

- **Digital Tax Threshold**: ₦25M annual digital income triggers digital tax obligations

### Value Added Tax (VAT)
- **Standard Rate**: 7.5%
- **Registration Threshold**: ₦100M annual turnover

### Capital Gains Tax (CGT)
- **Rate**: 10% on net gains

### Withholding Tax (WHT)
- **Standard Rates**: 10% (dividend, interest, rent, royalty, consultancy, professional fees)
- **Reduced Rates**: 5% (construction, contract services)

---

## 📊 CIT CALCULATION EXAMPLE

### Scenario: Medium Company with 15 Employees
- **Revenue**: ₦200,000,000
- **Expenses**: ₦100,000,000
- **Employee Count**: 15
- **Digital Income**: ₦0

### Calculation:
1. **Profit**: ₦100,000,000
2. **CIT (30%)**: ₦30,000,000
3. **Development Levy (4%)**: ₦4,000,000
4. **EDT (2%)**: ₦2,000,000
5. **Total Tax**: ₦36,000,000
6. **Net Profit**: ₦64,000,000
7. **Effective Rate**: 18% of revenue

---

## 🔄 PENDING TASKS

### Mobile Consolidation (In Progress)
- [ ] Refactor `mobile/src/services/taxCalculator.ts` to use canonical rules
- [ ] Refactor `mobile/src/utils/taxCalculator.ts` to use canonical rules
- [ ] Refactor `mobile/src/services/tax/rules/nigeria-2025.ts` to import from contracts
- [ ] Update mobile tax calculation screens to use extended CIT logic
- [ ] Add employee count and digital income inputs to mobile CIT calculator

### NRS E-Invoicing Verification
- [ ] Verify idempotency of FIRS NRS submission
- [ ] Add status observability for e-invoice lifecycle
- [ ] Test IRN generation and QR code embedding

### OCR Consolidation
- [ ] Ensure backend OCR remains primary
- [ ] Add confidence-gated review workflow
- [ ] Implement low-confidence alert system

### Security & NDPC Audit
- [ ] Verify encryption of TIN/BVN/NIN
- [ ] Audit CORS configuration
- [ ] Review rate limiting rules
- [ ] Check audit log completeness

### Final Validation
- [ ] Run comprehensive smoke tests
- [ ] Validate all environment variables
- [ ] Complete go/no-go checklist

---

## 🧪 TEST RESULTS

### Backend Unit Tests
- **Status**: ✅ All Passing
- **Test Suites**: 21 passed
- **Tests**: 423 passed, 12 skipped
- **Coverage**: Tax engine at 97.29% statements

### Key Test Cases
✅ Development Levy applied to all companies  
✅ EDT applied only for companies with ≥10 employees  
✅ Minimum ETR enforced for companies > ₦1B  
✅ Digital Tax threshold detection working  
✅ All tax components included in breakdown  
✅ Total tax calculation accurate  
✅ CIT tier boundaries correct (₦25M, ₦100M)  

---

## 📚 API DOCUMENTATION

### New Endpoints

#### GET /api/v1/tax/rules
Returns all NTA 2025 tax rules.

**Response**:
```json
{
  "success": true,
  "data": {
    "version": "NTA 2025",
    "effectiveDate": "2026-01-01",
    "rules": { ... }
  }
}
```

#### GET /api/v1/tax/rules/:type
Returns specific tax type rules.

**Parameters**:
- `type`: pit | vat | cit | cgt | wht | paye | penalties | compliance

**Response**:
```json
{
  "success": true,
  "data": {
    "type": "cit",
    "version": "NTA 2025",
    "effectiveDate": "2026-01-01",
    "rules": {
      "tiers": [...],
      "developmentLevy": 0.04,
      "minimumETR": { "rate": 0.15, "threshold": 1000000000 },
      "digitalTaxThreshold": 25000000
    }
  }
}
```

#### POST /api/v1/tax/calculate/cit (Updated)
Calculate Company Income Tax with extended compliance.

**Request**:
```json
{
  "revenue": 200000000,
  "expenses": 100000000,
  "employeeCount": 15,
  "digitalIncome": 0
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "revenue": 200000000,
    "expenses": 100000000,
    "profit": 100000000,
    "taxRate": 0.30,
    "taxAmount": 30000000,
    "developmentLevy": 4000000,
    "edt": 2000000,
    "totalTax": 36000000,
    "effectiveRate": 0.18,
    "netProfit": 64000000,
    "category": "Large Company (>₦100M) — 30%",
    "breakdown": [...],
    "minimumETRApplied": false,
    "digitalTaxApplicable": false
  }
}
```

---

## 🔐 COMPLIANCE CHECKLIST

### NTA 2025 Compliance
- [x] PIT 6-band system (0% - 25%)
- [x] CIT 3-tier system (0% / 20% / 30%)
- [x] Development Levy (4%)
- [x] Educational Development Tax (2% conditional)
- [x] Minimum ETR (15% for large companies)
- [x] Digital Tax threshold detection (₦25M)
- [x] VAT rate (7.5%)
- [x] CGT rate (10%)
- [x] WHT rates (5% - 10%)

### NRS 2026 Compliance
- [x] Tax rules API endpoint
- [x] Canonical rules JSON file
- [ ] E-invoice idempotency (pending verification)
- [ ] IRN lifecycle tracking (pending)

---

## 📝 NOTES

### Breaking Changes
- `CITResult` interface extended with new fields
- Mobile `calculateCIT()` signature changed to accept optional `employeeCount` and `digitalIncome`
- All CIT calculations now include Development Levy by default

### Migration Guide
1. Update all CIT calculation calls to handle new result fields
2. Update mobile UI to display Development Levy and EDT separately
3. Add employee count input to CIT calculator forms
4. Add digital income input for digital businesses

### Performance Impact
- Minimal: Additional calculations are simple arithmetic operations
- No database queries added
- No external API calls introduced

---

## 🚀 DEPLOYMENT NOTES

### Environment Variables
No new environment variables required for this phase.

### Database Migrations
No database schema changes required for this phase.

### Build Requirements
1. Rebuild `@taxbridge/contracts` package: `cd packages/contracts && npm run build`
2. Rebuild backend: `cd backend && npm run build`
3. Run tests: `cd backend && npm test`

### Rollback Plan
If issues arise:
1. Revert `packages/contracts/src/tax-rules.ts`
2. Revert `backend/src/services/tax-engine.ts`
3. Revert `backend/src/routes/tax.ts`
4. Rebuild and redeploy

---

## 📞 SUPPORT

For questions or issues related to this implementation:
- Review test cases in `backend/src/__tests__/tax-engine.unit.test.ts`
- Check canonical rules in `packages/contracts/src/tax-rules.ts`
- Refer to NTA 2025 documentation in `docs/Implementation_guide/`

---

**Last Updated**: February 2026  
**Implementation Phase**: 1 of 9  
**Next Phase**: Mobile Tax Calculator Consolidation
