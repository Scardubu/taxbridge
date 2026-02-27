# MODULE M02 — MOBILE UX / UI (Expo + React Native)
## TaxBridge AI Operating Context
**Module:** M02 | **Version:** 2.0 | **Last updated:** 2026-02-22
**Token budget:** ~1,200 tokens | **Inject for:** Mobile screens, navigation, UX
**Depends on:** M00 (always)
**Primary references:** Expo SDK 54 docs, React Native 0.81.5, WCAG 2.1 AA

---

## PURPOSE
Reference for all React Native / Expo engineering: screen architecture, design system
usage, offline patterns, i18n, theming, accessibility, and confirmed bugs.

## SCOPE
`mobile/` directory. Expo SDK 54, React Native 0.81.5, TypeScript 5.9.

---

## CONFIRMED BUGS — FIX BEFORE ANY FEATURE WORK

```
BUG-S01  Bottom nav □ squares on offline launch
         Fix: npx expo install @expo-google-fonts/inter
              Update _layout.tsx: const [fontsLoaded] = useFonts({...InterFonts})
              SplashScreen.preventAutoHideAsync() until fontsLoaded === true
              Fallback: graceful system font if loading fails (try/catch)

BUG-S02  Invoice modal shows "NRSt Invoice"
         Fix: grep -rn "NRSt" mobile/src/i18n/ → fix all occurrences to "NRS"
         CI gate: grep "NRSt" .github/workflows/ci.yml → fail if found

BUG-S03  Raw i18n keys on offline cold start (COMMON.OFFLINE, onboarding.*)
         Fix: In mobile/src/i18n/index.ts:
              { initImmediate: false, resources: { en, pidgin } }
              Import translations: import en from './en.json' (not loadPath)

BUG-S04  Offline badge shows "COMMON.OFFLINE" key text
         Fix: Add to en.json: "common": { "offlineMode": "Offline Mode" }
              Add to pidgin.json: "common": { "offlineMode": "You no get network" }

CF-13    TaxHealthCard uses ProgressBar — violates C-13
         Fix: Replace with TaxHealthGauge SVG (see GAUGE COMPONENT below)

CF-14    Dashboard makes 3 separate API calls — violates C-14
         Fix: Replace useDashboardStats()+useTaxForecast()+useNrsHealth()
              with single useDashboard() composite hook

CF-04    Dark mode tokens exist but ThemeContext not implemented
         Fix: See THEME SYSTEM below

CF-15    Status indicators: color only — violates C-15 (WCAG CVD)
         Fix: All severity indicators must combine color + shape icon + text label
```

---

## NAVIGATION STRUCTURE

```
mobile/app/
├─ _layout.tsx           Root: ThemeProvider → QueryClientProvider → fonts → i18n → auth guard
├─ onboarding.tsx        6-step: Language → PIT demo → VAT → NRS stamp → Permissions → First Scan
├─ auth/
│   ├─ login.tsx
│   └─ register.tsx
└─ (tabs)/
    ├─ _layout.tsx       5-tab navigator with NRS pending badge from useDashboard()
    ├─ index.tsx         → DashboardScreen
    ├─ invoices.tsx      → InvoicesScreen
    ├─ expenses.tsx      → ExpensesScreen
    ├─ tools.tsx         → TaxToolsScreen (6 calculators + compliance calendar)
    └─ profile.tsx       → ProfileScreen

Additional screens (modal/stack — not tab):
  /invoices/create       CreateInvoiceScreen (3-step wizard)
  /scan                  ScanReceiptScreen
  /filing/vat            VATFilingWizard
  /filing/pit            PITFilingWizard
  /filing/paye           PAYEFilingWizard
  /anomalies             AnomalyDetailScreen
  /payment               PaymentScreen
```

---

## DESIGN SYSTEM USAGE

### Importing (always via useTheme, never direct)
```typescript
// ✅ Correct — theme-aware
import { useTheme } from '../contexts/ThemeContext';
const { colors, isDark } = useTheme();
<View style={{ backgroundColor: colors.surface }}>

// ❌ Wrong — breaks dark mode
import { colors } from '../design-system/tokens';
<View style={{ backgroundColor: '#FFFFFF' }}>
```

### Component Library (mobile/src/design-system/components.tsx)
```
Button          — 6 variants (primary/secondary/ghost/danger/success/outline), 4 sizes
                  haptic feedback built in; animated scale on press
Card            — 4 variants (elevated/outlined/warning/error); use for all content blocks
Badge           — success/warning/error/info; size sm/md
NairaInput      — currency input with ₦ prefix; returns (rawNumber, formatted)
                  use for ALL monetary inputs — never plain TextInput for money
EmptyState      — emoji + title + body + optional action; MANDATORY for empty list states
ProgressBar     — general progress only; DO NOT use for Tax Health Score (C-13)
TrustBadge      — encrypted/nrs_stamped/verified; show on invoice and health cards
Skeleton        — use during loading; never show raw ActivityIndicator
SkeletonCard    — full card skeleton placeholder
```

---

## TAX HEALTH GAUGE (C-13 — SVG Arc Required)

