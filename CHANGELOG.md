# Changelog

All notable changes to TaxBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **137 tests passing** (100% success rate)
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
  - **137 tests passing** (100% success rate)

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
- ✅ 136 tests passing (100% success rate)
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
- 136 tests, 100% passing
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
