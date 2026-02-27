/**
 * TaxBridge — TaxExplainDrawer (P7 Quick Win)
 *
 * Inline bottom-sheet drawer explaining the tax breakdown
 * on the AI forecast card. Opens on "Why?" tap without navigation.
 *
 * Feature flag: taxExplainDrawer
 *
 * Constraints:
 *   C-06  All strings via i18n (en + pidgin)
 *   C-09  No inline tax calculations — labels only
 *   C-16  All animations use DURATION.* + EASE.*
 *   C-20  scale(0.97) ack on Pressable triggers
 *   CF-04 useTheme() for all colors
 *   CF-15 Status indicators: color + shape + text
 */

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, ScrollView,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@hooks/useTheme';
import { typography, spacing, radii, shadows } from '@ds/tokens';
import { DURATION } from '@ds/animation';

// ─── Types ────────────────────────────────────────────────────────────────

interface TaxBreakdownItem {
  key:    string;
  label:  string;
  amount: number;
  /** Percentage of total liability */
  pct:    number;
}

interface TaxExplainDrawerProps {
  /** Whether the drawer is visible */
  visible:   boolean;
  /** Close callback */
  onClose:   () => void;
  /** Tax breakdown items from forecast */
  breakdown: TaxBreakdownItem[];
  /** Total forecasted liability */
  total:     number;
  /** Confidence score 0–1 */
  confidence: number;
}

// ─── Severity → shape mapping (CF-15) ─────────────────────────────────────

function getPctIndicator(pct: number): { glyph: string; severity: string } {
  if (pct >= 50) return { glyph: '▲', severity: 'high' };
  if (pct >= 20) return { glyph: '■', severity: 'medium' };
  return { glyph: '●', severity: 'low' };
}

// ─── Component ────────────────────────────────────────────────────────────

export function TaxExplainDrawer({
  visible,
  onClose,
  breakdown,
  total,
  confidence,
}: TaxExplainDrawerProps) {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel={t('common.close')}
        accessibilityRole="button"
      >
        <Animated.View entering={FadeIn.duration(DURATION.fast)} style={styles.backdropOverlay} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.duration(DURATION.standard).springify()}
        style={[styles.sheet, { backgroundColor: colors.surface }]}
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            🤖 {t('taxExplain.title')}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Total */}
          <View style={[styles.totalRow, { backgroundColor: colors.primaryBgSubtle }]}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              {t('taxExplain.totalLiability')}
            </Text>
            <Text style={[styles.totalAmount, { color: colors.textPrimary }]}>
              ₦{Math.round(total).toLocaleString('en-NG')}
            </Text>
          </View>

          {/* Breakdown items */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('taxExplain.breakdownTitle')}
          </Text>

          {breakdown.map((item) => {
            const indicator = getPctIndicator(item.pct);
            const severityColor = indicator.severity === 'high'
              ? colors.error
              : indicator.severity === 'medium'
              ? colors.warning
              : colors.success;

            return (
              <View key={item.key} style={[styles.breakdownRow, { borderColor: colors.border }]}>
                <View style={styles.breakdownLeft}>
                  {/* CF-15: shape + color + text */}
                  <Text style={[styles.breakdownGlyph, { color: severityColor }]}>
                    {indicator.glyph}
                  </Text>
                  <View>
                    <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.breakdownPct, { color: colors.textMuted }]}>
                      {item.pct.toFixed(1)}% {t('taxExplain.ofTotal')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.breakdownAmount, { color: colors.textPrimary }]}>
                  ₦{Math.round(item.amount).toLocaleString('en-NG')}
                </Text>
              </View>
            );
          })}

          {/* Confidence */}
          <View style={[styles.confidenceRow, { backgroundColor: colors.infoBgSubtle }]}>
            <Text style={[styles.confidenceLabel, { color: colors.textSecondary }]}>
              {t('taxExplain.confidenceLabel')}
            </Text>
            <Text style={[styles.confidenceValue, { color: colors.info }]}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            {t('taxExplain.disclaimer')}
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Trigger Button (used inside TaxForecastCard) ─────────────────────────

export function TaxExplainTrigger({ onPress }: { onPress: () => void }) {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trigger,
        { borderColor: colors.primary },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('taxExplain.whyButton')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.triggerText, { color: colors.primary }]}>
        {t('taxExplain.whyButton')}
      </Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: radii.modal,
    borderTopRightRadius: radii.modal,
    paddingBottom: spacing[8],
    maxHeight: '70%',
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.cardPadding,
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: typography.sizes.xl,
  },
  body: {
    paddingHorizontal: spacing.cardPadding,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.md,
    marginBottom: spacing[4],
  },
  totalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  totalAmount: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.extrabold,
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flex: 1,
  },
  breakdownGlyph: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
  breakdownLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  breakdownPct: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  breakdownAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    fontVariant: ['tabular-nums'],
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.md,
    marginTop: spacing[4],
  },
  confidenceLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  confidenceValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  disclaimer: {
    fontSize: typography.sizes.xs,
    lineHeight: typography.sizes.xs * typography.lineHeights.relaxed,
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  trigger: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
