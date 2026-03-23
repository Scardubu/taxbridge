import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography } from '../../components/design-system/tokens';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <OnboardingFrame
      stepId="welcome"
      title={t('onboarding.welcome.headline')}
      body={t('onboarding.welcome.subheadline')}
      primaryLabel={t('onboarding.welcome.cta')}
      onPrimary={() => void advanceToNext('welcome')}
    >
      <View style={{ backgroundColor: palette.gray50, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.h3, color: palette.gray900 }}>NRS-ready mobile workflows</Text>
        <Text style={{ ...typography.body, color: palette.gray600 }}>Secure onboarding, offline queueing, and tax-aware guidance built for Nigerian businesses.</Text>
      </View>
    </OnboardingFrame>
  );
}
