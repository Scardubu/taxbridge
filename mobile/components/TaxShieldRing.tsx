import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { Keyframe, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { palette } from './design-system/tokens';

const entrance = new Keyframe({
  0: { transform: [{ scale: 0.8 }], opacity: 0 },
  70: { transform: [{ scale: 1.05 }] },
  100: { transform: [{ scale: 1 }], opacity: 1 },
}).duration(600);

interface Props {
  compliance: number;
  isStreaking: boolean;
  size?: number;
}

export function TaxShieldRing({ compliance, isStreaking, size = 128 }: Props) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = isStreaking
      ? withRepeat(
          withSequence(withTiming(0.9, { duration: 900 }), withTiming(0.3, { duration: 900 })),
          -1,
          true
        )
      : withTiming(0, { duration: 300 });
  }, [glow, isStreaking]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    shadowOpacity: glow.value * 0.8,
  }));

  const color = compliance >= 80 ? palette.shield : compliance >= 50 ? palette.warning : palette.danger;
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const filled = (compliance / 100) * circumference;
  const center = size / 2;

  return (
    <Animated.View entering={entrance} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, shadowColor: color, shadowRadius: 20 }, glowStyle]} />
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={`${color}AA`} />
          </LinearGradient>
        </Defs>
        <Circle cx={center} cy={center} r={radius} stroke={palette.gray100} strokeWidth={8} fill="transparent" />
        <Circle cx={center} cy={center} r={radius} stroke="url(#grad)" strokeWidth={8} strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" fill="transparent" transform={`rotate(-90 ${center} ${center})`} />
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
