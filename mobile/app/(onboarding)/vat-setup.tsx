import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext, skipSetupForNow } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function VatSetupScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const exempt = turnover <= 100_000_000;

  return (
    <OnboardingFrame
      stepId="vat-setup"
      title={t('onboarding.vatSetup.title')}
      body={exempt ? t('onboarding.vatSetup.exemptBody') : t('onboarding.vatSetup.requiredBody')}
      onPrimary={() => void advanceToNext('vat-setup')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void skipSetupForNow()}
    >
      <View style={{ backgroundColor: exempt ? `${palette.nrsGreen}12` : palette.gray50, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: exempt ? `${palette.nrsGreen}30` : tokens.border }}>
        <Text style={{ fontSize: 20 }}>{exempt ? '✅' : '📝'}</Text>
        <Text style={{ ...typography.h3, color: exempt ? palette.nrsGreen : palette.gray900 }}>{exempt ? t('onboarding.vatSetup.exemptTitle') : t('onboarding.vatSetup.title')}</Text>
        <Text style={{ ...typography.body, color: palette.gray600 }}>{t('onboarding.vatSetup.rate')}</Text>
      </View>
      <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('onboarding.vatSetup.educationTitle')}</Text>
        <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('onboarding.vatSetup.educationBody')}</Text>
      </View>
    </OnboardingFrame>
  );
}
