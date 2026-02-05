import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface AnimatedTaxBracketProps {
  industry: string | null;
  annualTurnover: number | null;
  vatRegistered: boolean | null;
}

type VatStatus = 'mandatory' | 'approaching' | 'exempt';

const VAT_THRESHOLD = 100_000_000;
const VAT_APPROACHING = 80_000_000;

const INDUSTRY_MAP: Record<string, string> = {
  retail: 'onboarding.profile.industryRetailHint',
  services: 'onboarding.profile.industryServicesHint',
  manufacturing: 'onboarding.profile.industryManufacturingHint',
  technology: 'onboarding.profile.industryTechnologyHint',
  agriculture: 'onboarding.profile.industryAgricultureHint',
  other: 'onboarding.profile.industryOtherHint',
};

export const AnimatedTaxBracket = memo<AnimatedTaxBracketProps>(({
  industry,
  annualTurnover,
  vatRegistered,
}) => {
  const { t } = useTranslation();

  const vatStatus: VatStatus = useMemo(() => {
    if (vatRegistered) return 'mandatory';

    const turnover = annualTurnover ?? 0;
    if (turnover >= VAT_THRESHOLD) return 'mandatory';
    if (turnover >= VAT_APPROACHING) return 'approaching';
    return 'exempt';
  }, [annualTurnover, vatRegistered]);

  const statusLabel = useMemo(() => {
    switch (vatStatus) {
      case 'mandatory':
        return t('tax.vatStatusMandatory');
      case 'approaching':
        return t('tax.vatStatusApproaching');
      default:
        return t('tax.vatStatusExempt');
    }
  }, [t, vatStatus]);

  const statusColor = useMemo(() => {
    switch (vatStatus) {
      case 'mandatory':
        return colors.error;
      case 'approaching':
        return colors.warning;
      default:
        return colors.success;
    }
  }, [vatStatus]);

  const hintKey = industry ? INDUSTRY_MAP[industry] : null;

  return (
    <Animated.View style={styles.container} entering={FadeInUp.delay(150).springify()}>
      <Text style={styles.title}>{t('onboarding.profile.taxFocusTitle')}</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        <Text style={styles.statusHint}>
          {vatStatus === 'mandatory'
            ? t('tax.vatDisclaimerMandatory')
            : t('tax.vatDisclaimerEstimate')}
        </Text>
      </View>

      <View style={styles.focusCard}>
        <Text style={styles.focusLabel}>{t('onboarding.profile.industryFocus')}</Text>
        <Text style={styles.focusValue}>
          {hintKey ? t(hintKey) : t('onboarding.profile.industryFocusDefault')}
        </Text>
      </View>
    </Animated.View>
  );
});

AnimatedTaxBracket.displayName = 'AnimatedTaxBracket';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statusRow: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  statusHint: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  focusCard: {
    backgroundColor: colors.surfaceSlate,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  focusLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  focusValue: {
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});
