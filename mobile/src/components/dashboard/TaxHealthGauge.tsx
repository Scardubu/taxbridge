/**
 * TaxHealthGauge — TaxBridge V13 Sovereign
 *
 * C-13: SVG arc gauge only — ProgressBar is NEVER a substitute
 * C-19: Anomaly empty: empty={null} — never render "No anomalies"
 *
 * 230° SVG arc. Score animates with withTiming + gauge easing.
 * computeGaugeMode exported — imported by DashboardScreen (C-20).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { DURATION, EASE } from '../../design-system/animation';
import { formatNGN } from '../../design-system/ngn';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ARC_SIZE    = 200;
const CENTER      = ARC_SIZE / 2;
const RADIUS      = 80;
const STROKE_W    = 16;
const ARC_DEGREES = 230;
const START_DEG   = -125; // degrees from top

/** Convert polar coordinates to SVG path point */
function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * buildArcPath — SVG arc descriptor for the gauge needle arc.
 * 'worklet' directive: runs on the UI thread.
 */
function buildArcPath(score: number): string {
  'worklet';
  const sweepDeg  = (Math.max(0, Math.min(100, score)) / 100) * ARC_DEGREES;
  const start     = polarToXY(CENTER, CENTER, RADIUS, START_DEG);
  const end       = polarToXY(CENTER, CENTER, RADIUS, START_DEG + sweepDeg);
  const largeArc  = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * scoreToStroke — color based on score band.
 * 'worklet' directive: runs on the UI thread.
 */
function scoreToStroke(score: number): string {
  'worklet';
  if (score >= 70) return '#22C55E'; // green
  if (score >= 40) return '#F59E0B'; // amber
  return '#EF4444';                  // red
}

export type GaugeMode = 'healthy' | 'warning' | 'critical' | 'loading';

/**
 * computeGaugeMode — exported; imported by DashboardScreen.
 * C-20: Never inline in DashboardScreen.
 */
export function computeGaugeMode(data: { score?: number; isLoading?: boolean }): GaugeMode {
  if (data.isLoading) return 'loading';
  const s = data.score ?? 0;
  if (s >= 70) return 'healthy';
  if (s >= 40) return 'warning';
  return 'critical';
}

interface TaxHealthGaugeProps {
  score:     number;
  isLoading?: boolean;
}

export function TaxHealthGauge({ score, isLoading = false }: TaxHealthGaugeProps) {
  const animatedScore = useSharedValue(0);

  React.useEffect(() => {
    animatedScore.value = withTiming(score, {
      duration: DURATION.slow,
      easing:   EASE.gauge,
    });
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    d:           buildArcPath(animatedScore.value),
    stroke:      scoreToStroke(animatedScore.value),
  }));

  // Track arc (background)
  const trackEnd  = polarToXY(CENTER, CENTER, RADIUS, START_DEG + ARC_DEGREES);
  const trackStart = polarToXY(CENTER, CENTER, RADIUS, START_DEG);
  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${RADIUS} ${RADIUS} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  const mode = computeGaugeMode({ score, isLoading });

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Tax health score: ${score} out of 100. Status: ${mode}`}
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
      <Svg width={ARC_SIZE} height={ARC_SIZE}>
        {/* Track */}
        <Path
          d={trackPath}
          stroke="#E5E7EB"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          fill="none"
        />
        {/* Animated score arc */}
        <AnimatedPath
          animatedProps={animatedProps}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          fill="none"
        />
        {/* Center score text */}
      </Svg>
      {!isLoading && (
        <View style={styles.centerLabel}>
          <Text style={styles.scoreText}>{Math.round(score)}</Text>
          <Text style={styles.scoreUnit}>/ 100</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    position:       'relative',
    width:          ARC_SIZE,
    height:         ARC_SIZE,
  },
  centerLabel: {
    position:       'absolute',
    alignItems:     'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize:   36,
    fontWeight: '700',
    color:      '#111827',
  },
  scoreUnit: {
    fontSize:  13,
    color:     '#6B7280',
    marginTop: 2,
  },
});
