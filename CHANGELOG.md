# Changelog

All notable changes to TaxBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-02-06 - Production Launch 🚀

### 🎉 Production Deployed

TaxBridge V1.0.0 is now live in production with full NRS 2026 compliance.

#### Infrastructure
- **Backend:** Live at https://taxbridge-api-ker8.onrender.com (Service ID: srv-d62gsicr85hc73a34nc0)
- **Admin Dashboard:** Deployed to Vercel with 100% i18n coverage
- **Mobile App:** Production-ready for Play Store submission

### Fixed

#### Admin Dashboard - i18n Completion
- **Invoices Page:** All hardcoded strings replaced with i18n keys
  - Customer TIN, Name, Phone, Updated labels in dialog
  - UBL 3.0 XML analysis section header
  - Error message for failed invoice loading
- **Conflicts Page:** Resolution filter title internationalized
- **ErrorBoundary:** Fixed constructor props type (TS error)
- **Console Logging:** Production-safeguarded with NODE_ENV checks
- **Duplicate i18n Keys:** Removed 28 duplicate entries from admin i18n file

#### Mobile App - Console Cleanup
- **SettingsScreen:** Console statements wrapped in __DEV__ guards
- **OnboardingScreen:** Auto-save error logging production-safe

### Added
- 11 new admin i18n keys (English + Nigerian Pidgin)
  - `invoices.error.loadFailed`
  - `invoices.dialog.customerTIN`
  - `invoices.dialog.userName`
  - `invoices.dialog.userPhone`
  - `invoices.dialog.userTIN`
  - `invoices.dialog.updated`
  - `invoices.ublAnalysis`
  - `conflicts.filter.title`

### Technical
- **TypeScript:** 0 errors across admin-dashboard and mobile
- **i18n Parity:** 1,110+ keys with 100% English ↔ Nigerian Pidgin parity
- **Build Time:** Admin dashboard TypeScript check in 10.22s (clean)
- **Compliance:** NRS 2026 / NDPC / Nigeria Tax Act 2025 verified

### Documentation
- Updated README.md for V1.0.0 production launch
- Updated service references to new Render service ID
- Final production validation report complete

---

## [5.0.5] - 2026-01-26 - i18n Hardcoded String Sweep & Button Visibility Fix 🌐

### Fixed

#### Mobile App - i18n Compliance
- **SettingsScreen**: Extracted 17 hardcoded English strings to i18n (en.json + pidgin.json)
  - Section titles: Language & Accessibility, Data & Storage, Network & Sync, Community
  - Action labels: Clear Synced Data, Export Your Data, Refer & Earn
  - Alert dialogs: Join TaxBridge Community
  - Accessibility labels and helper text
- **InsightsCarousel**: Extracted 21 hardcoded strings to i18n
  - All insight card titles, descriptions, action labels, metric labels
  - Sync status dynamic text with interpolation parameters
- **InvoiceCard**: Added i18n support (2 hardcoded strings)
  - "Walk-in customer" fallback and "Offline" indicator
- **ChatbotScreen**: Consolidated 5 inline welcome messages into single i18n key
- **BrandedHero**: Default props now use i18n instead of hardcoded English
- **StatusBadge**: Status text now properly i18n-ized via common.* keys
- **DashboardScreen**: Footer version text extracted to i18n

#### Mobile App - Receipt Scanner Button
- **Visibility Fix**: Changed scan button variant from "secondary" to "primary"
  - Blue background makes the button clearly visible alongside the Add Item button
  - Added `minWidth: 100` to prevent excessive compression
  - Added `accessibilityHint` for better screen reader support

### Added
- 50+ new i18n keys in both `en.json` and `pidgin.json`
- `insights` i18n section with 22 translation keys
- `chatbot.welcomeMessage` translation key
- `create.scanReceiptHint` translation key
- 22 new `settings.*` keys for previously hardcoded SettingsScreen text

### Technical
- **TypeScript**: 0 errors across all modified files
- **i18n Parity**: English and Nigerian Pidgin translations maintained

---

