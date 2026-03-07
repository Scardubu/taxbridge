/**
 * TaxBridge — HealthRing Component
 * M09 / F1 — Animated Health Ring Widget
 *
 * Architecture:
 *   Outer ring  — total score arc (withTiming, DURATION.slow, EASE.gauge)
 *   Inner ring  — 4 pillar arcs, one per quadrant segment (withSpring, staggered)
 *
 * Constraints:
 *   C-06  All i18n strings from en.json + pidgin.json
 *   C-13  SVG arcs only — never ProgressBar
 *   C-15  accessibilityLabel required (score + status, not color alone)
 *   C-16  No raw animation durations — use DURATION.* / EASE.*
 *
 * Pillar keys: filing_timeliness | data_completeness | compliance_calendar | nrs_submissions
 * Gate: renders cleanly on 320px-wide device; all 4 pillar arcs animate independently.
 */

import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { DURATION, EASE } from '../../design-system/animation';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Arc Geometry Constants ───────────────────────────────────────────────────

const ARC_START_DEG  = -220;  // degrees from 12-o'clock (matches TaxHealthGauge)
const ARC_SWEEP_DEG  = 260;   // total arc sweep in degrees

// 4 pillar segments: (260 - 3 gaps × 4°) / 4 = 62° each
const PILLAR_COUNT     = 4;
const PILLAR_GAP_DEG   = 4;
const PILLAR_SWEEP_DEG = (ARC_SWEEP_DEG - PILLAR_GAP_DEG * (PILLAR_COUNT - 1)) / PILLAR_COUNT; // 62

// ─── Pillar Definitions ───────────────────────────────────────────────────────

const PILLARS = [
  { key: 'filing_timeliness',   i18nKey: 'dashboard.pillar.filingTimeliness'   },
  { key: 'data_completeness',   i18nKey: 'dashboard.pillar.dataCompleteness'   },
  { key: 'compliance_calendar', i18nKey: 'dashboard.pillar.complianceCalendar' },
  { key: 'nrs_submissions',     i18nKey: 'dashboard.pillar.nrsSubmissions'     },
] as const;

export type PillarKey = typeof PILLARS[number]['key'];

export interface PillarData {
  key:    PillarKey;
  score:  number;    // 0–100
  trend?: string;    // improving | stable | declining
}

export interface HealthRingProps {
  totalScore:         number;       // 0–100
  pillars:            PillarData[];
  size?:              number;       // explicit override; default = responsive
  accessibilityLabel: string;       // required — C-15
  testID?:            string;
}

// ─── Arc Math ─────────────────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