```typescript
// mobile/src/components/TaxHealthGauge.tsx
// react-native-svg is bundled with Expo SDK 54 — no extra install needed

import Svg, { Path, Text as SvgText } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps } from 'react-native-reanimated';
import { useEffect } from 'react';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface TaxHealthGaugeProps {
  score:      number;    // 0–100
  size?:      number;    // default 200; use 160 for 320px-wide screens
  trend?:     number[];  // optional last-7-scores for sparkline
}

function scoreToColor(s: number) {
  return s >= 90 ? '#10B981' : s >= 75 ? '#84CC16' : s >= 50 ? '#F59E0B' : '#EF4444';
}

function scoreToLabel(s: number) {
  return s >= 90 ? 'Excellent 🏆' : s >= 75 ? 'Good ✓' : s >= 50 ? 'Fair ⚠️' : 'At Risk 🚨';
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s   = polarToCartesian(cx, cy, r, end);
  const e   = polarToCartesian(cx, cy, r, start);
  const big = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${big} 0 ${e.x} ${e.y}`;
}

export function TaxHealthGauge({ score, size = 200 }: TaxHealthGaugeProps) {
  const progress = useSharedValue(0);
  const cx = size / 2, cy = size * 0.58, r = size * 0.38;
  const START = -140, SWEEP = 280;

  useEffect(() => { progress.value = withTiming(score / 100, { duration: 800 }); }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    d: describeArc(cx, cy, r, START, START + SWEEP * progress.value),
  }));

  const color = scoreToColor(score);
  const label = scoreToLabel(score);

  return (
    <Svg
      width={size} height={size * 0.72}
      accessibilityLabel={`Tax health score: ${score} out of 100. Status: ${label}.`}
      accessibilityRole="image"
    >
      {/* Track */}
      <Path d={describeArc(cx, cy, r, START, START + SWEEP)}
            stroke="#E5E7EB" strokeWidth={12} fill="none" strokeLinecap="round" />
      {/* Animated fill */}
      <AnimatedPath
        animatedProps={animatedProps}
        stroke={color} strokeWidth={12} fill="none" strokeLinecap="round"
      />
      {/* Score */}
      <SvgText x={cx} y={cy + 10} textAnchor="middle"
        fontSize={size * 0.22} fontWeight="800" fill={color}>{score}</SvgText>
      {/* Label */}
      <SvgText x={cx} y={cy + 30} textAnchor="middle"
        fontSize={size * 0.075} fill="#6B7280">Tax Health</SvgText>
    </Svg>
  );
}

// Usage:
// <TaxHealthGauge score={stats.taxHealthScore} size={SCREEN_WIDTH < 360 ? 160 : 200} />
// Always verify: renders correctly at score=0 (no arc), 50 (yellow), 82 (lime), 100 (green)
```

---

## THEME SYSTEM (C-04 fix)

```typescript
// mobile/src/contexts/ThemeContext.tsx

import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors as baseColors } from '../design-system/tokens';

