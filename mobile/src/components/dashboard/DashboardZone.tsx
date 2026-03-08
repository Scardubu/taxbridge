/**
 * DashboardZone — TaxBridge V13 Sovereign
 *
 * C-16: Animation tokens only — DURATION, EASE from animation.ts
 * C-17: DashboardScreen must have exactly 5 DashboardZone elements
 * C-18: Every dashboard content section in <DashboardZone zone="…" visible={!isLoading}>
 *
 * Zones:
 *   apex    — Tax Health Gauge (primary signal)
 *   signal  — Anomaly / Risk alerts
 *   action  — Quick Actions Grid
 *   context — Compliance Calendar, deadlines
 *   ambient — Offline sync status, NRS health
 */
import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { DURATION, EASE, ZONE_DELAYS } from '../../design-system/animation';

export type ZoneId = 'apex' | 'signal' | 'action' | 'context' | 'ambient';

interface DashboardZoneProps {
  zone:      ZoneId;
  visible:   boolean;
  urgent?:   boolean;
  children:  React.ReactNode;
}

/**
 * Zone animation delays per §12.
 * context zone delay → 0 when urgent=true
 */
const BASE_DELAY: Record<ZoneId, number> = {
  apex:    ZONE_DELAYS.apex,
  signal:  ZONE_DELAYS.signal,
  action:  ZONE_DELAYS.action,
  context: ZONE_DELAYS.context,
  ambient: ZONE_DELAYS.ambient,
};

export function DashboardZone({ zone, visible, urgent = false, children }: DashboardZoneProps) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const delay = zone === 'context' && urgent ? 0 : BASE_DELAY[zone];
    if (visible) {
      opacity.value    = withDelay(delay, withTiming(1, { duration: DURATION.standard, easing: EASE.enter }));
      translateY.value = withDelay(delay, withTiming(0, { duration: DURATION.standard, easing: EASE.enter }));
    } else {
      opacity.value    = withTiming(0, { duration: DURATION.fast });
      translateY.value = withTiming(12, { duration: DURATION.fast });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, urgent, zone]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
}
