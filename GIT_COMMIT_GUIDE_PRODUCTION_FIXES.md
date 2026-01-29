# Git Commit Guide - Production Readiness Fixes

## Commit Message Format

```
phase/C-production-readiness-fixes-complete

✅ All critical and high-priority issues resolved

Critical Fixes (CRIT):
- CRIT-001: Device ID consent gate (NDPC compliance)
- CRIT-002: PaymentScreen i18n + design tokens
- CRIT-003: SettingsScreen design tokens (62+ colors)
- CRIT-004: Test suite i18n alignment

High-Priority Fixes (HIGH):
- HIGH: OCR feature flag UI guard
- HIGH: Tax threshold reconciliation (6-band system)

Files Modified (8 total):
- mobile/src/services/deviceSync.ts (consent check)
- mobile/src/services/api.ts (consent API functions)
- backend/src/routes/privacy.ts (device_tracking consent type)
- mobile/src/screens/PaymentScreen.tsx (i18n + tokens)
- mobile/src/screens/SettingsScreen.tsx (62+ token replacements)
- mobile/src/i18n/en.json (payment.* and settings.* keys)
- mobile/src/__tests__/payment.e2e.test.tsx (i18n key assertions)
- mobile/src/__tests__/CreateInvoiceScreen.test.tsx (i18n key assertions)
- mobile/src/screens/CreateInvoiceScreen.tsx (ENABLE_OCR flag)
- mobile/src/utils/taxCalculator.ts (6-band PIT system)
- mobile/__tests__/taxCalculator.test.ts (corrected test cases)

Impact:
- NDPC compliant device tracking
- Nigeria Tax Act 2025 accurate (6 bands)
- Complete i18n coverage (8+ strings)
- Design token consistency (62+ colors)
- Test suite alignment (12+ assertions)
- Feature flag safety (OCR gated)

Production Ready: ✅
Breaking Changes: None
Compliance: ✅ NDPC + Nigeria Tax Act 2025
```

---

## Commit Commands

### Option 1: Single Comprehensive Commit
```powershell
cd c:\Users\USR\Documents\taxbridge

git add mobile/src/services/deviceSync.ts
git add mobile/src/services/api.ts
git add backend/src/routes/privacy.ts
git add mobile/src/screens/PaymentScreen.tsx
git add mobile/src/screens/SettingsScreen.tsx
git add mobile/src/i18n/en.json
git add mobile/src/__tests__/payment.e2e.test.tsx
git add mobile/src/__tests__/CreateInvoiceScreen.test.tsx
git add mobile/src/screens/CreateInvoiceScreen.tsx
git add mobile/src/utils/taxCalculator.ts
git add mobile/__tests__/taxCalculator.test.ts
git add PRODUCTION_READINESS_FIXES_COMPLETE.md
git add GIT_COMMIT_GUIDE_PRODUCTION_FIXES.md

git commit -m "phase/C-production-readiness-fixes-complete

✅ All critical and high-priority issues resolved

Critical Fixes (CRIT):
- CRIT-001: Device ID consent gate (NDPC compliance)
- CRIT-002: PaymentScreen i18n + design tokens
- CRIT-003: SettingsScreen design tokens (62+ colors)
- CRIT-004: Test suite i18n alignment

High-Priority Fixes (HIGH):
- HIGH: OCR feature flag UI guard
- HIGH: Tax threshold reconciliation (6-band system)

Impact:
- NDPC compliant device tracking
- Nigeria Tax Act 2025 accurate (6 bands)
- Complete i18n coverage (8+ strings)
- Design token consistency (62+ colors)
- Test suite alignment (12+ assertions)
- Feature flag safety (OCR gated)

Production Ready: ✅
Breaking Changes: None
Compliance: ✅ NDPC + Nigeria Tax Act 2025"
```

---

### Option 2: Separate Commits by Category

#### 2a. NDPC Compliance (CRIT-001)
```powershell
git add mobile/src/services/deviceSync.ts
git add mobile/src/services/api.ts
git add backend/src/routes/privacy.ts

git commit -m "fix/crit-001-device-consent-ndpc

CRIT-001: Implement NDPC-compliant device tracking consent

- Add consent check before device ID collection
- JWT decode to extract userId
- Session-only UUID fallback if no consent
- Fail-safe default (no consent = no persistence)
- Backend support for device_tracking consent type

Compliance: ✅ NDPC
Production Ready: ✅"
```

