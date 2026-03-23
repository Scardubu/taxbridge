import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function VatSetupScreen() {
  const { t } = useTranslation();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const exempt = turnover <= 100_000_000;

  return (
    <OnboardingFrame
      stepId="vat-setup"
      title={t('onboarding.vatSetup.title')}
      body={exempt ? t('onboarding.vatSetup.exemptBody') : t('onboarding.vatSetup.requiredBody')}
      onPrimary={() => void advanceToNext('vat-setup')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void advanceToNext('vat-setup')}
    >
      <View style={{ backgroundColor: palette.gray50, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.h3, color: palette.gray900 }}>{exempt ? t('onboarding.vatSetup.exemptTitle') : t('onboarding.vatSetup.title')}</Text>
        <Text style={{ ...typography.body, color: palette.gray600 }}>{t('onboarding.vatSetup.rate')}</Text>
      </View>
    </OnboardingFrame>
  );
}
