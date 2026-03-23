import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, completeOptionalFlow } from './shared';
import { palette, radius, spacing, typography } from '../../components/design-system/tokens';

export default function CommunityScreen() {
  const { t } = useTranslation();

  return (
    <OnboardingFrame
      stepId="community"
      title={t('onboarding.community.title')}
      body={t('onboarding.community.body')}
      primaryLabel={t('onboarding.finish')}
      secondaryLabel={t('onboarding.skipAll')}
      onPrimary={() => void completeOptionalFlow()}
      onSecondary={() => void completeOptionalFlow()}
    >
      <View style={{ backgroundColor: palette.gray50, borderRadius: radius.xl, padding: spacing.lg }}>
        <Text style={{ ...typography.bodyBold, color: palette.gray900 }}>{t('onboarding.community.shareLabel')}</Text>
      </View>
    </OnboardingFrame>
  );
}
