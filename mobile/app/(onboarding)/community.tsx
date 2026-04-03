import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, completeOptionalFlow, skipSetupForNow } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';

export default function CommunityScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();

  return (
    <OnboardingFrame
      stepId="community"
      title={t('onboarding.community.title')}
      body={t('onboarding.community.body')}
      primaryLabel={t('onboarding.finish')}
      secondaryLabel={t('onboarding.community.skipCta')}
      onPrimary={() => void completeOptionalFlow()}
      onSecondary={() => void skipSetupForNow()}
    >
      <View style={{ backgroundColor: `${palette.nrsGreen}12`, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: `${palette.nrsGreen}30`, gap: spacing.sm }}>
        <Text style={{ fontSize: 22 }}>🏆</Text>
        <Text style={{ ...typography.bodyBold, color: palette.nrsGreen }}>{t('onboarding.community.shareLabel')}</Text>
        <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('onboarding.community.shareBody')}</Text>
      </View>
      <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('onboarding.community.benefitTitle')}</Text>
        <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('onboarding.community.benefitBody')}</Text>
      </View>
    </OnboardingFrame>
  );
}
