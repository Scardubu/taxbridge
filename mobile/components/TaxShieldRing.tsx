import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors } from './design-system/tokens';

// Blueprint v8 — SVG arc path, score-driven colour, no Reanimated.
// CONSTRAINT-11: step-UI transitions are CSS-only; this is a data-display
// component with no animated transitions, so Reanimated is not needed here.

interface TaxShieldRingProps {
  score: number;   // 0–100
  size?: number;   // default 88
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const sx = cx + r * Math.cos(toRad(startAngle - 90));
  const sy = cy + r * Math.sin(toRad(startAngle - 90));
  const ex = cx + r * Math.cos(toRad(endAngle - 90));
  const ey = cy + r * Math.sin(toRad(endAngle - 90));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
}

function getRingColor(score: number): string {
  if (score >= 80) return Colors.shield.score100;
  if (score >= 50) return Colors.shield.score50;
  if (score >= 20) return Colors.shield.score20;
  return Colors.shield.score0;
}

export function TaxShieldRing({ score, size = 88 }: Readonly<TaxShieldRingProps>) {
  const safeScore = Math.max(0, Math.min(100, score));
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const strokeWidth = 7;
  const ringColor = getRingColor(safeScore);
  const endAngle = (safeScore / 100) * 360;
  const arcPath = safeScore > 0 ? describeArc(cx, cy, r, 0, Math.min(endAngle, 359.99)) : null;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        {/* Track ring */}
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={Colors.ui.border}
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        {arcPath ? (
          <Path
            d={arcPath}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      <Text
        style={{
          color: ringColor,
          fontSize: size * 0.27,
          fontWeight: '800',
          lineHeight: size * 0.3,
        }}
      >
        {safeScore}%
      </Text>
    </View>
  );
}
