# MODULE M08 — DASHBOARD UX & VISUAL PATTERNS
## TaxBridge AI Operating Context
**Module:** M08 | **Version:** 1.0 | **Last updated:** 2026-02-22
**Token budget:** ~800 tokens | **Inject for:** Dashboard work, UX improvements, visual QA
**Depends on:** M00, M02

---

## PURPOSE
Authoritative UX decisions derived from the V10 audit of TaxBridge dashboard UI
mockups (dark theme Image 1 + light theme Image 2). Establishes component hierarchy,
information architecture, visual standards, and interaction patterns for all screens
but especially the home dashboard.

## SCOPE
`DashboardScreen.tsx`, `TaxHealthGauge`, `TopAnomaliesSection`, `ComplianceCalendar`,
`QuickActions`, `OfflineSyncStatus`, and all status indicators across the app.

---

## DASHBOARD INFORMATION HIERARCHY

```
LEVEL 1 — Primary (above fold, 60% of initial viewport):
  TaxHealthGauge (SVG arc, centered or top-right)
  Greeting + name (top-left)
  → User knows their health status before scrolling

LEVEL 2 — Secondary (first scroll; urgent items):
  VAT Liability card (if vatLiability > 0) — most urgent financial fact
  Next Deadline (if daysRemaining ≤ 14)
  Top Anomalies section (if any anomaly severity ≥ medium)
  → User sees actionable urgency before anything else

LEVEL 3 — Tertiary (accessible, not screaming):
  Quick Actions grid (6 context-sorted items)
  Compliance Calendar (multi-deadline list)
  Trend Sparklines (health + revenue)
  Offline Sync Status card
  Recent Activity feed
  → User explores when they have time

RULE: Never render a LEVEL 3 element above a LEVEL 2 element with urgent status.
Implement as: sort sections by urgency before rendering, not static order.
```

---

## INFORMATION DESIGN PRINCIPLES

### Tax Health Score — Story Over Number
```
Score band → Status label → One-sentence insight with next action:

90–100: "Excellent 🏆 — Your record is audit-ready."
75–89:  "Good ✓ — File [next_due_type] by [date] to stay green."
50–74:  "Fair ⚠️ — [top_issue] is pulling your score down."
0–49:   "At Risk 🚨 — Immediate action: [specific_issue]."

All text is dynamic — computed from dashboard data, never static.
The one-sentence insight replaces the generic "health hint" in the current code.
```

### Anomaly Cards — Consequence First
```
Pattern: CONSEQUENCE → EVIDENCE → ACTION

✅ Good:
  [🔴] "Possible ₦9,023 overstatement — matches Invoice #8211"
       [Review]  [Dismiss]

❌ Bad:
  [!] "duplicate_amount detected — ₦120,300"

Key rules:
  - Show ₦ impact of the anomaly, not just the amount involved
  - Route CTA directly to the affected record (pre-filtered)
  - Allow Dismiss with reason — anomaly shouldn't reappear without resolution
  - Use anomalyReason_pidgin when user language is Pidgin
  - Severity must show: color + emoji shape + text label (C-15)
```

### NRS Status — Trust Signal, Not System Status
```
Pattern: User-outcome language, not engineering language.

All stamped:       "🟢 All invoices compliant" (tap → invoice list)
Some pending:      "⏳ 3 awaiting NRS stamp" (tap → PENDING_NRS filtered list)
Circuit open:      "⚙️ NRS stamping paused — your invoices are safe"
                    (never "System down" — users panic)
Failed > 0:        "⚠️ 2 need attention" (tap → retry UI)
```

### Offline Banner — Reassurance Over Alert
```
Pattern: Minimize anxiety; maximize trust.

While offline with cached data: show NOTHING (data appears fresh)
Wait 500ms before showing any offline indicator.

When user attempts network action: "📴 No internet — we'll send this when you're back"
On reconnect flush: "🔄 Syncing 3 items..." → "✅ All synced" (auto-dismiss 2s)

Never show: "Cached Data" (implies stale/untrustworthy)
Never show immediately on mount (forces users to see the warning even with full cache)
```

---

## COMPONENT SPECIFICATIONS

### TaxHealthGauge (Replaces ProgressBar — C-13)
```
Arc:      230° sweep (−140° to +140° from top-center)
Stroke:   12px, rounded linecap
Color zones:
  0–49:  #EF4444 (red)
  50–74: #F59E0B (amber)
  75–89: #84CC16 (lime)
  90–100:#10B981 (green)
Animation: Reanimated withTiming 800ms, ease-in-out
  Always animate from 0 → score on mount (even if score hasn't changed)
  Gives the impression of "loading your result" which users find satisfying
Size:
  Standard:  200px (≥ 361px wide screens)
  Compact:   160px (< 360px wide — Tecno Spark, budget Androoids)
  Micro:     80px (ProfileScreen compact version)
Required:
  accessibilityLabel="Tax health score: {score} out of 100. Status: {label}."
  accessibilityRole="image"
```

