/**
 * TaxBridge — Tax Health Gauge Component (COMP-02, C-13)
 *
 * SVG arc gauge visualising the Tax Health Score (0–100).
 * C-13: Uses SVG arc — no ProgressBar permitted anywhere in this file.
 * WCAG 2.1 AA: colour + shape + text label for all state indicators (C-15).
 *
 * Exports:
 *   - default TaxHealthGauge (React component)
 *   - computeGaugeMode (pure helper used by DashboardScreen)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import type { DashboardStats } from '@taxbridge/contracts';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZE = 200;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** Arc spans 240° starting at 150° (bottom-left → bottom-right). */
const ARC_START_DEG = 150;
const ARC_SWEEP_DEG = 240;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Build an SVG arc path string.
 * @param score 0–100
 */
function buildArcPath(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));
  const sweepDeg = (clampedScore / 100) * ARC_SWEEP_DEG;

  const startRad = degToRad(ARC_START_DEG);
  const endRad = degToRad(ARC_START_DEG + sweepDeg);

  const x1 = CX + RADIUS * Math.cos(startRad);
  const y1 = CY + RADIUS * Math.sin(startRad);
  const x2 = CX + RADIUS * Math.cos(endRad);
  const y2 = CY + RADIUS * Math.sin(endRad);

  const largeArc = sweepDeg > 180 ? 1 : 0;

  if (clampedScore === 0) {
    // Zero-length arc — render a tiny arc to avoid SVG degenerate case
    const almostEnd = degToRad(ARC_START_DEG + 0.01);
    const ax = CX + RADIUS * Math.cos(almostEnd);
    const ay = CY + RADIUS * Math.sin(almostEnd);
    return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${ax} ${ay}`;
  }

  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/** Track arc (the grey background arc). */
function buildTrackPath(): string {
  const startRad = degToRad(ARC_START_DEG);
  const endRad = degToRad(ARC_START_DEG + ARC_SWEEP_DEG);

  const x1 = CX + RADIUS * Math.cos(startRad);
  const y1 = CY + RADIUS * Math.sin(startRad);
  const x2 = CX + RADIUS * Math.cos(endRad);
  const y2 = CY + RADIUS * Math.sin(endRad);

  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 1 1 ${x2} ${y2}`;
}

/**
 * Returns the fill colour for the gauge arc based on score.
 * C-15: Only used as one of three cues (shape + text label are the others).
 */
function scoreToColor(score: number): string {
  if (score >= 75) return '#22C55E'; // green-500
  if (score >= 50) return '#F59E0B'; // amber-500
  return '#EF4444';                  // red-500
}

/**
 * Returns a human-readable grade label for the score.
 * C-15: Non-color semantic indicator.
 */
function scoreToLabel(score: number): string {
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Fair';
  return 'At Risk';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * COMP-02: Determines whether the gauge card should be rendered in
 * 'compact' mode (when an urgent compliance deadline is approaching or past)
 * or 'expanded' mode (default).
 *
 * @param data - DashboardStats from the composite API endpoint
 * @returns 'compact' if any compliance deadline is ≤ 7 days away or overdue; 'expanded' otherwise
 */
export function computeGaugeMode(
  data: DashboardStats | undefined,
): 'expanded' | 'compact' {
  if (!data) return 'expanded';
  const urgent = data.compliance?.some(
    (d) => d.daysRemaining <= 7 || d.daysRemaining < 0,
  );
  return urgent ? 'compact' : 'expanded';
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface TaxHealthGaugeProps {
  /** Tax health score 0–100 */
  score: number;
  /** Display mode — drives card size */
  mode?: 'expanded' | 'compact';
  /** Optional label override (defaults to computed label) */
  label?: string;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
}

/**
 * TaxHealthGauge — SVG arc gauge for the Tax Health Score.
 *
 * C-13: Renders an SVG arc — ProgressBar is explicitly forbidden.
 * C-15: Colour + shape (arc fill direction) + text label together.
 */
export default function TaxHealthGauge({
  score,
  mode = 'expanded',
  label,
  accessibilityLabel,
}: TaxHealthGaugeProps): React.ReactElement {
  const clampedScore = Math.max(0, Math.min(100, score));
  const arcPath = useMemo(() => buildArcPath(clampedScore), [clampedScore]);
  const trackPath = useMemo(() => buildTrackPath(), []);
  const color = scoreToColor(clampedScore);
  const displayLabel = label ?? scoreToLabel(clampedScore);

  const isCompact = mode === 'compact';
  const svgSize = isCompact ? 140 : SIZE;
  const scale = svgSize / SIZE;

  return (
    <View
      style={[styles.container, isCompact && styles.containerCompact]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clampedScore }}
      accessibilityLabel={
        accessibilityLabel ?? `Tax health score: ${clampedScore} out of 100. ${displayLabel}.`
      }
    >
      {/* C-13: SVG arc — no ProgressBar */}
      <Svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={styles.svg}
      >
        {/* Track arc (background) */}
        <Path
          d={trackPath}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Score arc (foreground) */}
        <Path
          d={arcPath}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Centre score text — C-15: numeric cue in addition to colour */}
        <SvgText
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isCompact ? 28 * scale : 36}
          fontWeight="700"
          fill="#111827"
        >
          {Math.round(clampedScore)}
        </SvgText>

        {/* Unit label */}
        <SvgText
          x={CX}
          y={CY + (isCompact ? 22 * scale : 28)}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isCompact ? 10 * scale : 12}
          fill="#6B7280"
        >
          / 100
        </SvgText>
      </Svg>

      {/* C-15: Text label below arc — never colour-only */}
      <View style={[styles.labelRow, isCompact && styles.labelRowCompact]}>
        {/* Shape cue: coloured circle dot */}
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{displayLabel}</Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  containerCompact: {
    paddingVertical: 8,
  },
  svg: {
    overflow: 'visible',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  labelRowCompact: {
    marginTop: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