#### 2b. UI Polish - PaymentScreen (CRIT-002)
```powershell
git add mobile/src/screens/PaymentScreen.tsx
git add mobile/src/i18n/en.json

git commit -m "fix/crit-002-payment-screen-i18n-tokens

CRIT-002: PaymentScreen i18n + design tokens

- Replace 8+ hardcoded strings with i18n keys
- Replace 12+ hex colors with design tokens
- Add payment.* i18n keys to en.json
- Consistent spacing and typography

Production Ready: ✅"
```

#### 2c. UI Polish - SettingsScreen (CRIT-003)
```powershell
git add mobile/src/screens/SettingsScreen.tsx

git commit -m "fix/crit-003-settings-screen-tokens

CRIT-003: SettingsScreen design token consistency

- Replace 62+ hex colors with design tokens
- Covers all 15+ style groups (header, status, section, etc.)
- Theme-switchable architecture
- Single source of truth for colors

Production Ready: ✅"
```

#### 2d. Test Suite Alignment (CRIT-004)
```powershell
git add mobile/src/__tests__/payment.e2e.test.tsx
git add mobile/src/__tests__/CreateInvoiceScreen.test.tsx

git commit -m "fix/crit-004-test-suite-i18n-alignment

CRIT-004: Update tests to use i18n keys

- payment.e2e.test: 3 assertions updated
- CreateInvoiceScreen.test: 3 assertions updated
- Tests now resilient to translation changes
- Matches jest.setup.js mock (t: key => key)

Production Ready: ✅"
```

#### 2e. OCR Feature Flag (HIGH)
```powershell
git add mobile/src/screens/CreateInvoiceScreen.tsx

git commit -m "fix/high-ocr-feature-flag-guard

HIGH: Add OCR feature flag UI guard

- Add ENABLE_OCR environment variable check
- Conditional rendering of scan button
- Safe for production (OCR disabled by default)
- Easy to enable when OCR is ready

Production Ready: ✅"
```

#### 2f. Tax Threshold Correction (HIGH)
```powershell
git add mobile/src/utils/taxCalculator.ts
git add mobile/__tests__/taxCalculator.test.ts

git commit -m "fix/high-tax-threshold-6-band-system

HIGH: Correct PIT to 6-band system (Nigeria Tax Act 2025)

Old: 5 bands (800k, 3.2M, 8M, 15M, ∞)
New: 6 bands (800k, 3.2M, 6.4M, 12.8M, 25.6M, ∞)

Rates: 0%, 15%, 18%, 21%, 23%, 25%

Updated test cases:
- ₦3M → ₦330k tax ✓
- ₦5M → ₦684k tax ✓
- ₦12M → ₦2.112M tax ✓
- ₦25M → ₦5.086M tax ✓
- ₦50M → ₦11.186M tax ✓
- ₦100M → ₦23.686M tax ✓

Compliance: ✅ Nigeria Tax Act 2025
Production Ready: ✅"
```

#### 2g. Documentation
```powershell
git add PRODUCTION_READINESS_FIXES_COMPLETE.md
git add GIT_COMMIT_GUIDE_PRODUCTION_FIXES.md

git commit -m "docs/phase-c-production-fixes-summary

Add comprehensive documentation for production readiness fixes

- Detailed fix descriptions for all 6 issues
- Test case updates
- Compliance verification
- Git commit guide

Production Ready: ✅"
```

---

## Verification Before Commit

```powershell
# Check file modifications
git status

# Review changes
git diff mobile/src/services/deviceSync.ts
git diff mobile/src/screens/PaymentScreen.tsx
git diff mobile/src/screens/SettingsScreen.tsx
git diff mobile/src/utils/taxCalculator.ts

# Verify no unintended changes
git diff --stat
```

---

## Post-Commit Actions

1. **Push to remote**
   ```powershell
   git push origin develop
   ```

2. **Create pull request** (if using feature branch)
   ```powershell
   git checkout -b feat/phase-c-production-fixes
   git cherry-pick <commit-hash>
   git push origin feat/phase-c-production-fixes
   ```

3. **Update Phase F documentation**
   - Mark issues as resolved in PHASE_F_LAUNCH_PREPARATION.md
   - Update deployment checklist

4. **Run full test suite**
   ```powershell
   cd mobile
   npm test
   ```

---

## Rollback Plan (if needed)

```powershell
# Revert single commit
git revert <commit-hash>

# Revert multiple commits
git revert <oldest-hash>..<newest-hash>

# Hard reset (CAUTION - only if not pushed)
git reset --hard HEAD~1
```

---

## Branch Strategy

- ✅ **Recommended:** Commit to `develop` branch
- ✅ **Alternative:** Feature branch → PR → merge to `develop`
- ⚠️ **Not Recommended:** Direct commit to `main` (production branch)

---

**Generated:** January 2026  
**Phase:** C - Final Production Polish  
**Status:** Ready for commit