### TopAnomaliesSection
```
Show: Only when topAnomalies.length > 0
Max:  3 anomaly rows (all severity ≥ medium — low anomalies never shown on dashboard)
Header: "Top Anomalies" + "View All ›" link → /anomalies
Each row:
  Height:    ≥ 64px (good touch target + readability)
  Left:      Severity badge (color + emoji + text — C-15)
  Center:    Consequence text + amount + date
  Right:     CTA button (Review / Compare / Dismiss)
  Expanded:  Tap row to expand → show suggestedAction in full
Pidgin:      Use anomalyReason_pidgin when language === 'pidgin'
Empty:       Do not render section (not even empty state)
```

### ComplianceCalendar
```
Source:    data.upcomingDeadlines from composite endpoint
Modes:
  List (default):
    4 upcoming deadlines as color-coded rows
    🔴 ≤ 3 days remaining (urgent, red bg)
    🟡 4–14 days remaining (warning, amber bg)
    🟢 > 14 days remaining (planning, green bg)
    Each row: type + due date + daysRemaining + "File Now" or "Plan Ahead"
  
  Week strip (expansion):
    7-day horizontal scroll
    Each day cell: date number + "DUE" badge if deadline falls on that day
    Tap DUE cell → deadline detail modal

Date formatting: Nigerian format = "25 Feb" not "Feb 25" or "2/25"
Pidgin deadline types:
  "VAT Filing Due"  → "Time to pay VAT"
  "PAYE Due"        → "PAYE for your workers"
  "WHT Due"         → "Withholding Tax time"
```

### QuickActions Grid (Context-Sorted)
```
Layout:   3 columns × 2 rows (6 actions always shown)
Each:     Icon background circle (accentColor + 18 opacity) + emoji + label
          Width: ~31% | Height: auto (aligned to tallest in row)
          Touch target: full cell (≥ 44px tall)
Sorting:  computeQuickActions(data) — see M02 / quickActions.ts
          Never static — always context-driven

New user (0 invoices):      Invoice, Scan, Calculator, Pay, Expenses, Learn
Has pending NRS:            Submit NRS, Invoice, Scan, Calculator, Expenses, Learn
VAT due ≤ 7 days:           File VAT, Invoice, Scan, Calculator, Pay, Learn
Has ≥ 1 high anomaly:       Review Alerts, Invoice, Scan, File VAT, Calculator, Learn
Default:                    Invoice, Scan, File Tax, Pay, Expenses, Learn
```

### OfflineSyncStatus Card
```
Position:  Last card in dashboard scroll (tertiary level)
Show:      Always (not just when offline) — makes offline capability visible
Content:
  Online + synced:    "🔄 Last sync: {relativeTime} · All data synced ✓"
  Online + syncing:   "🔄 Syncing {queueDepth} items..."
  Offline + queued:   "📴 Offline · {queueDepth} items will sync when connected"
  Offline + empty:    "📴 Offline · All data saved locally"
Pidgin:
  synced:   "Everything sync — {relativeTime} wey pass"
  offline:  "No network — {n} things go sync when you get network"
```

### SparkLine Charts (Trend Section)
```
Render only when: ≥ 3 data points available (TaxHealthSnapshot)
If < 3 points: show "Not enough data yet" placeholder (styled, not EmptyState)
Two charts, side by side (50% width each):

Compliance Trend (line chart):
  Data:   last 7 TaxHealthSnapshot.score values
  Color:  Primary green → red based on latest score
  Label:  "Compliance Trend"
  X-axis: None (sparkline — no labels)

Revenue This Month (bar chart):
  Data:   daily invoice totals (PAID status) for current month
  Color:  primary[400]
  Label:  "Revenue This Month"
  Format: Abbreviate: ₦50k not ₦50,000

Implementation: Pure react-native-svg path/rect — no chart library needed.
Height: 60px | Width: (screenWidth - 2*padding)/2 - gap
```

---

## VISUAL QUALITY STANDARDS

### Spacing
```
Screen horizontal padding: 16px (screenPadding from tokens)
Card internal padding:     16px vertical, 16px horizontal
Gap between cards:         12px (spacing[3])
Gap between sections:      24px (spacing[6])
Minimum tap target:        44px × 44px (WCAG 2.1 AA)
```

