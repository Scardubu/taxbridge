import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext, skipSetupForNow } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function EInvoiceScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const isLarge = turnover >= 5_000_000_000;
  let phaseText = t('onboarding.einvoice.phaseSmall');

  if (isLarge) {
    phaseText = t('onboarding.einvoice.phaseLarge');
  } else if (turnover >= 1_000_000_000) {
    phaseText = t('onboarding.einvoice.phaseMedium');
  }

  return (
    <OnboardingFrame
      stepId="einvoice"
      title={t('onboarding.einvoice.title')}
      body={phaseText}
      onPrimary={() => void advanceToNext('einvoice')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void skipSetupForNow()}
    >
      <View style={{ backgroundColor: isLarge ? `${palette.nrsRed}12` : palette.gray50, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: isLarge ? `${palette.nrsRed}30` : tokens.border }}>
        <Text style={{ fontSize: 20 }}>{isLarge ? '⚠️' : '🧾'}</Text>
        <Text style={{ ...typography.body, color: isLarge ? palette.nrsRed : palette.gray600 }}>{t('onboarding.einvoice.platform')}</Text>
      </View>
      <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('onboarding.einvoice.educationTitle')}</Text>
        <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('onboarding.einvoice.educationBody')}</Text>
      </View>
    </OnboardingFrame>
  );
}
