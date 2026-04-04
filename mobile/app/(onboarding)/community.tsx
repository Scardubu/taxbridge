import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, InfoCard, completeOptionalFlow, skipSetupForNow } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { STEPS, useOnboardingStore } from '../../stores/onboardingStore';

const CHECKLIST_ICONS: Record<string, string> = {
  welcome: '🇳🇬',
  'business-type': '🏢',
  'tin-verify': '🔐',
  'vat-setup': '📊',
  einvoice: '🧾',
};

export default function CommunityScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const completedSteps = useOnboardingStore((state) => state.completedSteps);

  // Steps the user completed before reaching this screen
  const previousSteps = STEPS.filter((s) => s.id !== 'community');

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
      {/* Celebration header */}
      <View
        style={{
          backgroundColor: palette.nrsGreenLight,
          borderRadius: radius.xl,
          padding: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: `${palette.nrsGreen}20`,
        }}
      >
        <Text style={{ fontSize: 48 }}>🎉</Text>
        <Text style={{ ...typography.h2, color: palette.nrsGreenDim, textAlign: 'center' }}>
          {t('onboarding.community.congratsTitle')}
        </Text>
        <Text style={{ ...typography.body, color: palette.gray600, textAlign: 'center', lineHeight: 22 }}>
          {t('onboarding.community.congratsBody')}
        </Text>
      </View>

      {/* Setup summary checklist */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
          {t('onboarding.community.summaryTitle')}
        </Text>
        {previousSteps.map((step) => {
          const done = completedSteps.includes(step.id);
          return (
            <View
              key={step.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: tokens.bgCard,
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: done ? `${palette.nrsGreen}20` : tokens.border,
              }}
            >
              <Text style={{ fontSize: 16 }}>{CHECKLIST_ICONS[step.id] ?? '📋'}</Text>
              <Text
                style={{
                  ...typography.body,
                  color: done ? tokens.textPrimary : tokens.textMuted,
                  flex: 1,
                  textDecorationLine: done ? 'none' : 'line-through',
                }}
              >
                {t(step.titleKey)}
              </Text>
              {done ? (
                <Ionicons name="checkmark-circle" size={20} color={palette.shield} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={tokens.textMuted} />
              )}
            </View>
          );
        })}
      </View>

      {/* Compliance badge share */}
      <View
        style={{
          backgroundColor: `${palette.nrsGold}15`,
          borderRadius: radius.xl,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: `${palette.nrsGold}30`,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 22 }}>🏆</Text>
          <Text style={{ ...typography.bodyBold, color: palette.gray900 }}>{t('onboarding.community.shareLabel')}</Text>
        </View>
        <Text style={{ ...typography.body, color: tokens.textSecondary, lineHeight: 22 }}>{t('onboarding.community.shareBody')}</Text>
      </View>

      {/* Community perks */}
      <InfoCard
        variant="info"
        icon="🤝"
        title={t('onboarding.community.benefitTitle')}
        body={t('onboarding.community.benefitBody')}
      />
    </OnboardingFrame>
  );
}