### Card Elevation
```
Use shadows.md for health score card (primary hero element)
Use shadows.sm for metric cards and secondary content
Use shadows.xs for quick action buttons and tertiary items
Never use drop-shadow on text (readability on AMOLED)
```

### Typography Scale for Nigerian Screens
```
Health score number:  font-size 48sp, font-weight 800 (high recognition, far viewing distance)
Section headers:      font-size 16sp, font-weight 700
Card labels:          font-size 12sp, font-weight 600, UPPERCASE, letter-spacing 0.5
Card values:          font-size 20sp, font-weight 700
Body text:            font-size 14sp, font-weight 400
Caption/hint:         font-size 11sp, font-weight 500
Naira amounts:        Inter (monospace digits), always with ₦ prefix and thousand separators
```

### Dark Mode Color Mapping
```
Light surface (#FFFFFF)    → Dark surface (#1E293B)
Light bg (#F9FAFB)         → Dark bg (#0F172A)
Light border (#E5E7EB)     → Dark border (#334155)
Light text primary (#111827) → Dark text (#F8FAFC)
Light text muted (#6B7280)  → Dark text muted (#94A3B8)
Brand green (primary[500])  → Same (#10B981) — brand color doesn't change in dark mode
Amber accent — Same in both modes (high saturation reads well on dark)
StatusBar: dark-content on light | light-content on dark (auto via useTheme)
```

---

## ACCESSIBILITY CHECKLIST

Before marking any screen as complete:
```
□ All interactive elements: minHeight: 44, minWidth: 44
□ All Pressable: accessibilityRole + accessibilityLabel
□ TaxHealthGauge: accessibilityLabel set with score + status
□ Status indicators: color + emoji shape + text label (3 channels — C-15)
□ Charts: accessibilityLabel on SVG element describing trend
□ VoiceOver/TalkBack: test reading order matches visual order
□ Color contrast: text on all background colors ≥ 4.5:1 (WCAG AA)
□ Error messages: accessible and describe how to fix, not just what failed
□ Loading states: accessibilityLabel="Loading dashboard data"
□ No information conveyed by position alone (left/right)
```

---

## INPUTS / OUTPUTS

```
Inputs:  data from useDashboard() composite hook; useTheme() colors; useTranslation()
Outputs: Correctly structured DashboardScreen with proper information hierarchy,
         all visual components meeting quality standards, all accessibility gates passed.
```

## DEPENDENCIES

```
M00 — Constraints C-13, C-14, C-15 govern this entire module
M02 — Component library, design tokens, navigation patterns
M05 — Tax calculation outputs that feed health score and anomaly detection
```

---

## V10.3 IMPLEMENTATION STATUS (2026-02-CURRENT)

### Components — COMPLETE ✅
| Component | File | Status |
|-----------|------|--------|
| `TaxHealthGauge` | `@components/TaxHealthGauge` | ✅ SVG arc, mode prop, C-13 |
| `DashboardZone` | `@components/dashboard/DashboardZone` | ✅ 5 zones |
| `DashboardSkeleton` | `@components/dashboard/DashboardSkeleton` | ✅ ER-08 |
| `SectionState` | `@components/dashboard/SectionState` | ✅ ER-09 |
| `TopAnomaliesSection` | `@components/dashboard/TopAnomaliesSection` | ✅ CF-02, CF-15 |
| `ComplianceCalendar` | `@components/dashboard/ComplianceCalendar` | ✅ CF-06 |
| `OfflineSyncStatus` | `@components/dashboard/OfflineSyncStatus` | ✅ P1-F |

### Utilities — COMPLETE ✅
| Util | File | Status |
|------|------|--------|
| `computeQuickActions` | `@utils/computeQuickActions` | ✅ P1-E, context-sorted |
| Animation tokens | `@utils/animation` | ✅ ER-10 |

### DashboardScreen — COMPLETE ✅
C-13 SVG gauge · C-14 composite hook · C-15 color+shape+text · CF-04 useTheme
CF-06 multi-deadline · CF-07 NRS Pidgin text · CF-08 zone choreography
P1-A TopAnomaliesSection · P1-D ComplianceCalendar · P1-E computeQuickActions
P1-F OfflineSyncStatus · BUG-S02 NRSt resolved · BUG-S03 initImmediate:false

### Backend — COMPLETE ✅
`GET /api/v1/insights/trends?days=N` — queries TaxHealthSnapshot, 5-min Redis cache

### Remaining for M09 ⏳
- Trend sparkline chart in AMBIENT zone (chart lib TBD)
- M09-F3: Wire AMBIENT zone using `/insights/trends`
