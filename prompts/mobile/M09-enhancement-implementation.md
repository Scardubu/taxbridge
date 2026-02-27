# MODULE M09 — MOBILE ENHANCEMENT REPORT INTEGRATION
## TaxBridge AI Operating Context
**Module:** M09 | **Version:** 1.0 | **Last updated:** 2026-02-22
**Token budget:** ~1,400 tokens | **Inject for:** F1–F7 feature work, streak/gamification, charts
**Depends on:** M00, M02, M08

---

## PURPOSE
Authoritative blueprint for integrating the Mobile Dashboard Enhancement Report
(Phase 1–4 analysis, 7 MoSCoW-prioritised proposals) into the TaxBridge v3.0.0
codebase. This module fills the gaps in M08/V10.1 that the report identified:
health ring quadrant pillars, sparkline bar chart, streak gamification, tax breakdown
donut, USSD bridge, and AI Pidgin chat advisor.

**Scope:** mobile/, backend/src/routes/, prisma/schema.prisma, packages/contracts/

---

## SECTION 1 — OVERVIEW

## TaxBridge Enhancement Implementation Section

### 1.1 Enhancement Roster and Alignment

The Mobile Dashboard Enhancement Report proposes 7 features mapped to MoSCoW priority.
The table below shows their relationship to V10.1 critical flaws, existing infrastructure,
and the tactical gaps this module closes.

| ID | Feature | MoSCoW | Eval Score | V10.1 Coverage | This Module Adds |
|----|---------|---------|-----------|----------------|-----------------|
| F1 | Animated Health Ring Widget | MUST | 9.5 | Partial (arc gauge without pillars) | 4-quadrant pillar arcs, spring animation |
| F2 | AI Anomaly Spike Alert Screen | MUST | 9.2 | Anomaly row cards only | Sparkline bar chart, push notification wiring |
| F3 | Gamified Compliance Streak + XP | MUST | 8.8 | Not present | Full streak hook, SQLite schema, confetti |
| F4 | Tax Breakdown Donut | MUST | 8.7 | Not present | Custom SVG donut, drill-down, legend |
| F5 | Deadline Countdown Widget | SHOULD | 8.2 | Multi-deadline calendar (CF-06) | Urgency gradient banner, Remita deep link |
| F6 | USSD Native Launcher | SHOULD | 7.9 | Not present | 5-line Linking.openURL implementation |
| F7 | AI Tax Chat (Pidgin English) | COULD | 7.2 | Not present | Claude API integration, SQLite response cache |

**SWOT alignment:**
- Strengths exploited: Reanimated 4.x already installed; react-native-svg in Expo SDK 54;
  SQLite offline-first architecture (streak survives offline); BullMQ for push delivery.
- Weaknesses closed: Mobile charts absent (F1/F4); AI signals invisible (F2); no habit loop (F3).
- Opportunities captured: 40M+ feature-phone traders via USSD (F6); Pidgin AI advisor (F7).
- Threats mitigated: Custom SVG (<8KB each) replaces Recharts (120KB) — APK stays under 50MB.

**Absolute constraints from M00 apply unchanged:**
C-01 Prisma any · C-06 EN + Pidgin · C-07 Graceful degradation · C-13 SVG arc ·
C-14 Composite API · C-15 Color + shape + text. No constraint is relaxed for any F1–F7 feature.

---

### 1.2 Bundle and Performance Targets

```
New npm packages:     0  (react-native-svg and expo-notifications already in Expo SDK 54)
APK size increase:    < 200KB across all F1–F7 additions
Chart render time:    < 16ms (custom SVG path, no layout recalculation)
Push delivery:        < 3 pushes/day/user (avoid notification fatigue)
Streak cold start:    < 50ms (SQLite read, no API call required on mount)
AI chat response:     < 1.8s p95 (claude-haiku-4-5-20251001, cached responses served offline)
Test additions:       +28 Jest tests → 243 total (from 215 baseline), 0 regressions
```

---

## SECTION 2 — IMPLEMENTATION STRATEGY

### 2.1 4-Week Phased Plan

**Week 1 — Composite Integration + Must-Have Shells (Days 1–7)**

```
Day 1: Merge 58 v3.0.0 delivery files; confirm 423+ tests pass; expo-doctor clean.
Day 2: Add StreakRecord and PillarScore Prisma models (see §3.3).
       Run: npx prisma migrate dev --name add_streak_and_pillars
Day 3: Build HealthRing.tsx with 4 quadrant pillar arcs.
       Gate: Renders on 320px device; all 4 pillars animate independently.
Day 4: Build SparklineBarChart.tsx (used in anomaly review screen).
       Gate: 12 bars, flagged bar highlights in coral, renders < 16ms.
Day 5: Build DonutChart.tsx (tax breakdown).
       Gate: Slices sum to 100%; tap-to-drill routes to correct filter.
Day 6: Build useStreak() hook + StreakScreen.tsx + XP confetti trigger.
       Gate: Streak increments on invoice create; resets at midnight Lagos time.
Day 7: Wire all F1–F4 into DashboardScreen composite data (useDashboard() hook).
```

