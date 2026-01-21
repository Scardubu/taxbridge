# TaxBridge Branding Assets — Integration Guide

**Version:** 5.0.3  
**Date:** January 21, 2026  
**Status:** ✅ Production Ready

---

## 📁 Asset Directory Structure

```
taxbridge/
├── assets/                           # ✅ Root branding assets (corrected directory name)
│   ├── logo-full.png                # Full horizontal logo (README, docs, marketing)
│   ├── logo-small.png               # Compact logo (mobile headers, emails)
│   └── og-image.png                 # Open Graph / social preview (1200×630px)
│
├── mobile/assets/
│   ├── adaptive-icon.png            # Android adaptive icon (foreground)
│   ├── icon.png                     # Primary app icon (1024×1024px)
│   ├── icon-android.png             # Android launcher icon
│   ├── icon-ios.png                 # iOS App Store & device icon
│   ├── icon-square.png              # Square variant (Play Store listing)
│   ├── splash-icon.png              # Mobile splash screen logo
│   └── favicon.png                  # Web fallback (Expo)
│
└── admin-dashboard/public/
    ├── favicon.ico                  # Web browser tab icon (multi-size)
    ├── apple-touch-icon.png         # iOS home screen icon (180×180px)
    ├── icon-192.png                 # PWA icon (192×192px) ✅ CREATED
    ├── icon-512.png                 # PWA icon (512×512px) ✅ CREATED
    ├── og-image.png                 # Admin-specific OG image ✅ CREATED
    └── manifest.json                # PWA manifest ✅ CREATED
```

---

## 🎨 Brand Color System (Cross-Platform)

### Primary Brand Colors

| Token             | Hex Code  | Usage                                    |
| ----------------- | --------- | ---------------------------------------- |
| `primary`         | `#0B5FFF` | Primary brand blue (buttons, links, CTA) |
| `primaryDark`     | `#0952CC` | Hover states, active elements            |
| `primaryDeep`     | `#052B52` | Deep accents, dark mode                  |
| `primaryLight`    | `#EBF4FF` | Backgrounds, subtle highlights           |
| `backgroundColor` | `#0B5FFF` | Splash screens, adaptive icons           |

**Consistency Rule:** All surfaces (mobile, admin, docs) MUST use `#0B5FFF` as the primary brand color.

---

## 📱 Mobile App Integration (Expo/React Native)

### Current Configuration (`mobile/app.json`)

```json
{
  "expo": {
    "name": "TaxBridge",
    "icon": "./assets/icon.png",
    "primaryColor": "#0B5FFF",
    "description": "Nigeria's first offline-first, NRS-compliant e-invoicing platform...",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0B5FFF"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0B5FFF"
      }
    },
    "ios": {
      "bundleIdentifier": "ng.taxbridge.app"
    }
  }
}
```

### Asset Requirements

| Asset                 | Size        | Format | Purpose                            |
| --------------------- | ----------- | ------ | ---------------------------------- |
| `icon.png`            | 1024×1024px | PNG    | Primary app icon (all platforms)   |
| `adaptive-icon.png`   | 1024×1024px | PNG    | Android adaptive icon (foreground) |
| `splash-icon.png`     | 1284×2778px | PNG    | Launch screen logo                 |
| `icon-ios.png`        | 1024×1024px | PNG    | iOS-specific icon                  |
| `icon-android.png`    | 1024×1024px | PNG    | Android-specific icon              |

**Validation Checklist:**
- ✅ All icons exist in `mobile/assets/`
- ✅ `icon.png` is referenced in `app.json` → `expo.icon`
- ✅ `adaptive-icon.png` is referenced in `app.json` → `expo.android.adaptiveIcon.foregroundImage`
- ✅ `splash-icon.png` is referenced in `app.json` → `expo.splash.image`
- ✅ Background color `#0B5FFF` is consistent across splash and adaptive icon

---

## 🖥️ Admin Dashboard Integration (Next.js)

### Current Configuration (`admin-dashboard/app/layout.tsx`)