function polarToCartesian(
  cx: number, cy: number, r: number, deg: number,
): { x: number; y: number } {
  const rad = degToRad(deg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildArcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (Math.abs(sweep) < 0.5) {
    return `M ${cx} ${cy}`; // degenerate — invisible point
  }
  const start    = polarToCartesian(cx, cy, r, startDeg);
  const end      = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepDir = sweep > 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepDir} ${end.x} ${end.y}`;
}

// ─── Score → Color Mapping (shared with TaxHealthGauge conventions) ───────────

function scoreToColor(score: number): string {
  if (score >= 90) return '#10B981'; // emerald — excellent
  if (score >= 75) return '#84CC16'; // lime    — good
  if (score >= 50) return '#F59E0B'; // amber   — fair
  return '#EF4444';                  // red     — at risk
}

// ─── Pillar start degree helper ───────────────────────────────────────────────

function pillarStartDeg(index: number): number {
  return ARC_START_DEG + index * (PILLAR_SWEEP_DEG + PILLAR_GAP_DEG);
}

// ─── Animated Pillar Arc ──────────────────────────────────────────────────────

interface PillarArcProps {
  cx:       number;
  cy:       number;
  r:        number;
  stroke:   number;
  startDeg: number;
  score:    number;  // 0–100
  color:    string;
  delay:    number;  // ms stagger
}

function PillarArc({ cx, cy, r, stroke, startDeg, score, color, delay }: PillarArcProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withSpring(score / 100, { damping: 14, stiffness: 90, mass: 1 }),
    );
  }, [score, delay]);

  const animatedProps = useAnimatedProps(() => ({
    d: buildArcPath(cx, cy, r, startDeg, startDeg + PILLAR_SWEEP_DEG * progress.value),
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      fill="none"
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const HealthRing = memo(function HealthRing({
  totalScore,
  pillars,
  size,
  accessibilityLabel,
  testID,
}: HealthRingProps) {
  const { t } = useTranslation();

  const defaultSize  = SCREEN_WIDTH < 360 ? 160 : 200;
  const resolvedSize = size ?? defaultSize;

  const cx          = resolvedSize / 2;
  const cy          = resolvedSize * 0.56;
  const outerR      = resolvedSize * 0.38;             // outer ring = total score
  const innerR      = resolvedSize * 0.28;             // inner ring = pillar arcs
  const outerStroke = Math.max(10, resolvedSize * 0.056);
  const innerStroke = Math.max(7,  resolvedSize * 0.040);
  const svgH        = resolvedSize * 0.75;
  const trackEndDeg = ARC_START_DEG + ARC_SWEEP_DEG;

  // Total score arc animation
  const totalProgress = useSharedValue(0);

  useEffect(() => {
    const MAX_SCORE = 100;
    totalProgress.value = withTiming(totalScore / MAX_SCORE, {
      duration: DURATION.slow,
      easing:   EASE.gauge,
    });
  }, [totalScore]);

  const totalArcProps = useAnimatedProps(() => ({
    d: buildArcPath(cx, cy, outerR, ARC_START_DEG, ARC_START_DEG + ARC_SWEEP_DEG * totalProgress.value),
  }));

  const totalColor = scoreToColor(totalScore);

  const getPillarScore = (key: PillarKey): number =>
    pillars.find(p => p.key === key)?.score ?? 0;

  return (
    <View
      style={[styles.container, { width: resolvedSize }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg width={resolvedSize} height={svgH}>

        {/* ── Outer track (gray) ── */}
        <Path
          d={buildArcPath(cx, cy, outerR, ARC_START_DEG, trackEndDeg)}
          stroke="#E5E7EB"
          strokeWidth={outerStroke}
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Outer animated fill (total score) ── */}
        <AnimatedPath
          animatedProps={totalArcProps}
          stroke={totalColor}
          strokeWidth={outerStroke}
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Inner track (gray) ── */}
        <Path
          d={buildArcPath(cx, cy, innerR, ARC_START_DEG, trackEndDeg)}
          stroke="#F3F4F6"
          strokeWidth={innerStroke}
          strokeLinecap="round"
          fill="none"
        />

        {/* ── 4 pillar arcs on inner ring ── */}
        {PILLARS.map((pillar, i) => {
          const pScore = getPillarScore(pillar.key);
          return (
            <PillarArc
              key={pillar.key}
              cx={cx}
              cy={cy}
              r={innerR}
              stroke={innerStroke}
              startDeg={pillarStartDeg(i)}
              score={pScore}
              color={scoreToColor(pScore)}
              delay={i * 80}
            />
          );
        })}

      </Svg>

      {/* ── Score text overlay ── */}
      <View style={[styles.scoreOverlay, { top: cy - resolvedSize * 0.18 }]}
            pointerEvents="none">
        <Text style={[styles.scoreValue, { color: totalColor }]}>
          {totalScore}
        </Text>
        <Text style={styles.scoreLabel}>
          {t('taxHealth.title')}
        </Text>
      </View>

    </View>
  );
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function HealthRingSkeleton({ size }: { size?: number }) {
  const s = size ?? (SCREEN_WIDTH < 360 ? 160 : 200);
  return (
    <View
      style={[styles.container, { width: s, height: s * 0.75 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width:  s * 0.82,
          height: s * 0.75,
          borderRadius: s,
          backgroundColor: '#F3F4F6',
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
  },
  scoreOverlay: {
    position:   'absolute',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize:    32,
    fontWeight:  '700',
    fontVariant: ['tabular-nums'],
    lineHeight:  36,
  },
  scoreLabel: {
    fontSize:      11,
    fontWeight:    '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color:         '#6B7280',
    marginTop:     2,
  },
});

/*
 * Usage (in DashboardScreen apex zone):
 *
 *   import { HealthRing, HealthRingSkeleton } from '../components/dashboard/HealthRing';
 *
 *   {loading
 *     ? <HealthRingSkeleton />
 *     : <HealthRing
 *         totalScore={data.healthScore}
 *         pillars={data.pillars}
 *         accessibilityLabel={`Tax health score: ${data.healthScore} out of 100`}
 *       />
 *   }
 *
 * Gate:
 *   320px device  → resolvedSize=160, all arcs readable, no clipping
 *   4 pillars     → each animates independently via withSpring, staggered 80ms
 *   score=0       → no colored arcs; gray tracks only
 *   score=100     → outer + all 4 inner arcs fully colored
 */