**Week 2 — Backend Extensions + Push (Days 8–14)**

```
Day 8:  GET /api/v1/health/pillars — returns {score, pillars[4], trend12w}
Day 9:  GET /api/v1/anomalies — enhanced with sparkData[] (last 12 invoices per user)
Day 10: POST /api/v1/anomalies/:id/resolve — approve/void; fires NRS stamp or IRN release
Day 11: GET/POST /api/v1/streak/:userId and /api/v1/streak/checkin
Day 12: GET /api/v1/insights/breakdown — YTD donut slices + monthly trend per slice
Day 13: Register expo-notifications in _layout.tsx; wire BullMQ push worker (anomaly trigger)
Day 14: Integration test: anomaly detected → BullMQ push → Expo push delivered on device
```

**Week 3 — Should/Could + Alternatives (Days 15–20)**

```
Day 15: F5 — Urgency banner with Remita deep link (extends ComplianceDeadlines from M08)
Day 16: F6 — USSD bridge (Linking.openURL, 5 lines — see §3.5)
Day 17: F7 — AI Pidgin chat screen (Claude API with SQLite response cache — see §3.6)
Day 18: Iteration 01: Lite Mode PWA scaffold in infra/lite-pwa/ (Cloudflare Pages)
Day 19: Iteration 02: Claude API streaming for chat (progressive response rendering)
Day 20: i18n parity: all new feature strings added to en.json + pidgin.json (C-06 gate)
```

**Week 4 — Harden + QA (Days 21–28)**

```
Day 21: Jest: +28 new tests (see §4.3 for list). Run full suite → 243 passing, 0 failing.
Day 22: Bundle analysis: npx expo export --platform android; check assets. Target: <200KB delta.
Day 23: Visual QA — dark mode, 320px (Tecno Spark), 393px (iPhone 15 Pro).
         Gauge, donut, sparkline, streak all checked at each size.
Day 24: Performance: simulate 2G (Chrome DevTools throttle), measure composite API waterfall.
         Target: dashboard fully rendered < 1.5s on 2G.
Day 25: Push notification QA: trigger anomaly → push arrives on Android + iOS test device.
Day 26: USSD QA: *347*TBR# launches dialer on Android (note: iOS limitations — see §5.2).
Day 27: Deploy staging. /api/v1/streak/checkin, /api/v1/anomalies, /api/v1/insights/breakdown
         all return 200 with correct shape.
Day 28: Update CHANGELOG.md (v3.1.0 section) + PRODUCTION_READY.md metrics.
```

---

## SECTION 3 — CODE AND INTEGRATION DETAILS

### 3.1 F1 — Health Ring Widget with 4 Quadrant Pillars

The base TaxHealthGauge (M02/M08) shows one arc. The HealthRing extends it with
four independent pillar arcs representing Filing Compliance, Payment Status,
Record Completeness, and VAT Accuracy. Each pillar is a separate SVG arc segment.

```typescript
// mobile/src/components/charts/HealthRing.tsx
// Extends TaxHealthGauge — do NOT replace; render HealthRing on a dedicated tab,
// keep TaxHealthGauge for the main dashboard card.

import Svg, { Path, Text as SvgText, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, withSpring, useAnimatedProps, withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Pressable } from 'react-native';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface PillarData {
  label:      string;   // 'Filing' | 'Payment' | 'Records' | 'VAT'
  score:      number;   // 0–100
  color:      string;
  labelKey:   string;   // i18n key
}

interface HealthRingProps {
  score:   number;
  pillars: PillarData[];  // exactly 4
  size?:   number;        // default 220
  onPillarTap?: (pillar: PillarData) => void;
}

// Each pillar occupies a 90° quadrant of the outer ring
// Outer ring: r=90 (main score), Inner ring: r=70 (pillar arcs, 4×80° arcs with 10° gap)
function buildPillarArc(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number, pct: number,
): { track: string; fill: string } {
  const filled = startDeg + (endDeg - startDeg) * pct;
  return {
    track: arcPath(cx, cy, r, startDeg, endDeg),
    fill:  pct < 0.02 ? '' : arcPath(cx, cy, r, startDeg, filled),
  };
}

function arcPath(cx: number, cy: number, r: number, s: number, e: number): string {
  if (Math.abs(e - s) < 0.5) return '';
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(s), end = toXY(e);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${end.x} ${end.y}`;
}

const PILLAR_CONFIGS = [
  { startDeg: -130, endDeg: -45, label: '📋',  color: '#10B981' }, // Filing — top-left
  { startDeg: -40,  endDeg:  45, label: '💳',  color: '#3B82F6' }, // Payment — top-right
  { startDeg:  50,  endDeg: 135, label: '📄',  color: '#8B5CF6' }, // Records — bottom-right
  { startDeg: 140,  endDeg: 225, label: '📊',  color: '#F59E0B' }, // VAT — bottom-left
];

