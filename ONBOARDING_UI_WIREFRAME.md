# TaxBridge Enhanced Onboarding Screen - Visual Layout

```
╔══════════════════════════════════════════════════════════════════╗
║                    📱 TaxBridge Onboarding                       ║
╚══════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  🟢 Sync Ready                                             │   │
│ │                                                            │   │
│ │              ┌─────────────────┐                           │   │
│ │              │   🌉 TaxBridge   │ ← App Icon (40x40)       │   │
│ │              │  (pulsing logo)  │                          │   │
│ │              └─────────────────┘                           │   │
│ │                                                            │   │
│ │                  TaxBridge                                 │   │
│ │    Simplify Your Taxes, Bridge Your Future                │   │
│ │                                                            │   │
│ │  ████████████████░░░░░░░░░░░░░░░░ 40% Complete            │   │
│ │                                                            │   │
│ │  🔒 NDPR Safe  ✓ NRS Ready  📵 Works Offline              │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ ┌──────┐  Built for Nigerian SMEs          ┌──────────┐   │   │
│ │ │ 🌉   │  Finish onboarding offline in     │   30s    │   │   │
│ │ │ Icon │  under 2 minutes and stay NRS     │ Avg setup│   │   │
│ │ │48x48 │  compliant.                       └──────────┘   │   │
│ │ └──────┘                                                   │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  🌍 English + Pidgin  🔄 Offline Sync  🛡️ NDPR Secure          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  1 of 6                              💾 Save    Skip All →      │
│  Profile Assessment                                              │
├──────────────────────────────────────────────────────────────────┤
│  ● ○ ○ ○ ○ ○  ← Step Progress Dots                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │                    📊 Step Content                         │   │
│ │                                                            │   │
│ │  [Profile Assessment Form]                                 │   │
│ │  • Business Type Selector                                  │   │
│ │  • Annual Income Input (with formatting)                   │   │
│ │  • Tax Goals Selection                                     │   │
│ │                                                            │   │
│ │                   ┌──────────────┐                         │   │
│ │                   │   Next →     │                         │   │
│ │                   └──────────────┘                         │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  💡 Why complete onboarding?                               │   │
│ │                                                            │   │
│ │  Unlock guided PIT/VAT/CIT calculators, DigiTax-ready     │   │
│ │  invoice templates, and save offline drafts that sync     │   │
│ │  once you are online.                                      │   │
│ │                                                            │   │
│ │  ✅ Compliance tips  🤝 WhatsApp support  📈 SME insights  │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ 💾 Local-first, syncs when online   📵 Works without internet   │
└──────────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════╗
║                     Component Breakdown                          ║
╚══════════════════════════════════════════════════════════════════╝

1. BrandedHero (Compact Variant)
   ├── Gradient background (#052B52 → #0B5FFF)
   ├── Network status badge (green/amber)
   ├── App icon with pulse animation
   ├── Brand title + tagline
   ├── Progress bar (animated)
   └── Trust badges (3)

2. Hero Meta Card
   ├── Left section:
   │   ├── App icon (48x48 rounded)
   │   └── Descriptive copy (2 lines)
   ├── Right section:
   │   └── Setup time badge (purple)
   └── White background with subtle shadow

3. Feature Chips (Horizontal Scroll)
   ├── 🌍 English + Pidgin
   ├── 🔄 Offline Sync
   └── 🛡️ NDPR Secure

4. Header Actions Bar
   ├── Step indicator: "1 of 6"
   ├── Step name: "Profile Assessment"
   ├── 💾 Save button (blue pill)
   └── Skip All button (amber pill)

5. Step Progress Dots
   └── 6 dots (filled/active/empty states)

6. Animated Step Card
   ├── White rounded container (24px radius)
   ├── Elevated shadow (4dp)
   ├── SlideInRight animation
   └── Dynamic step content

7. Helper Card
   ├── Blue background (#0B5FFF)
   ├── White text
   ├── Benefits explanation
   └── 3 feature pills with semi-transparent bg

8. Trust Footer
   ├── 💾 Local-first messaging
   └── 📵 Offline capability
```

---

## Color Palette

```
Primary Blue:     #0B5FFF
Secondary Blue:   #052B52
Success Green:    #10B981
Warning Amber:    #F59E0B
Background Gray:  #F8FAFC
Text Primary:     #0F172A
Text Secondary:   #475467
Border Gray:      #E4E7EC
```

---

## Typography

```
Hero Title:       28px / 900 weight / 1px letter-spacing
Section Title:    16px / 800 weight / 0.5px letter-spacing
Body Text:        14px / 500 weight
Small Text:       12px / 600 weight
Monospace:        11px / 'monospace'
```

---

## Spacing Scale

```
Tiny:     4px
Small:    8px
Medium:   12px
Large:    16px
XLarge:   20px
XXLarge:  24px
Huge:     32px
```

---

## Border Radius

```
Small:    12px (buttons, badges)
Medium:   16px (cards, images)
Large:    20px (hero sections)
XLarge:   24px (main containers)
Circle:   50% (avatars, logos)
```

---

## Shadows & Elevation

```
Low (2dp):
  shadowColor: #0F172A
  shadowOpacity: 0.05
  shadowOffset: { width: 0, height: 2 }
  shadowRadius: 4
  elevation: 2

Medium (4dp):
  shadowColor: #0F172A
  shadowOpacity: 0.06
  shadowOffset: { width: 0, height: 10 }
  shadowRadius: 24
  elevation: 4

High (8dp):
  shadowColor: #0F172A
  shadowOpacity: 0.1
  shadowOffset: { width: 0, height: 16 }
  shadowRadius: 32
  elevation: 8
```

---

## Animations

```
FadeIn:
  duration: 300ms
  easing: ease-in-out

SlideInRight:
  springify()
  damping: 18
  stiffness: 140

Pulse (Logo):
  scale: 1 → 1.05 → 1
  duration: 1500ms
  repeat: infinite

Progress Bar:
  withSpring()
  damping: 15
  stiffness: 100
```

---

## Accessibility

```
Touch Targets:     ≥ 48x48 dp
Text Contrast:     WCAG AA (4.5:1 minimum)
Focus Indicators:  2px solid outline
Screen Reader:     All icons have labels
Keyboard Nav:      Tab order logical
```

---

## Responsive Breakpoints

```
Phone Portrait:    < 375px width
Phone Landscape:   375px - 768px
Tablet Portrait:   768px - 1024px
Tablet Landscape:  > 1024px
```

---

*Last Updated: January 15, 2026*