export interface ThemeContextValue {
  isDark:  boolean;
  colors:  typeof baseColors;
  theme:   'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextValue>({
  isDark: false, colors: baseColors, theme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = useMemo(() => ({
    ...baseColors,
    surface:       isDark ? baseColors.dark.surface       : '#FFFFFF',
    textPrimary:   isDark ? baseColors.dark.textPrimary   : baseColors.textPrimary,
    textSecondary: isDark ? baseColors.dark.textSecondary : baseColors.textSecondary,
    textMuted:     isDark ? baseColors.dark.textMuted     : baseColors.textMuted,
    border:        isDark ? baseColors.dark.border        : baseColors.border,
    gray: {
      ...baseColors.gray,
      50: isDark ? baseColors.dark.background : baseColors.gray[50],
    },
  }), [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, colors, theme: isDark ? 'dark' : 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// In _layout.tsx — wrap before QueryClientProvider:
// <ThemeProvider><QueryClientProvider client={queryClient}>...
```

---

## DASHBOARD COMPOSITE HOOK (C-14)

```typescript
// mobile/src/store/queries.ts — replace 3 hooks with 1

export function useDashboard() {
  return useQuery({
    queryKey:    ['dashboard', 'composite'],
    queryFn:     () => dashboardApi.composite().then(r => r.data),
    staleTime:   2 * 60 * 1000,
    placeholderData: (prev) => prev,  // return cached while revalidating
  });
}

// In DashboardScreen:
// const { data, isLoading, refetch, isRefetching } = useDashboard();
// if (isLoading && !data) return <DashboardSkeleton />;
// data.stats | data.forecast | data.nrsHealth | data.topAnomalies | data.upcomingDeadlines
```

---

## ACCESSIBILITY REQUIREMENTS (C-15)

```typescript
// All status / severity indicators must use 3 channels simultaneously:

// ✅ Correct — color + shape + text
function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const cfg = {
    high:   { emoji: '🔴', label: 'HIGH RISK',  bg: '#FEF2F2', text: '#B91C1C' },
    medium: { emoji: '🟡', label: 'REVIEW',      bg: '#FFFBEB', text: '#92400E' },
    low:    { emoji: '🔵', label: 'NOTE',         bg: '#EFF6FF', text: '#1E40AF' },
  }[severity];
  return (
    <View style={{ backgroundColor: cfg.bg, flexDirection: 'row', padding: 4, borderRadius: 4 }}
          accessibilityLabel={`${cfg.label} severity`}>
      <Text>{cfg.emoji}</Text>
      <Text style={{ color: cfg.text, fontWeight: '700', fontSize: 11 }}> {cfg.label}</Text>
    </View>
  );
}

// Touch targets
// All interactive elements: minHeight: 44, minWidth: 44 (WCAG 2.1 AA)
// Never: a Pressable with height: 32 or less

// Screen reader
// All Pressable: accessibilityRole + accessibilityLabel
// TaxHealthGauge: accessibilityLabel="Tax health score: 82 out of 100. Status: Good."
// AnomalyRow:     accessibilityLabel="High risk: Duplicate invoice ₦120,300. Tap to review."
```

---

## OFFLINE PATTERNS

```typescript
// Offline banner — only show if user attempts action requiring network
// Never show just because they're offline with cached data

// useOfflineSync — for any data write
const { enqueue, isOnline, queueDepth, lastSyncTime } = useOfflineSync();

// Pattern: optimistic write → SQLite → sync on reconnect
await enqueue('create_expense', { ...payload, offlineId: nanoid() });
// offlineId prevents server-side duplicate on reconnect

// Empty states during offline (never show error)
{isOffline && invoices.length === 0 && (
  <EmptyState
    emoji="📴"
    title={t('common.offlineMode')}
    body={t('invoice.offlineEmptyBody')}
    // No action button — can't create invoice while offline
  />
)}
// Pidgin: "You no get network. Your data dey safe — come back when network return."
```

---

## QUICK ACTION CONTEXT SORTING

```typescript
// DashboardScreen: compute contextual quick actions (not static list)
import { computeQuickActions } from '../utils/quickActions';

// In DashboardScreen:
const actions = useMemo(
  () => data ? computeQuickActions(data) : defaultQuickActions,
  [data]
);

// computeQuickActions() boosts priority of:
//   'file_vat'  if VAT due ≤ 7 days
//   'nrs'       if pendingNrs > 0
//   'anomalies' if topAnomalies.length > 0
//   'invoice'   if totalInvoices === 0 (new user)
// Returns top 6 sorted by priority
```

---

## COMPLIANCE CALENDAR

```typescript
// Two display modes based on screen real estate:
// Mode A — List (Image 2 style):
function DeadlineList({ deadlines }: { deadlines: ComplianceEvent[] }) {
  return deadlines.slice(0, 4).map(d => (
    <Pressable key={d.id}
      style={[styles.deadlineRow, d.daysRemaining <= 3 && styles.deadlineRowUrgent]}
      accessibilityLabel={`${d.type} due ${d.dueDate}, ${d.daysRemaining} days remaining`}
    >
      <Text>{d.daysRemaining <= 3 ? '🔴' : '🟡'}</Text>
      <Text>{d.type} Filing Due</Text>
      <Text style={styles.deadlineDate}>{formatNigerianDate(d.dueDate)}</Text>
    </Pressable>
  ));
}

// Data from: data.upcomingDeadlines (GET /api/v1/dashboard composite response)
// Types: 'VAT' | 'PAYE' | 'WHT' | 'PIT' | 'CIT'
// All deadline types must have EN + Pidgin translations
```

---

## I18N STYLE GUIDE (Pidgin)

```
# Pidgin should sound like a Lagos market trader, not Google Translate:

# Financial amounts:
  "₦450,000 wey you owe" (not "₦450,000 VAT Owed")

# Urgency:
  "File am before trouble reach" (not "File before deadline")
  "E don late o!" (not "This is overdue")

# Encouragement:
  "You do well! Keep am up" (not "Excellent")
  "Small thing remain" (not "You're almost there")

# NRS circuit open (reassuring — not technical):
  "NRS system dey do maintenance. Your invoice safe — e go stamp when e come back."

# Offline:
  "No network — everything safe for now" (not "Cached data mode")

# Error:
  "Something no work. Try again" (not "An error occurred")

# All Pidgin keys must have matching EN keys — never add one without the other
```

---

## STACK VERSIONS (Frozen — No Upgrade Without Approval)

```
React Native:    0.81.5
Expo SDK:        54
Reanimated:      4.x   (use Reanimated API — not Animated from react-native)
TanStack Query:  5.x
Zustand:         4.x
react-native-svg: bundled with Expo SDK 54 (no separate install needed)
expo-router:     3.x
```

---

## INPUTS / OUTPUTS

```
Inputs:  M00 (always active). Dashboard data via useDashboard() composite hook.
Outputs: Screen implementations, component code, theme configuration, i18n keys.
```

## DEPENDENCIES

```
M00 — Core identity and constraints (always loaded first)
M05 — If implementing tax calculations in mobile UI (rare; prefer contracts import)
```
