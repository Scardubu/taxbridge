# TaxBridge Onboarding System - Quick Start Guide

## 🚀 Getting Started

### For Developers

#### 1. Install Dependencies
```bash
cd mobile
npm install
```

#### 2. Run Mobile App
```bash
# iOS
npx expo start --ios

# Android
npx expo start --android
```

#### 3. View Onboarding
The onboarding flow automatically appears on first app launch. To reset:

```typescript
// In Expo DevTools or code:
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear onboarding state
await AsyncStorage.multiRemove([
  '@taxbridge_onboarding_profile',
  '@taxbridge_onboarding_progress',
  '@taxbridge_onboarding_calculator_history',
  '@taxbridge_onboarding_achievements'
]);

// Restart app
```

---

## 📁 Key Files

### Core Components
| File | Purpose | Lines |
|------|---------|-------|
| `mobile/src/screens/OnboardingScreen.tsx` | Main orchestrator | 198 |
| `mobile/src/contexts/OnboardingContext.tsx` | State management | 299 |
| `mobile/App.tsx` | Routing integration | 100 |

### Step Components
| File | Step | Time | Lines |
|------|------|------|-------|
| `ProfileAssessmentStep.tsx` | 1. Profile | 30s | 380 |
| `PITTutorialStep.tsx` | 2. PIT Education | 90s | 640 |
| `VATCITAwarenessStep.tsx` | 3. VAT/CIT (conditional) | 60s | 740 |
| `FIRSDemoStep.tsx` | 4. FIRS Demo | 60s | 598 |
| `GamificationStep.tsx` | 5. Gamification | 20s | 420 |
| `CommunityStep.tsx` | 6. Community | 45s | 460 |

### Utilities
| File | Purpose | Lines |
|------|---------|-------|
| `mobile/src/utils/taxCalculator.ts` | Tax calculations | 220 |
| `mobile/src/services/mockFIRS.ts` | Educational API | 160 |

### Translations
| File | Keys | Language |
|------|------|----------|
| `mobile/src/i18n/en.json` | 150+ | English |
| `mobile/src/i18n/pidgin.json` | 150+ | Nigerian Pidgin |

---

## 🎯 User Flow

```
┌─────────────────────────────────────────────────────────────┐
│ App Launch                                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ OnboardingContext Check: isOnboardingComplete?              │
└─────────────────────────────────────────────────────────────┘
           │                                    │
           │ No                                 │ Yes
           ▼                                    ▼
┌──────────────────────┐           ┌──────────────────────────┐
│ OnboardingScreen     │           │ MainTabs (Home, Create,  │
│                      │           │ Invoices, Settings)      │
│ Step 1: Profile      │           └──────────────────────────┘
│ ↓                    │
│ Step 2: PIT Tutorial │
│ ↓                    │
│ Step 3: VAT/CIT      │◄── Conditional (turnover >₦2M)
│ ↓                    │
│ Step 4: FIRS Demo    │
│ ↓                    │
│ Step 5: Gamification │
│ ↓                    │
│ Step 6: Community    │
│ ↓                    │
│ completeOnboarding() │
└──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│ MainTabs (user can now access full app)                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Locally

### Test Scenarios

#### 1. Full Flow (Low Income)
```typescript
// Step 1: Profile
incomeSource: 'salary'
annualIncome: ₦1,500,000
businessType: 'not_registered'

// Expected:
// - Step 3 (VAT/CIT) skipped (turnover <₦2M)
// - Steps: 1 → 2 → 4 → 5 → 6
```

#### 2. Full Flow (High Income)
```typescript
// Step 1: Profile
incomeSource: 'business'
annualIncome: ₦8,000,000
businessType: 'considering_incorporation'

// Expected:
// - Step 3 (VAT/CIT) shown
// - Steps: 1 → 2 → 3 → 4 → 5 → 6
```

#### 3. Tax Calculation Validation
```typescript
// Step 2: PIT Tutorial
grossIncome: ₦3,000,000
rentPaid: ₦1,000,000
pensionContrib: ₦50,000

// Expected:
// Rent relief: ₦500,000 (capped, not ₦200k)
// NHF: ₦75,000 (2.5% of ₦3M)
// Chargeable: ₦2,425,000
// Tax Band 1: ₦0 (exempt ≤₦800k)
// Tax Band 2: ₦243,750 (15% of ₦1,625k)
// Total Tax: ₦243,750
// Effective Rate: 8.13%
```

#### 4. Mock FIRS API
```typescript
// Step 4: FIRS Demo
// Click "Try Mock API"

// Expected Response:
{
  stampCode: 'MOCK-1736687400000',
  irn: 'IRN-DEMO-1736687400000',
  qrCode: 'data:image/svg+xml;base64,...',
  isMock: true,
  disclaimer: 'EDUCATIONAL SIMULATION ONLY...'
}
```

---

## 🐛 Common Issues

### Issue 1: TypeScript Errors
**Symptom:** "Cannot find module '../components/onboarding/...'"

**Fix:**
```bash
# Reload TypeScript server in VSCode
Ctrl+Shift+P → "TypeScript: Restart TS Server"