## [5.0.4] - 2026-01-24 - Header Layout Fix & Production Polish ✨

### Fixed

#### Mobile App - Header Component
- **LivingBridgeHeader Layout Issue**
  - Fixed logo and "Welcome back" text overlapping in compact mode
  - Reduced title font size in compact mode from `xxl` to `lg` for better fit
  - Added `justifyContent: 'center'` to brandText for proper vertical alignment
  - Updated brandSection gap from `md` to `sm` in compact mode
  - Now shows subtitle in compact mode with smaller font size (xs)
  - Added horizontal padding to brandSection for better spacing

### Technical
- **Console Warnings**: pointerEvents deprecation is from react-native-web internals (expected, not from our code)
- **Sentry Breadcrumbs**: Normal navigation tracking logs (expected behavior)
- **Version**: Bumped to 5.0.4 for new build
- **TypeScript**: 0 errors
- **Web Bundle**: Successfully compiled (1065 modules in 12.8s)

---

## [5.0.3] - 2026-01-20 - CreateInvoiceScreen i18n & Button Fix 🌍

### Fixed

#### Mobile App
- **AnimatedButton Component**
  - Fixed button visibility issue using `Animated.createAnimatedComponent(Pressable)` pattern
  - Added proper `minHeight: 52` for consistent touch targets
  - Added `buttonDisabled` and `textDisabled` styles for disabled state
  - Ensured `backgroundColor: colors.primary` and `borderColor: colors.primary` for visibility

- **Splash Screen Configuration**
  - Added iOS-specific splash configuration in app.json
  - Added Android-specific splash configuration in app.json
  - Added `expo-splash-screen` plugin with proper config (imageWidth: 200, resizeMode: cover)
  - Installed expo-splash-screen@31.0.13

### Added

#### i18n Improvements
- **CreateInvoiceScreen Full i18n Coverage**
  - Added 30+ new translation keys to en.json and pidgin.json
  - Wizard step labels: `create.stepCustomer`, `create.stepItems`, `create.stepReview`
  - Customer step: `create.customerOptional`, `create.customerInfo`, `create.customerPlaceholder`, `create.tipWalkIn`
  - Items step: `create.backButton`, `create.itemsAdded`, `create.subtotal`, `create.vatLabel`, `create.total`
  - Review step: `create.reviewInvoice`, `create.addItemsToContinue`, `create.reviewTitle`, `create.confirmDetails`
  - Review cards: `create.customerLabel`, `create.walkInCustomer`, `create.itemsLabel`, `create.invoiceTotal`, `create.grandTotal`
  - Compliance: `create.complianceNotice`
  
- **Alert Messages i18n**
  - Added validation error keys: `alerts.validationError`, `alerts.fixErrorsBeforeAdding`
  - Added item validation keys: `alerts.noItems`, `alerts.addItemBeforeProceeding`, `alerts.addItemToInvoice`
  - Added camera/gallery error keys: `alerts.cameraError`, `alerts.cameraErrorDesc`, `alerts.galleryError`, `alerts.galleryErrorDesc`
  - Added OCR error keys: `alerts.ocrProcessingError`, `alerts.ocrProcessingErrorDesc`
  - Added save error keys: `alerts.cleanupFailed`, `alerts.cleanupFailedDesc`, `alerts.saveFailed`
  - Added loading messages: `alerts.analyzingReceipt`, `alerts.savingInvoice`
  - Added OCR result keys: `alerts.detectedAmount`, `alerts.noAmountDetected`, `alerts.confidence`, `alerts.applyDetectedValues`, `alerts.reviewAndAdjust`, `alerts.couldNotAnalyze`

### Technical

- **TypeScript compilation**: 0 errors
- **All i18n keys verified** in both en.json and pidgin.json
- **CreateInvoiceScreen** now fully internationalized

---

## [5.0.2] - 2026-01-16 - UI Polish & Dependency Fixes 🎨

### Added

