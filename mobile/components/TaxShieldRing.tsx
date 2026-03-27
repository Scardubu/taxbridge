import React from 'react';
import { View, Text } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { palette } from './design-system/tokens';

// Blueprint v6: Keyframe entrance is allowed (Reanimated 4.1 Keyframe API).
// C-02 fix: glow pulse uses CSS transitions only — no withRepeat/withTiming.
const entrance = new Keyframe({
  0:   { transform: [{ scale: 0.8 }], opacity: 0 },
  70:  { transform: [{ scale: 1.05 }] },
  100: { transform: [{ scale: 1 }], opacity: 1 },
}).duration(600);

interface Props {
  compliance: number;
  isStreaking: boolean;
  size?: number;
}

export function TaxShieldRing({ compliance, isStreaking, size = 128 }: Props) {
  const color = compliance >= 80 ? palette.shield : compliance >= 50 ? palette.warning : palette.danger;
  const arcRadius = size / 2 - 8;
  const circumference = 2 * Math.PI * arcRadius;
  const filled = (compliance / 100) * circumference;
  const center = size / 2;

  // CSS transition for glow — opacity and shadowOpacity animate via New Arch interop
  const glowStyle = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: color,
    shadowColor: color,
    shadowRadius: 20,
    opacity: isStreaking ? 0.85 : 0,
    shadowOpacity: isStreaking ? 0.7 : 0,
    transitionProperty: ['opacity', 'shadowOpacity'],
    transitionDuration: 900,
    transitionTimingFunction: 'ease-in-out',
  } as any;

  return (
    <Animated.View
      entering={entrance}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={glowStyle} />
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={`${color}AA`} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={center} cy={center} r={arcRadius}
          stroke={palette.gray100} strokeWidth={8} fill="transparent"
        />
        <Circle
          cx={center} cy={center} r={arcRadius}
          stroke="url(#grad)" strokeWidth={8}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round" fill="transparent"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color }}>{compliance}%</Text>
        <Text style={{ fontSize: 11, color: palette.gray400 }}>Protected</Text>
      </View>
      {isStreaking ? (
        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: '#FF6D00', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, color: '#fff' }}>🔥</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