```typescript
export const metadata: Metadata = {
  title: {
    default: "TaxBridge Admin Dashboard",
    template: "%s | TaxBridge Admin",
  },
  description: "Comprehensive admin dashboard for TaxBridge operations...",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://taxbridge.vercel.app",
    title: "TaxBridge Admin Dashboard",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TaxBridge Admin Dashboard",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  metadataBase: new URL("https://taxbridge.vercel.app"),
};
```

### Asset Requirements

| Asset                  | Size        | Format | Purpose                            |
| ---------------------- | ----------- | ------ | ---------------------------------- |
| `favicon.ico`          | Multi-size  | ICO    | Browser tab icon                   |
| `apple-touch-icon.png` | 180×180px   | PNG    | iOS home screen icon               |
| `icon-192.png`         | 192×192px   | PNG    | PWA icon (small)                   |
| `icon-512.png`         | 512×512px   | PNG    | PWA icon (large)                   |
| `og-image.png`         | 1200×630px  | PNG    | Open Graph / social preview        |
| `manifest.json`        | N/A         | JSON   | PWA manifest (metadata)            |

**Validation Checklist:**
- ✅ `favicon.ico` exists in `admin-dashboard/public/`
- ✅ `apple-touch-icon.png` exists in `admin-dashboard/public/`
- ✅ `icon-192.png` (192×192px) exists in `admin-dashboard/public/`
- ✅ `icon-512.png` (512×512px) exists in `admin-dashboard/public/`
- ✅ `og-image.png` (1200×630px) exists in `admin-dashboard/public/`
- ✅ `manifest.json` created with correct icon references
- ✅ Metadata in `app/layout.tsx` references all assets

---

## 📄 Shared Assets (Root `/assets/`)

### Current Assets

| Asset            | Size        | Purpose                               |
| ---------------- | ----------- | ------------------------------------- |
| `logo-full.png`  | Variable    | Full horizontal logo (README, docs)   |
| `logo-small.png` | Variable    | Compact logo (mobile headers, emails) |
| `og-image.png`   | 1200×630px  | Shared Open Graph preview             |

### Usage Guidelines

**`logo-full.png` — Full Horizontal Logo**
- Used in: README.md, documentation headers, marketing materials, email templates
- Recommended size: 2000×500px (4:1 aspect ratio)
- Background: Transparent PNG
- Placement: Centered, with 40px vertical padding

**`logo-small.png` — Compact Logo**
- Used in: Mobile app headers, email signatures, compact UI spaces
- Recommended size: 256×256px (1:1 aspect ratio)
- Background: Transparent PNG
- Placement: Left-aligned, 16px margin

**`og-image.png` — Open Graph Preview**
- Used in: Social media link previews (Twitter, LinkedIn, Facebook)
- Required size: 1200×630px (1.91:1 aspect ratio)
- Background: Brand gradient or solid `#0B5FFF`
- Text: "TaxBridge — Nigeria's Offline-First Tax Platform"

---

## 🔄 Cross-Surface Parity Enforcement

### Design Token Alignment

All surfaces (mobile, admin, docs) MUST use the same design tokens:

```typescript
// mobile/src/theme/tokens.ts
export const colors = {
  primary: '#0B5FFF',           // ✅ CORRECT
  primaryDark: '#0952CC',       // ✅ CORRECT
  primaryLight: '#EBF4FF',      // ✅ CORRECT
  // ... (rest of tokens)
};
```

```css
/* admin-dashboard/app/globals.css */
:root {
  --primary: #0b5fff;           /* ✅ CORRECT */
  --primary-dark: #0952cc;      /* ✅ CORRECT */
  --primary-light: #ebf4ff;     /* ✅ CORRECT */
  /* ... (rest of tokens) */
}
```

### Visual Hierarchy Rules

1. **Primary Actions:** `colors.primary` (`#0B5FFF`) background, white text
2. **Secondary Actions:** `colors.primaryLight` (`#EBF4FF`) background, `colors.primary` text
3. **Destructive Actions:** `colors.error` (`#DC2626`) background, white text
4. **Disabled Actions:** `colors.disabled` (`#98A2B7`) background, muted text