# Or rebuild
cd mobile
npm run tsc
```

### Issue 2: Onboarding Doesn't Appear
**Symptom:** App goes straight to MainTabs

**Fix:**
```typescript
// Check AsyncStorage in Expo DevTools
import AsyncStorage from '@react-native-async-storage/async-storage';
const progress = await AsyncStorage.getItem('@taxbridge_onboarding_progress');
console.log('Progress:', progress);

// Clear if needed (see Getting Started section)
```

### Issue 3: Translations Not Loading
**Symptom:** Seeing translation keys instead of text (e.g., "onboarding.profile.title")

**Fix:**
```bash
# Check i18n files exist
ls mobile/src/i18n/en.json
ls mobile/src/i18n/pidgin.json

# Verify JSON is valid
cat mobile/src/i18n/en.json | jq .

# Restart app
```

### Issue 4: Tax Calculations Wrong
**Symptom:** PIT calculator showing incorrect amounts

**Fix:**
```typescript
// Check taxCalculator.ts PIT_BANDS
// Bands should be:
[
  { min: 0, max: 800000, rate: 0 },
  { min: 800000, max: 3000000, rate: 0.15 },
  { min: 3000000, max: 12000000, rate: 0.18 },
  { min: 12000000, max: 25000000, rate: 0.21 },
  { min: 25000000, max: 50000000, rate: 0.23 },
  { min: 50000000, max: Infinity, rate: 0.25 },
]

// Test manually:
import { calculatePIT } from './src/utils/taxCalculator';
const result = calculatePIT(3000000);
console.log(result); // Should be ₦330,000
```

---

## 📊 Analytics Events (Sentry)

### Breadcrumbs Sent
```typescript
// Step events
{ category: 'onboarding', message: 'step.profile.started', level: 'info' }
{ category: 'onboarding', message: 'step.profile.completed', level: 'info' }
{ category: 'onboarding', message: 'step.pit.started', level: 'info' }
{ category: 'onboarding', message: 'step.pit.completed', level: 'info' }
{ category: 'onboarding', message: 'step.vatcit.skipped', level: 'info' }
{ category: 'onboarding', message: 'step.firs.completed', level: 'info' }
{ category: 'onboarding', message: 'step.gamification.completed', level: 'info' }
{ category: 'onboarding', message: 'step.community.completed', level: 'info' }
{ category: 'onboarding', message: 'completed', level: 'info' }

// Engagement events
{ category: 'onboarding', message: 'pit.calculator.used', level: 'info', data: { income: 3000000 } }
{ category: 'onboarding', message: 'pit.quiz.answered', level: 'info', data: { correct: true } }
{ category: 'onboarding', message: 'firs.demo.tried', level: 'info' }
{ category: 'onboarding', message: 'community.referral.entered', level: 'info' }
```

---

## 🎨 Customization

### Change Primary Color
```typescript
// Update in all StyleSheet definitions
// Find & Replace: '#0B5FFF' → '#YOUR_COLOR'

// Files to update:
// - ProfileAssessmentStep.tsx
// - PITTutorialStep.tsx
// - VATCITAwarenessStep.tsx
// - FIRSDemoStep.tsx
// - GamificationStep.tsx
// - CommunityStep.tsx
```

### Add New Achievement
```typescript
// In OnboardingContext.tsx
const DEFAULT_ACHIEVEMENTS = [
  // ... existing achievements
  {
    id: 'new_achievement',
    name: 'New Badge',
    description: 'Complete X task',
    icon: '🎖️',
    unlockedAt: null,
  },
];

// Trigger unlock in step component:
const { unlockAchievement } = useOnboarding();
unlockAchievement('new_achievement');
```

### Add New Translation
```typescript
// In mobile/src/i18n/en.json
{
  "onboarding": {
    "newKey": "New text here"
  }
}

// In mobile/src/i18n/pidgin.json
{
  "onboarding": {
    "newKey": "Pidgin translation"
  }
}

// Use in component:
const { t } = useTranslation();
<Text>{t('onboarding.newKey')}</Text>
```

---

## 🔐 Security Notes

### What's Safe
✅ All tax calculations done locally (no API calls)  
✅ Profile data stays in AsyncStorage (never sent to backend)  
✅ Mock FIRS API has no real credentials  
✅ Referral codes generated client-side (no PII)

### What's NOT Safe (Do Not Do)
❌ Never use mockFIRS.ts in production  
❌ Never collect real TIN during onboarding  
❌ Never send profile data to backend without consent  
❌ Never bypass encryption for real invoice stamping

---

## 📞 Support

### For Developers
- **Slack:** #taxbridge-mobile
- **Jira:** TBR-123 (Onboarding System Epic)
- **Docs:** `/docs/PRD.md`

### For Users
- **WhatsApp:** +234-XXX-XXXX-XXX
- **Telegram:** @TaxBridgeSupport
- **Email:** support@taxbridge.ng

---

## 📚 Further Reading

- [PRD.md](../docs/PRD.md) - Product Requirements Document
- [Nigeria Tax Act 2025](https://firs.gov.ng) - Official tax rates
- [NDPC Compliance](../docs/SECURITY_ARCHITECTURE.md) - Data protection
- [UBL 3.0 Spec](../docs/ubl/) - Invoice format

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Status:** Production-Ready ✅