#### Mobile App
- **Enhanced Onboarding UI**
  - New `heroSection` with branded header and app icon
  - `heroMetaCard` displaying app icon (48x48) with visual appeal
  - `heroMetaChips` showing key features (Offline-first, NRS Compliant)
  - `stepCard` with animated slide-in transitions (SlideInRight)
  - `helperCard` with contextual benefit explanations
  - Updated trust footer with accurate claims

- **BrandedHero Component Enhancement**
  - Added `logoSource` prop for custom logo images
  - Replaced emoji logo with actual app icon (icon.png)
  - Proper `ImageSourcePropType` support

### Fixed

- **Dependency Deduplication**
  - Fixed expo-constants duplicate (18.0.12 vs 18.0.13) via Yarn resolutions
  - Single version (18.0.13) now used across all packages
  - Updated @react-navigation/native to ^7.1.27
  - Updated @react-navigation/native-stack to ^7.9.1

- **Configuration Cleanup**
  - Deduplicated Android permissions in app.json (14 → 5 unique)
  - Added `appVersionSource: "remote"` to eas.json for future EAS compatibility
  - Fixed misleading "Encrypted local storage" → "Local-first storage" claim

### Technical

- **139 tests passing** (100% success rate)
- **TypeScript compilation**: 0 errors
- **Expo SDK compatibility**: Dependencies up to date

---

## [5.0.1] - 2026-01-15 - Production Build & Deployment 🚀

### Added

