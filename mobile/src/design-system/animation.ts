/**
 * TaxBridge Animation Vocabulary — V10.3
 *
 * C-16: All withTiming, withDelay, and withRepeat calls must use
 *       DURATION.* and EASE.* from this file. Raw numeric durations are
 *       FORBIDDEN outside this file.
 *
 * CI Gate:
 *   grep -rn "withTiming.*[0-9]\{3,4\}" mobile/src --include="*.ts" --include="*.tsx" \
 *     | grep -v "animation.ts"
 *   → must return 0 results
 */

import { Easing } from 'react-native-reanimated';

// ─── Duration Scale ──────────────────────────────────────────────────────────

export const DURATION = {
  /** Tap feedback scale pulse — must feel instant */
  instant:    100,
  /** Urgent zone override, mode switches */
  fast:       200,
  /** Step/page transitions — slight pause between states (Onboarding, wizards) */
  transition: 300,
  /** Widget/card entry fade-in — slightly longer for perceived quality */
  entrance:   350,
  /** Content entrance, layout changes, gauge compact/expanded resize */
  standard:   400,
  /** Camera/sensor pulse, moderate emphasis loops */
  medium:     500,
  /** Chart arc draw-in, sparkline draw-in */
  deliberate: 600,
  /** TaxHealthGauge arc sweep — emotional weight, do not rush */
  slow:       800,
  /** Secondary animated fills (progress bars, lesser gauges) */
  sweep:      900,
  /** DashboardSkeleton shimmer — tuned for 2G user patience. DO NOT CHANGE. */
  skeleton:   1200,
  /** Hero / ambient breathing loops (BrandedHero, LivingBridgeHeader) */
  breathe:    1500,
  /** Auto-dismissing toast notifications — standard reading time */
  toast:      4000,
  /** Important notifications — extended display for critical messages */
  notice:     5000,
} as const;

export type DurationKey = keyof typeof DURATION;

// ─── Easing Curves ────────────────────────────────────────────────────────────

export const EASE = {
  /** Standard content entrance */
  enter:     Easing.out(Easing.cubic),
  /** Content exit / dismiss */
  exit:      Easing.in(Easing.cubic),
  /** TaxHealthGauge arc sweep — smooth deceleration */
  gauge:     Easing.bezier(0.25, 0.46, 0.45, 0.94),
  /** Urgent alerts, circuit-open state — sharp snap */
  urgent:    Easing.bezier(0.36, 0.07, 0.19, 0.97),
  /** Skeleton shimmer — linear, even pulse */
  shimmer:   Easing.linear,
  /** Milestone celebrations, confetti reveals */
  celebrate: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export type EaseKey = keyof typeof EASE;

// ─── Entry Positions ─────────────────────────────────────────────────────────
// Initial state for DashboardZone enter animations.
// All values animate TO: { translateY: 0, scale: 1, opacity: 1 }

export const ENTER_FROM = {
  /** signal, action, context zones — slide up from below */
  below: { translateY: 12, opacity: 0 },
  /** apex zone — scale in from slightly smaller */
  scale: { scale: 0.92,   opacity: 0 },
  /** urgent alerts entering apex zone from above */
  above: { translateY: -8, opacity: 0 },
  /** ambient zone — fade only, no directional movement */
  fade:  { opacity: 0 },
} as const;

export type EnterFromKey = keyof typeof ENTER_FROM;

// ─── Zone Stagger Delays ──────────────────────────────────────────────────────
// Default delays for DashboardZone choreography.
// When urgent=true: override to 0, use DURATION.fast + EASE.urgent

export const ZONE_DELAYS = {
  apex:    0,
  signal:  80,
  action:  160,
  context: 240,
  ambient: 320,
} as const;

export type ZoneName = keyof typeof ZONE_DELAYS;

// ─── List / Band Stagger ──────────────────────────────────────────────────────
// Per-item stagger for list rows, band breakdowns, deadline cards.
// RULE-6: Raw ms values are only permitted in this file — import STAGGER.item
//         in component files instead of inlining numeric delays.

export const STAGGER = {
  /** Tight consecutive-item stagger (band rows, deadline cards, list rows) */
  item:    50,
  /** Wider group stagger (section reveals inside a zone) */
  section: 80,
} as const;

export type StaggerKey = keyof typeof STAGGER;
