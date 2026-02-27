/**
 * DashboardZone — V10.3 Zone Choreography Wrapper
 *
 * C-17: DashboardScreen MUST contain all 5 zones: apex, signal, action, context, ambient.
 * C-18: Every dashboard section must be wrapped in <DashboardZone>.
 * ER-07: Staggered reveal with per-zone animation config.
 *
 * Zone stagger delays (default):
 *   apex:    0ms   — scale(0.92→1) + opacity(0→1)
 *   signal:  80ms  — translateY(12→0) + opacity(0→1)
 *   action:  160ms — translateY(12→0) + opacity(0→1)
 *   context: 240ms — translateY(12→0) + opacity(0→1)  [0ms when urgent=true]
 *   ambient: 320ms — opacity(0→1) only
 */

import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  DURATION,
  EASE,
  ENTER_FROM,
  ZONE_DELAYS,
  type ZoneName,
} from '../../design-system/animation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardZoneName = ZoneName;

interface ZoneConfig {
  delay:     number;
  from:      keyof typeof ENTER_FROM;
  duration:  number;
}

/* eslint-disable @typescript-eslint/consistent-type-assertions */
const ZONE_CONFIG: Record<DashboardZoneName, ZoneConfig> = {
  apex:    { delay: ZONE_DELAYS.apex,    from: 'scale', duration: DURATION.standard  },
  signal:  { delay: ZONE_DELAYS.signal,  from: 'below', duration: DURATION.standard  },
  action:  { delay: ZONE_DELAYS.action,  from: 'below', duration: DURATION.standard  },
  context: { delay: ZONE_DELAYS.context, from: 'below', duration: DURATION.standard  },
  ambient: { delay: ZONE_DELAYS.ambient, from: 'fade',  duration: DURATION.deliberate },
};

export interface DashboardZoneProps {
  /** One of the 5 named zones — determines default stagger delay and entry direction */
  zone: DashboardZoneName;
  /**
   * True when data has arrived and isLoading === false.
   * Zone is hidden (opacity 0) until visible=true.
   */
  visible: boolean;
  /**
   * Urgent override — collapses delay to 0ms and uses EASE.urgent (e.g. high-severity anomaly).
   * Context zone uses this to bubble to top of render order.
   */
  urgent?: boolean;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardZone({
  zone,
  visible,
  urgent = false,
  children,
}: DashboardZoneProps) {
  const config   = ZONE_CONFIG[zone];
  const from     = ENTER_FROM[config.from];

  // Shared animation values
  const opacity     = useSharedValue(0);
  const translateY  = useSharedValue('translateY' in from ? (from as { translateY: number }).translateY : 0);
  const scale       = useSharedValue('scale' in from ? (from as { scale: number }).scale : 1);

  useEffect(() => {
    if (!visible) return;

    const delay    = urgent ? 0 : config.delay;
    const duration = urgent ? DURATION.fast : config.duration;
    const easing   = urgent ? EASE.urgent   : EASE.enter;

    opacity.value     = withDelay(delay, withTiming(1,  { duration, easing }));
    translateY.value  = withDelay(delay, withTiming(0,  { duration, easing }));
    scale.value       = withDelay(delay, withTiming(1,  { duration, easing }));
  }, [visible, urgent]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale:      scale.value      },
    ],
  }));

  return (
    <Animated.View style={animStyle}>
      {children}
    </Animated.View>
  );
}

export default DashboardZone;