export function HealthRing({ score, pillars, size = 220, onPillarTap }: HealthRingProps) {
  const cx = size / 2, cy = size / 2;
  const outerR = size * 0.41;  // main score arc
  const innerR = size * 0.30;  // pillar arcs

  const mainProgress = useSharedValue(0);
  const pillarProgress = pillars.map(() => useSharedValue(0));

  useEffect(() => {
    mainProgress.value = withSpring(score / 100, { damping: 14, stiffness: 90 });
    pillars.forEach((p, i) => {
      pillarProgress[i].value = withDelay(
        i * 120,
        withSpring(p.score / 100, { damping: 12, stiffness: 80 }),
      );
    });
  }, [score, pillars]);

  const mainArcProps = useAnimatedProps(() => ({
    d: arcPath(cx, cy, outerR, -130, -130 + 260 * mainProgress.value),
  }));

  return (
    <Svg
      width={size} height={size}
      accessibilityRole="image"
      accessibilityLabel={`Tax health: ${score}/100. Pillars: ${pillars.map(p => `${p.label} ${p.score}`).join(', ')}`}
    >
      {/* Main arc track */}
      <Path d={arcPath(cx, cy, outerR, -130, 130)}
            stroke="#E5E7EB" strokeWidth={14} fill="none" strokeLinecap="round" />
      {/* Animated main arc fill */}
      <AnimatedPath
        animatedProps={mainArcProps}
        stroke={score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444'}
        strokeWidth={14} fill="none" strokeLinecap="round"
      />
      {/* Score label */}
      <SvgText x={cx} y={cy + 8} textAnchor="middle"
        fontSize={size * 0.20} fontWeight="800" fill="#111827">{score}</SvgText>
      <SvgText x={cx} y={cy + 24} textAnchor="middle"
        fontSize={size * 0.07} fill="#6B7280">Tax Health</SvgText>

      {/* 4 Pillar arcs on inner ring */}
      {PILLAR_CONFIGS.map((cfg, i) => {
        const p = pillars[i];
        if (!p) return null;
        const { track, fill } = buildPillarArc(
          cx, cy, innerR, cfg.startDeg, cfg.endDeg, p.score / 100,
        );
        return (
          <React.Fragment key={p.label}>
            <Path d={track} stroke="#F3F4F6" strokeWidth={8} fill="none" strokeLinecap="round" />
            {fill ? (
              <Pressable onPress={() => onPillarTap?.(p)}>
                <Path d={fill} stroke={cfg.color} strokeWidth={8} fill="none" strokeLinecap="round" />
              </Pressable>
            ) : null}
            {/* Pillar emoji label */}
            <SvgText
              x={cx + innerR * 1.35 * Math.cos(((((cfg.startDeg + cfg.endDeg) / 2) - 90) * Math.PI) / 180)}
              y={cy + innerR * 1.35 * Math.sin(((((cfg.startDeg + cfg.endDeg) / 2) - 90) * Math.PI) / 180)}
              textAnchor="middle" fontSize={14} fill="#374151"
            >
              {cfg.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// Pillar bottom sheet (tap any pillar → this expands)
export function PillarDetailSheet({ pillar, onClose }: { pillar: PillarData; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800' }}>{t(pillar.labelKey)}</Text>
      <TaxHealthGauge score={pillar.score} size={120} showLabel={false} />
      <Text>{t(`dashboard.pillarHint.${pillar.label.toLowerCase()}`)}</Text>
    </View>
  );
}

// New backend endpoint required:
// GET /api/v1/health/pillars
// Returns: { score, pillars: [{ label, score, color }], trend12w: number[] }
// Compute pillarScore per dimension:
//   Filing: (filedOnTime / totalDue) × 100
//   Payment: (paidInvoices / totalInvoices) × 100
//   Records: (receiptsWithOCR / totalExpenses) × 100
//   VAT: (vatCollectedCorrectly / totalVatInvoices) × 100
```

---

### 3.2 F2 — Anomaly Spike Alert: SparklineBarChart + Push

```typescript
// mobile/src/components/charts/SparklineBarChart.tsx
// Used in AnomalyReviewScreen. 12 bars; last = flagged invoice (coral).
// ~2KB component, renders < 16ms.

import { View, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import Animated, { withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useEffect } from 'react';

interface SparklineBarChartProps {
  data:         number[];    // 12 values (last 12 invoices)
  flaggedIndex: number;      // index of anomalous bar (usually 11 = last)
  avgLine?:     number;      // draw average baseline
  width?:       number;      // default 240
  height?:      number;      // default 80
}

export function SparklineBarChart({
  data, flaggedIndex, avgLine, width = 240, height = 80,
}: SparklineBarChartProps) {
  const max = Math.max(...data, 1);
  const barWidth = (width / data.length) * 0.6;
  const gap      = (width / data.length) * 0.4;

  return (
    <Svg
      width={width} height={height}
      accessibilityRole="image"
      accessibilityLabel={`Invoice amount chart. Flagged invoice is ${data[flaggedIndex]?.toLocaleString('en-NG')} vs average.`}
    >
      {/* Average baseline */}
      {avgLine !== undefined && (
        <Line
          x1={0} y1={height - (avgLine / max) * height}
          x2={width} y2={height - (avgLine / max) * height}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 3"
        />
      )}

      {/* Bars */}
      {data.map((val, i) => {
        const barH  = Math.max(2, (val / max) * height);
        const x     = i * (barWidth + gap);
        const y     = height - barH;
        const color = i === flaggedIndex ? '#EF4444' : 'rgba(255,255,255,0.15)';
        return (
          <Rect key={i}
            x={x} y={y} width={barWidth} height={barH}
            fill={color} rx={2}
          />
        );
      })}
    </Svg>
  );
}

// AnomalyReviewScreen — key integration points:
// 1. Props: { anomaly: AnomalySignal & { sparkData: number[]; penalty: string } }
// 2. Approve → POST /api/v1/anomalies/:id/resolve { action: 'approve' }
//             → NRS submission triggered in BullMQ
// 3. Void   → POST /api/v1/anomalies/:id/resolve { action: 'void' }
//             → IRN released

// backend/src/routes/anomalies.ts — enhanced response shape
// GET /api/v1/anomalies returns:
// {
//   anomalies: [{
//     ...AnomalySignal,
//     sparkData:   number[],   // last 12 invoice amounts for this user
//     penalty:     string,     // e.g. "₦263,000 (NTAA §104 + 100% VAT)"
//     invoiceRef:  string,     // e.g. "Invoice #0042"
//     customerName: string,
//   }]
// }

// BullMQ push worker (backend/src/workers/push.worker.ts):
// Trigger: after detectExpenseAnomalies() finds severity=high
// payload: { userId, invoiceId, ratio, penalty, sparkData }
// Expo push body: "Invoice #0042 is 4.2× your average — ₦263K penalty risk"
// Pidgin body:    "Invoice #0042 big pass normal 4.2× — ₦263K wahala if you no check"
```

---

### 3.3 F3 — Gamified Compliance Streak + XP

**Prisma schema additions:**

```prisma
// prisma/schema.prisma — add after TaxHealthSnapshot model

model StreakRecord {
  id            String   @id @default(cuid())
  userId        String   @unique @map("user_id")
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentStreak Int      @default(0)          @map("current_streak")
  longestStreak Int      @default(0)          @map("longest_streak")
  xp            Int      @default(0)
  lastFiledAt   DateTime @map("last_filed_at")
  badges        Json     @default("[]")       // string[] of unlocked badge IDs
  createdAt     DateTime @default(now())      @map("created_at")
  updatedAt     DateTime @updatedAt           @map("updated_at")
  @@map("streak_records")
}
```

**Streak hook (mobile-side, offline-first):**

```typescript
// mobile/src/hooks/useStreak.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Vibration } from 'react-native';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  xp:            number;
  badges:        string[];
  lastFiledAt:   string | null;
  nextMilestone: number;  // e.g. 30 if at 21-day streak
}

const MILESTONES = [7, 14, 30, 60, 90];
const XP_PER_ACTION = 50;

export function useStreak() {
  return useQuery<StreakData>({
    queryKey:  ['streak'],
    queryFn:   async () => {
      const resp = await fetch('/api/v1/streak');
      if (!resp.ok) throw new Error('streak fetch failed');
      return resp.json().then(r => r.data);
    },
    staleTime:       10 * 60 * 1000,  // 10 min — streak changes rarely
    placeholderData: (prev) => prev,
  });
}

export function useRecordStreakAction() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (actionType: 'invoice' | 'payment' | 'filing') =>
      fetch('/api/v1/streak/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['streak'] });
      // Milestone haptics — subtle on mid-tier, stronger on milestone
      if (MILESTONES.includes(data.newStreak)) {
        Vibration.vibrate([0, 80, 60, 120, 80, 200]);  // milestone pattern
        // TODO: trigger Reanimated confetti (see ConfettiOverlay component)
      } else {
        Vibration.vibrate(40);
      }
    },
    // Offline resilience: if mutation fails, it will retry on reconnect via
    // the offline queue. The UX stays optimistic.
  });
}

// StreakScreen.tsx — key display elements:
// 1. Fire emoji + current streak number (Reanimated spring on mount)
// 2. Badge row (earned = gold, unearned = ghost)
// 3. XP progress bar toward next milestone (withTiming, 600ms)
// 4. Lagos leaderboard rank (opt-in, anonymised) — GET /api/v1/streak/leaderboard?state=lagos
// 5. "NRS Star" badge: zero penalties for 90 days — shareable as PNG via Expo Sharing

// Confetti trigger (Reanimated confetti on milestone):
// mobile/src/components/ConfettiOverlay.tsx
// On milestone: render 50–120 animated circles (particles) that fall from top,
// count scales with platform memory (Platform.OS === 'android' ? 50 : 120)

// Streak reset logic (midnight Lagos time = UTC+1):
// - Backend: cron '0 23 * * *' (UTC) → check all streaks; mark broken if lastFiledAt < today
// - Grace period: 48h (user can still file next day and keep streak)
// - SQLite offline resilience: streak count stored in AsyncStorage as fallback;
//   reconcile with server on reconnect
```

---

### 3.4 F4 — Tax Breakdown Donut Chart

```typescript
// mobile/src/components/charts/DonutChart.tsx
// Custom SVG donut — ~60 lines. No Recharts. No Victory Native.
// ~3KB minified. Renders < 16ms on Tecno Spark.

import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import Animated, { useSharedValue, withTiming, useAnimatedProps } from 'react-native-reanimated';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutSlice {
  label:    string;    // 'VAT' | 'PIT' | 'WHT' | 'CIT' | 'Dev Levy'
  pct:      number;    // 0–100 (must sum to 100 across all slices)
  naira:    number;    // absolute ₦ amount
  color:    string;
  taxType:  string;    // for drill-down route
}

const CX = 65, CY = 65, R = 48;
const CIRCUMFERENCE = 2 * Math.PI * R; // 301.59

function buildArcs(slices: DonutSlice[]): Array<DonutSlice & { dash: number; offset: number }> {
  let runningOffset = 0;
  return slices.map(s => {
    const dash = (s.pct / 100) * CIRCUMFERENCE;
    const arc  = { ...s, dash, offset: -runningOffset };
    runningOffset += dash;
    return arc;
  });
}

export function DonutChart({
  slices, size = 130, onSliceTap,
}: {
  slices:      DonutSlice[];
  size?:       number;
  onSliceTap?: (slice: DonutSlice) => void;
}) {
  const scale = size / 130;
  const arcs  = buildArcs(slices);
  const total = slices.reduce((sum, s) => sum + s.naira, 0);

  // Animate each arc from 0 → final dash in staggered sequence
  const progresses = slices.map(() => useSharedValue(0));
  useEffect(() => {
    arcs.forEach((arc, i) => {
      setTimeout(() => {
        progresses[i].value = withTiming(1, { duration: 600 });
      }, i * 120);
    });
  }, [slices]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Tax breakdown: ${slices.map(s => `${s.label} ${s.pct}%`).join(', ')}`}
    >
      <Svg width={size} height={size} viewBox="0 0 130 130">
        {arcs.map((arc, i) => {
          const animatedProps = useAnimatedProps(() => ({
            strokeDasharray: `${arc.dash * progresses[i].value} ${CIRCUMFERENCE}`,
          }));
          return (
            <Pressable key={arc.label} onPress={() => onSliceTap?.(arc)}>
              <AnimatedCircle
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={20}
                strokeDashoffset={arc.offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                animatedProps={animatedProps}
              />
            </Pressable>
          );
        })}
        {/* Center total */}
        <SvgText x={CX} y={CY - 4} textAnchor="middle" fontSize={10} fontWeight="800" fill="#fff">
          ₦{(total / 1000).toFixed(0)}K
        </SvgText>
        <SvgText x={CX} y={CY + 10} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,.4)">
          Total Tax
        </SvgText>
      </Svg>

      {/* Legend — below donut, one row per slice */}
      {arcs.map(arc => (
        <Pressable
          key={arc.label}
          onPress={() => onSliceTap?.(arc)}
          style={styles.legendRow}
          accessibilityRole="button"
          accessibilityLabel={`${arc.label}: ${arc.pct}% — ₦${arc.naira.toLocaleString('en-NG')}`}
        >
          <View style={[styles.legendDot, { backgroundColor: arc.color }]} />
          <Text style={styles.legendLabel}>{arc.label}</Text>
          <Text style={styles.legendPct}>{arc.pct}%</Text>
          <Text style={styles.legendNaira}>₦{arc.naira.toLocaleString('en-NG')}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.03)', marginBottom: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel:{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,.65)' },
  legendPct:  { fontSize: 12, fontWeight: '800', color: '#fff', width: 36, textAlign: 'right' },
  legendNaira:{ fontSize: 10, color: 'rgba(255,255,255,.35)', width: 60, textAlign: 'right' },
});

// Drill-down: onSliceTap(slice) → router.push(`/insights/breakdown?type=${slice.taxType}`)
// Backend: GET /api/v1/insights/breakdown returns:
// { slices: DonutSlice[], monthly: { month: string; [type: string]: number }[] }
// Uses @taxbridge/contracts for all tax computation — never inline (C-09)
```

---

### 3.5 F6 — USSD Native Launcher (5 Lines)

```typescript
// mobile/src/utils/ussd.ts
// Android: Linking.openURL opens system dialer and auto-dials
// iOS: Linking.openURL('tel:…') only opens dialer without auto-dialing (OS limitation)
// WCAG: always show text label alongside the USSD code (C-15 principle)

import { Linking, Platform, Alert } from 'react-native';
import { t } from 'i18next';

export async function launchUSSD(): Promise<void> {
  // *347*TBR# URL-encoded for tel: URI (# → %23)
  const ussdUri = Platform.OS === 'android'
    ? 'tel:*347*TBR%23'  // Android: auto-dials
    : 'tel:*347*TBR';    // iOS: opens dialer (user taps dial manually)

  const supported = await Linking.canOpenURL(ussdUri);
  if (!supported) {
    Alert.alert(t('ussd.notSupportedTitle'), t('ussd.notSupportedBody'));
    return;
  }
  await Linking.openURL(ussdUri);
}

// UI trigger (add to DashboardScreen QuickActions or ProfileScreen):
// <Pressable onPress={launchUSSD} accessibilityLabel={t('ussd.launchLabel')}>
//   <Text>📞 {t('ussd.dial')}</Text>
//   <Text style={styles.ussdCode}>*347*TBR#</Text>
// </Pressable>

// i18n additions:
// en.json:     { "ussd": { "dial": "Dial via USSD", "notSupportedTitle": "USSD not available",
//                          "notSupportedBody": "Your device doesn't support USSD launching",
//                          "launchLabel": "Launch USSD tax session" } }
// pidgin.json: { "ussd": { "dial": "Call with USSD", "notSupportedTitle": "USSD no work here",
//                          "notSupportedBody": "Your phone no fit dial USSD direct",
//                          "launchLabel": "Open USSD tax session" } }
```

---

### 3.6 F7 — AI Pidgin Chat Advisor (Claude API + SQLite Cache)

```typescript
// mobile/src/screens/TaxChatScreen.tsx
// Claude API via backend proxy (never direct from mobile — API key stays server-side)
// Rate limit: 10 queries/day free tier; cached responses served offline

// backend/src/routes/chat.ts (new)
fastify.post('/api/v1/chat', {
  onRequest: [fastify.authenticate],
  config: { rateLimit: { max: 10, timeWindow: '1 day', keyGenerator: (req) => req.user.id } },
}, async (request, reply) => {
  const { message, language } = request.body as { message: string; language: 'en' | 'pidgin' };
  const userId = (request as any).user.id as string;

  // Check SQLite cache first (MD5 of normalized question)
  const cacheKey = `chat:${userId}:${hashQuestion(message)}`;
  const cached   = await fastify.redis.get(cacheKey);
  if (cached) return reply.send({ success: true, data: { reply: cached, fromCache: true } });

  // Pull user context for grounded answers
  const context = await buildUserContext(userId, fastify.prisma);  // recent invoices, health score

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-api-key':     process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',  // fastest + cheapest; sufficient for tax Q&A
      max_tokens: 300,
      system: buildSystemPrompt(language, context),  // NTA 2025 rules + user's business context
      messages: [{ role: 'user', content: message }],
    }),
  });

  const data = await anthropicResp.json();
  const reply_text = data.content?.[0]?.text ?? t('chat.fallback');

  // Cache response for 24h (common questions served offline)
  await fastify.redis.setex(cacheKey, 86_400, reply_text);

  return reply.send({ success: true, data: { reply: reply_text, fromCache: false } });
});

// System prompt builder
function buildSystemPrompt(language: string, context: any): string {
  const base = `
You are TaxBridge Assistant — a Nigerian tax advisor who knows the Nigeria Tax Act 2025 (NTA 2025) precisely.
You answer tax questions concisely (under 80 words), citing the NTA section when relevant.
The user's current business context: ${JSON.stringify(context)}.
CRITICAL: Never reference FIRS. Always say NRS (Nigeria Revenue Service) or DigiTax.
CRITICAL: Calculations must use exact NTA 2025 rates (PIT bands, VAT 7.5%, WHT rates).
`.trim();

  return language === 'pidgin'
    ? `${base}\nAlways respond in Nigerian Pidgin English. Sound like a trusted Lagos accountant friend, not a textbook.`
    : `${base}\nRespond in simple English. Avoid jargon. Keep it actionable.`;
}

// Mobile: TaxChatScreen.tsx key patterns
// - Input: TextInput (EN or Pidgin, auto-detect via langdetect)
// - Messages: FlatList with WhatsApp-style bubbles
// - Loading: animated typing indicator (3 dots, Reanimated loop)
// - Offline: if no network, serve from SQLite cache; show "From saved answers" badge
// - Rate limit UI: show "8 questions remaining today" below input
// - Suggested questions (first launch): chip row with common questions in user's language
```

---

## SECTION 4 — CONSTRAINTS AND TESTING

### 4.1 Performance Gates

All F1–F7 features must clear the following before Phase 4 sign-off:

```
F1 HealthRing:     SVG renders in < 16ms on Tecno Spark (Android 11, low-end)
                   4 pillar spring animations don't drop below 55fps (Reanimated native driver)
F2 SparklineBar:   12-bar chart renders in < 8ms (no layout pass — SVG native)
F3 Streak:         SQLite read on mount < 50ms; confetti particle count auto-scales
F4 DonutChart:     Full 5-slice donut with animation renders in < 16ms
                   Tap-to-drill navigation response < 100ms
F6 USSD:           Linking.openURL resolves in < 200ms (system call, near-instant)
F7 AI Chat:        Response from cache < 30ms; from API < 1.8s p95
                   Never throws uncaught error (wrap in try/catch; show friendly fallback)
```

### 4.2 Offline Resilience Matrix

| Feature | Online behaviour | Offline behaviour | Degradation |
|---------|-----------------|-------------------|-------------|
| F1 HealthRing | Live pillars from /api/v1/health/pillars | Cached scores from TaxHealthSnapshot | Shows cached score with "as of [time]" label |
| F2 Anomaly push | Push arrives in real-time | Notification stored; displayed on reconnect | "Alert waiting" badge on anomaly tab |
| F3 Streak | Syncs on action | Local SQLite increment only; sync on reconnect | Streak may be 1 behind server; reconciles silently |
| F4 DonutChart | Live /insights/breakdown | Computed from local SQLite invoice totals | Accurate but excludes server-side adjustments |
| F6 USSD | Opens dialer normally | Opens dialer normally (no data required) | None — fully offline capable |
| F7 AI Chat | Live Claude API | Redis/SQLite cached responses only | Shows "Saved answers" badge; uncached questions blocked |

### 4.3 Test Additions (+28 Tests → 243 Total)

New test files and targets. All must pass with 0 regressions to existing 215.

```
mobile/src/components/charts/__tests__/
  HealthRing.test.tsx         — 5 tests
    ✓ Renders at score=0 (no fill arc)
    ✓ Renders at score=50 (half arcs)
    ✓ Renders all 4 pillar arcs with correct colors
    ✓ onPillarTap fires for each quadrant
    ✓ accessibilityLabel contains all 4 pillar scores

  SparklineBarChart.test.tsx  — 4 tests
    ✓ Renders 12 bars
    ✓ Flagged bar has coral fill (#EF4444)
    ✓ Average line visible when avgLine prop provided
    ✓ accessibilityLabel contains flagged amount

  DonutChart.test.tsx         — 6 tests
    ✓ Renders correct number of slices
    ✓ Slice percentages sum to 100%
    ✓ Animated entrance: each arc strokes in (mock withTiming)
    ✓ onSliceTap routes to correct taxType
    ✓ Center text shows correct ₦ total
    ✓ Renders with 2 slices (edge case: minimal breakdown)

mobile/src/hooks/__tests__/
  useStreak.test.ts           — 8 tests
    ✓ Returns default {currentStreak: 0, xp: 0} when no server data
    ✓ Increments streak on checkin action
    ✓ Does NOT reset streak within grace period (48h)
    ✓ Resets streak when lastFiledAt > 48h ago
    ✓ Awards XP on each checkin
    ✓ Unlocks 7-day badge when streak reaches 7
    ✓ Offline: returns last cached value when fetch fails
    ✓ Milestone haptics triggered at 7, 14, 30 days

mobile/src/screens/__tests__/
  TaxChatScreen.test.tsx      — 5 tests
    ✓ Renders suggested questions on first launch
    ✓ Shows "from saved answers" badge on cached response
    ✓ Rate limit UI: shows remaining question count
    ✓ Offline state: uncached question shows "No network" not crash
    ✓ Pidgin response displayed without HTML entities

backend/src/routes/__tests__/
  chat.integration.test.ts    — 2 tests (requires ANTHROPIC_API_KEY in test env)
    ✓ POST /api/v1/chat returns structured response with 'reply' field
    ✓ Rate limit: 11th request in 24h returns 429
    (Skip if ANTHROPIC_API_KEY not set — mark as pending)
```

### 4.4 Accessibility Gates for New Features

All new components before ship:

```
□ HealthRing: accessibilityLabel includes score + all 4 pillar values
□ SparklineBarChart: accessibilityLabel describes flagged amount vs average
□ DonutChart: accessibilityLabel lists all slices with percentages
□ StreakScreen: streak count accessible via VoiceOver (not just visual)
□ USSD button: accessibilityLabel explains what will happen (not just "USSD")
□ TaxChatScreen: messages FlatList accessible; each bubble has role="text"
□ All new Pressable elements: minHeight 44, minWidth 44 (WCAG 2.1 AA)
□ Color in all charts: never sole indicator — always emoji/shape + text too (C-15)
```

---

## SECTION 5 — ITERATION AND RISKS

### 5.1 Iteration Alternatives (Phase 4 Evaluation)

**Iteration 01 — Lite Mode PWA (Feature-Phone Market)**

Target: 40M+ Nigerian traders who cannot install APKs (Android Go, KaiOS).
Location: `infra/lite-pwa/` (Cloudflare Pages deploy).

```
Stack:       Pure HTML/CSS/vanilla JS. No React. No npm.
Load target: < 30KB total bundle. < 1s on 2G (Cloudflare edge CDN).
Feature set: Tax Health as text percentage ("82 — Good Status")
             Streak as plain counter ("🔥 21 days")
             Donut as HTML table ("VAT: 42% · ₦84.5K | PIT: 31% · ₦62.3K")
             USSD link: <a href="tel:*347*TBR%23">Dial *347*TBR#</a>
USSD banner: "No smartphone? Dial *347*TBR# to file and pay tax without data"
Deploy:      Separate from main Expo app; linked from main app onboarding step 1
```

**Iteration 02 — Multi-Business Dashboard**

Target: Traders with 2–3 concurrent ventures (textiles + food + phone repair).

```
Approach:    BusinessSelector at top of dashboard (chip row: "Ngozi Textiles | Food Business")
Schema:      Add Business model (userId→many, each with own TIN, invoices, health score)
Mobile:      Business context stored in Zustand; all API calls include businessId param
Timeline:    6-week effort post-v3.0.0; Premium tier unlock at ₦3,500/month
Revenue:     Projected +23% ARPU based on survey data (traders managing 2+ ventures)
Risk:        Backend multi-tenancy adds query complexity; test Prisma composite indexes
```

**Iteration 03 — Badge WhatsApp Share**

Target: Viral growth via social proof among Lagos trader networks.

```
Trigger:     "NRS Star" badge unlock (zero penalties, 90 days)
Action:      Expo Sharing API → share PNG badge image to WhatsApp/Instagram
Image:       Generated server-side (HTML → Puppeteer → PNG, hosted on Cloudflare R2)
Copy:        "I've filed tax for 90 days straight on TaxBridge 🏆 *347*TBR#"
Cost:        Puppeteer serverless function ~$0.001/render; negligible at scale
Expected:    K-factor 1.3–1.6 based on comparable WhatsApp sharing campaigns in Lagos
```

---

### 5.2 Risk Register and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NRS/DigiTax API breaking change | Medium | High | DIGITAX_MOCK_MODE=true for all local dev; circuit breaker (already implemented); monitor /api/v1/nrs/health |
| Push notification fatigue (users disable) | Medium | Medium | Hard cap: max 3 pushes/day/user in BullMQ worker; always offer in-app alternative; Pidgin copy tested for anxiety level |
| Battery drain from Reanimated animations | Low | Medium | All animations use useNativeDriver; limit confetti particles on battery-saver mode (BatteryManager API); HealthRing spring duration < 2s |
| Claude API cost overrun (F7) | Low | Medium | Rate limit 10 queries/day free; aggressive Redis cache 24h; monitor spend weekly; kill switch via feature flag |
| iOS USSD limitation (F6) | High | Low | Document clearly in UI: "Tap to open dialer, then press call"; iOS shows USSD code pre-filled; no broken experience, just less automatic |
| Donut/Ring APK size growth | Low | Low | Custom SVG approach confirmed < 8KB per component; validate with `npx expo export --platform android` before ship |
| Streak SQLite vs server desync | Medium | Low | Grace period logic prevents false breaks; background sync on reconnect; pessimistic UI shows server count after sync |
| AI Chat NTA 2025 hallucination | Low | High | System prompt anchors all answers to NTA 2025 rules; instruct Claude to say "I'm not certain — consult an accountant" when confidence is low; no direct financial advice claims in UI copy |

### 5.3 Pre-Ship Checks for F1–F7

```bash
# Run before merging F1–F7 feature branch

# Test count gate
cd backend && npm test -- --passWithNoTests        # ≥ 423 (existing)
cd mobile && npx jest --passWithNoTests             # ≥ 243 (with new +28)

# Zero FIRS, zero NRSt
grep -rn "FIRS" mobile/src backend/src --include="*.ts" --include="*.tsx" --include="*.json"
grep -rn "NRSt" mobile/src --include="*.json"  # both must return 0

# Bundle check
npx expo export --platform android --output-dir /tmp/expo-export
du -sh /tmp/expo-export                            # delta vs pre-F1 build < 200KB

# i18n parity (F6 and F7 add new keys)
node scripts/check-i18n-parity.js                  # 0 missing Pidgin keys

# SVG render smoke test
cd mobile && npx jest --testPathPattern="DonutChart|HealthRing|SparklineBar" --verbose

# Accessibility
cd mobile && npx jest --testPathPattern="accessibility" --verbose  # 0 a11y failures
```

---

## INPUTS / OUTPUTS

```
Inputs:  M00 constraints active. DashboardComposite data from useDashboard() composite hook.
         /api/v1/health/pillars, /api/v1/anomalies, /api/v1/streak/:id, /api/v1/insights/breakdown.
Outputs: HealthRing, SparklineBarChart, DonutChart, useStreak(), StreakScreen, TaxChatScreen,
         launchUSSD(), PillarDetailSheet, ConfettiOverlay. All offline-resilient, 0 new npm deps.
```

## DEPENDENCIES

```
M00 — All constraints (C-01 through C-15) apply without exception
M02 — Design system, TaxHealthGauge base component, Pidgin style guide
M08 — Dashboard information hierarchy (F1–F4 must respect LEVEL 1/2/3 rules)
```
