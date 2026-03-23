import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function EInvoiceScreen() {
  const { t } = useTranslation();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const phaseText = turnover >= 5_000_000_000
    ? t('onboarding.einvoice.phaseLarge')
    : turnover >= 1_000_000_000
      ? t('onboarding.einvoice.phaseMedium')
      : t('onboarding.einvoice.phaseSmall');

  return (
    <OnboardingFrame
      stepId="einvoice"
      title={t('onboarding.einvoice.title')}
      body={phaseText}
      onPrimary={() => void advanceToNext('einvoice')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void advanceToNext('einvoice')}
    >
      <View style={{ backgroundColor: palette.gray50, borderRadius: radius.xl, padding: spacing.lg }}>
        <Text style={{ ...typography.body, color: palette.gray600 }}>{t('onboarding.einvoice.platform')}</Text>
      </View>
    </OnboardingFrame>
  );
}