#### Mobile App
- **Production Build Configuration**
  - Updated app.json with v5.0.0 and versionCode 50000
  - Added camera and photo library permission descriptions for iOS
  - Enhanced Android permissions for network state
  - Configured expo-camera plugin with permission strings
  - Brand color (#0B5FFF) applied to splash and adaptive icon backgrounds

- **Jest Test Fixes**
  - Fixed expo-camera mock with `useCameraPermissions` hook support
  - Fixed react-native-reanimated mock with proper `Animated.View` components
  - Fixed animation preset mocks (`FadeIn.duration()`, etc.)
  - Updated CreateInvoiceScreen tests for wizard-style UI
  - Updated OnboardingSystem tests with `getAllByText` for duplicate elements
  - **139 tests passing** (100% success rate)

- **EAS Build Ready**
  - Configured for preview APK builds
  - Production AAB builds configured for Play Store
  - Staging builds with internal distribution

### Fixed

- Fixed `useCameraPermissions is not a function` test error
- Fixed `FadeIn.duration is not a function` test error
- Fixed placeholder text mismatches in CreateInvoiceScreen tests
- Fixed multiple elements with same text assertions in OnboardingSystem tests

---

## [5.0.0] - 2026-01-14 - Production Launch 🚀

### Added

#### Mobile App
- **Enhanced Onboarding System**
  - Skip All onboarding with confirmation dialog
  - Progress indicators (e.g., "1 of 5")
  - Emoji-enhanced ProfileAssessmentStep
  - Real-time number formatting with comma separators
  - Loading states for async operations
  - React.memo optimization for 6 onboarding components

- **Improved HomeScreen**
  - Stats cards with monthly sales tracking
  - Quick actions panel
  - Compliance tips card
  - Pull-to-refresh support
  - Enhanced visual design with icons

- **Network Status & Sync**
  - Real-time network status monitoring
  - Animated sync indicators
  - "Syncing...", "Offline", "No internet" states
  - Visual feedback for sync operations

- **Translation System**
  - 205+ translation keys (English + Nigerian Pidgin)
  - Full coverage for all UI elements
  - Network status translations
  - Onboarding step indicators
  - Profile hints and descriptions

- **Accessibility**
  - WCAG 2.1 Level AA compliance
  - Proper `accessibilityRole` and `accessibilityState`
  - Screen reader optimized labels
  - Semantic HTML for web

### Changed

#### Mobile App
- **Visual Polish**
  - Migrated from deprecated shadow* props to boxShadow
  - Consistent border radius (12-16px throughout)
  - Improved color contrast ratios
  - Enhanced button states (pressed, disabled, loading)
  - Better spacing and padding scale

- **Performance Optimizations**
  - Added useCallback for event handlers
  - Implemented useMemo for computed values
  - Optimized re-renders with React.memo
  - Reduced unnecessary component updates

- **Number Formatting**
  - ProfileAssessmentStep inputs with auto-formatting
  - Currency display with locale-aware separators
  - Real-time formatting as user types

### Fixed

#### Mobile App
- Fixed shadow style deprecation warnings (4 components)
- Fixed missing translation keys (15+ keys added)
- Fixed number input parsing (comma separator support)
- Fixed network status display logic
- Fixed OfflineBadge layout issues
- Fixed web compatibility issues

### Testing
- ✅ 139 tests passing (100% success rate)
- ✅ 7 test suites (OnboardingSystem, TaxCalculator, MockFIRS, Payment E2E, etc.)
- ✅ 0 TypeScript errors
- ✅ 0 build warnings

---

## [4.0.0] - 2026-01-10 - Tax Onboarding System

### Added

#### Mobile App
- Complete 6-step onboarding flow
  - ProfileAssessmentStep with business type collection
  - PITTutorialStep with interactive calculator and quiz
  - VATCITAwarenessStep with threshold education
  - FIRSDemoStep with mock API simulation
  - GamificationStep with achievement system
  - CommunityStep with referral codes

- Tax Calculators
  - PIT calculator (Nigeria Tax Act 2025, 6-band progressive)
  - VAT threshold calculator (₦100M)
  - CIT rate calculator (0%/20%/30%)

- Gamification
  - 7 unlockable achievements
  - Daily streak tracking
  - Quiz master badge
  - Tax exempt badge

### Changed
- Enhanced OnboardingContext with profile management
- Improved tax calculation accuracy
- Better gating logic for conditional steps

---

## [3.0.0] - 2025-12-15 - Offline Sync & Multi-language

### Added

#### Mobile App
- Offline-first architecture with SQLite
- Automatic sync when online
- Multi-language support (English + Nigerian Pidgin)
- Network status monitoring
- Loading overlays

#### Backend
- Invoice sync endpoints
- Queue management with BullMQ
- Background workers for processing

### Changed
- Migrated from AsyncStorage to SQLite
- Enhanced error handling
- Improved sync logic

---

## [2.0.0] - 2025-11-20 - Backend Integration

### Added

#### Mobile App
- API integration with backend
- Invoice creation and listing
- Settings screen with API URL configuration

#### Backend
- Fastify server setup
- PostgreSQL with Prisma ORM
- Redis caching
- Basic authentication

---

## [1.0.0] - 2025-10-15 - MVP Release

### Added

#### Mobile App
- Basic invoice creation
- Local storage
- Simple UI

#### Documentation
- Initial PRD
- Architecture diagrams
- API specification

---

## Release Notes

### Version 5.0.0 Highlights

**Production-Ready Mobile App:**
- 139 tests, 100% passing
- Full accessibility compliance
- Complete i18n coverage
- Enhanced UX with animations and loading states
- Optimized performance

**User Experience:**
- Skip All onboarding
- Enhanced HomeScreen with stats
- Real-time number formatting
- Visual sync indicators

**Developer Experience:**
- 0 TypeScript errors
- 0 build warnings
- Comprehensive documentation
- Clean codebase

---

## Upgrade Guide

### From 4.x to 5.0

1. **Update dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Run database migrations:**
   ```bash
   # No migrations required for mobile
   ```

3. **Update translations:**
   - Check `src/i18n/en.json` for new keys
   - Add custom translations if needed

4. **Test thoroughly:**
   ```bash
   npm test
   ```

---

## Roadmap

### Version 5.1 (Q1 2026)
- [ ] Push notifications for sync status
- [ ] Biometric authentication
- [ ] Receipt scanning with OCR
- [ ] Bulk invoice import

### Version 6.0 (Q2 2026)
- [ ] DigiTax production integration
- [ ] Remita payment flow
- [ ] Multi-currency support
- [ ] Advanced analytics

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/Scardubu/taxbridge/issues
- Email: support@taxbridge.ng
- Documentation: `/docs/PRD.md`

---

**TaxBridge Team** | Making tax compliance accessible to everyone 🇳🇬