### Typography Scale

| Level  | Mobile (React Native) | Admin (Tailwind)        | Usage                   |
| ------ | --------------------- | ----------------------- | ----------------------- |
| `xs`   | 12px                  | `text-xs` (12px)        | Captions, helper text   |
| `sm`   | 14px                  | `text-sm` (14px)        | Body text, labels       |
| `md`   | 16px                  | `text-base` (16px)      | Default body            |
| `lg`   | 18px                  | `text-lg` (18px)        | Subheadings             |
| `xl`   | 20px                  | `text-xl` (20px)        | Headings                |
| `xxl`  | 26px                  | `text-2xl` (24px)       | Page titles             |
| `xxxl` | 32px                  | `text-4xl` (36px)       | Hero text               |

---

## ✅ Resolved Issues

### Assets Created (Completed)

1. **Admin Dashboard PWA Icons** ✅
   - `admin-dashboard/public/icon-192.png` (192×192px) — CREATED
   - `admin-dashboard/public/icon-512.png` (512×512px) — CREATED

2. **Admin Dashboard Open Graph Image** ✅
   - `admin-dashboard/public/og-image.png` (1200×630px) — CREATED

3. **Directory Name Corrected** ✅
   - Root directory renamed from `assests/` → `assets/`
   - All references updated to use correct path

### Inline Style Violations (Mobile) ✅

**SettingsScreen Refactored:** All inline color styles replaced with design tokens.

```tsx
// ✅ REFACTORED (design token)
import { colors } from '../theme/tokens';
<Text style={[styles.statValue, styles.statValueSuccess]}>{storageStats.synced}</Text>
// Uses: colors.success (#10B981) from tokens.ts
```

**Completed Refactors:**
- `mobile/src/screens/SettingsScreen.tsx` — 6 inline style violations eliminated
- See `DESIGN_SYSTEM_REFACTOR_REPORT.md` for full details

**Remaining Work (Post-Stage 1):**
- `mobile/src/screens/PaymentScreen.tsx` — 8 inline style violations
- `mobile/src/screens/OnboardingScreen.tsx` — 12 inline style violations

---

## 🚀 Deployment Checklist

### Pre-Deployment Validation

- [x] All mobile assets exist in `mobile/assets/`
- [x] `app.json` references correct asset paths
- [x] Admin dashboard has `favicon.ico` and `apple-touch-icon.png`
- [x] `manifest.json` created with PWA metadata
- [x] Generate `icon-192.png` and `icon-512.png` for admin dashboard ✅
- [x] Copy or create `og-image.png` for admin dashboard ✅
- [x] Directory name corrected (`assests/` → `assets/`) ✅
- [x] SettingsScreen design token refactor complete ✅
- [ ] Verify Open Graph previews work on Twitter/LinkedIn
- [ ] Run visual regression tests on mobile (small/large Android, iOS)
- [ ] Verify admin dashboard favicons display correctly in all browsers

### Post-Deployment Monitoring

- [ ] Monitor for broken image links in production logs
- [ ] Verify social media previews render correctly
- [ ] Check PWA installability on mobile browsers
- [ ] Validate apple-touch-icon displays on iOS home screen

---

## 📚 References

- **Mobile App Config:** [mobile/app.json](../mobile/app.json)
- **Admin Layout:** [admin-dashboard/app/layout.tsx](../admin-dashboard/app/layout.tsx)
- **Design Tokens:** [mobile/src/theme/tokens.ts](../mobile/src/theme/tokens.ts)
- **Tailwind Config:** [admin-dashboard/tailwind.config.ts](../admin-dashboard/tailwind.config.ts)
- **PWA Manifest:** [admin-dashboard/public/manifest.json](../admin-dashboard/public/manifest.json)

---

**Last Updated:** January 21, 2026  
**Next Review:** Before Stage 2 beta (1,000 users)
