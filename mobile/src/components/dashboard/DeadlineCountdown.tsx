/**
 * TaxBridge — DeadlineCountdown (P7 Quick Win)
 *
 * Visual countdown pip for the most urgent upcoming deadline.
 * Shows days/hours remaining with urgency-based color coding.
 *
 * Feature flag: deadlineCountdown
 *
 * Constraints:
 *   C-06  All strings via i18n
 *   C-16  Animations use DURATION.* + EASE.*
 *   CF-04 useTheme() for all colors
 *   CF-15 Status: color + shape + text (never color alone)
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@hooks/useTheme';
import { typography, spacing, radii, shadows } from '@ds/tokens';
import { DURATION } from '@ds/animation';

// ─── Types ────────────────────────────────────────────────────────────────

interface DeadlineCountdownProps {
  /** Days remaining (negative = overdue) */
  daysRemaining: number;
  /** Tax type label e.g. "VAT Return" */
  taxType:       string;
  /** ISO date string */
  dueDate:       string;
  /** Navigate to filing action */
  onPress?:      () => void;
}

// ─── Urgency tiers (CF-15: shape + color + text) ─────────────────────────

function getUrgencyTier(days: number) {
  if (days < 0) return { glyph: '▲', tier: 'overdue' as const, pulseSpeed: DURATION.fast };
  if (days <= 3) return { glyph: '▲', tier: 'critical' as const, pulseSpeed: DURATION.standard };
  if (days <= 7) return { glyph: '■', tier: 'warning' as const, pulseSpeed: DURATION.medium };
  if (days <= 14) return { glyph: '●', tier: 'upcoming' as const, pulseSpeed: DURATION.slow };
  return { glyph: '●', tier: 'planned' as const, pulseSpeed: DURATION.slow };
}

// ─── Component ────────────────────────────────────────────────────────────

export function DeadlineCountdown({
  daysRemaining,
  taxType,
  dueDate,
  onPress,
}: DeadlineCountdownProps) {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  const urgency = useMemo(() => getUrgencyTier(daysRemaining), [daysRemaining]);

  const tierColors = useMemo(() => {
    switch (urgency.tier) {
      case 'overdue':
        return { bg: colors.errorBgSubtle, accent: colors.error, text: colors.errorDark, border: colors.errorBorder };
      case 'critical':
        return { bg: colors.errorBgSubtle, accent: colors.error, text: colors.errorDark, border: colors.errorBorder };
      case 'warning':
        return { bg: colors.warningBgSubtle, accent: colors.warning, text: colors.warningDark, border: colors.warningBorder };
      case 'upcoming':
        return { bg: colors.infoBgSubtle, accent: colors.info, text: colors.infoDark, border: colors.infoBorder };
      default:
        return { bg: colors.neutralBgSubtle, accent: colors.primary, text: colors.textSecondary, border: colors.neutralBorder };
    }
  }, [urgency.tier, colors]);

  const countdownLabel = daysRemaining < 0
    ? `${Math.abs(daysRemaining)} ${t('deadline.daysOverdue')}`
    : daysRemaining === 0
    ? t('deadline.dueToday')
    : daysRemaining === 1
    ? t('deadline.dueTomorrow')
    : `${daysRemaining} ${t('deadline.daysLeft')}`;

  const statusLabel = urgency.tier === 'overdue'
    ? t('common.overdue')
    : urgency.tier === 'critical'
    ? t('deadline.actNow')
    : urgency.tier === 'warning'
    ? t('common.urgent')
    : t('common.upcoming');

  const a11yLabel = `${taxType}. ${countdownLabel}. ${statusLabel}`;

  return (
    <Animated.View entering={FadeIn.duration(DURATION.entrance)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: tierColors.bg,
            borderColor: tierColors.border,
          },
          pressed && onPress && { transform: [{ scale: 0.97 }], opacity: 0.9 },
        ]}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={a11yLabel}
      >
        {/* Left: countdown number */}
        <View style={[styles.countBadge, { backgroundColor: tierColors.accent }]}>
          <Text style={styles.countNumber}>
            {daysRemaining < 0 ? Math.abs(daysRemaining) : daysRemaining}
          </Text>
          <Text style={styles.countUnit}>
            {t('deadline.days')}
          </Text>
        </View>

        {/* Center: tax type + due date */}
        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text style={[styles.glyph, { color: tierColors.accent }]}>
              {urgency.glyph}
            </Text>
            <Text style={[styles.taxType, { color: colors.textPrimary }]} numberOfLines={1}>
              {taxType}
            </Text>
          </View>
          <Text style={[styles.dueDate, { color: colors.textMuted }]}>
            {t('common.dueOn')} {dueDate}
          </Text>
          {/* CF-15: text label channel */}
          <Text style={[styles.status, { color: tierColors.text }]}>
            {urgency.glyph} {statusLabel}
          </Text>
        </View>

        {/* Right: action hint */}
        {onPress && (
          <Text style={[styles.arrow, { color: tierColors.accent }]}>→</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    padding: spacing[3],
    borderWidth: 1,
    gap: spacing[3],
    marginBottom: spacing[2],
    minHeight: 44,
  },
  countBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.extrabold,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  countUnit: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  glyph: {
    fontSize: 12,
    fontWeight: '700',
  },
  taxType: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  dueDate: {
    fontSize: typography.sizes.xs,
  },
  status: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  arrow: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
});
