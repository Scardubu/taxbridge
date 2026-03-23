import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

const OPTIONS = [
  { label: 'Sole trader', value: 'sole_trader' },
  { label: 'Partnership', value: 'partnership' },
  { label: 'Limited company', value: 'limited_company' },
  { label: 'NGO', value: 'ngo' },
] as const;

export default function BusinessTypeScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const saved = useBusinessProfileStore((state) => state.businessType);
  const updateField = useBusinessProfileStore((state) => state.updateField);
  const [selected, setSelected] = useState(saved || 'sole_trader');

  return (
    <OnboardingFrame
      stepId="business-type"
      title={t('onboarding.businessType.title')}
      body={t('onboarding.businessType.subtitle')}
      onPrimary={() => {
        updateField('businessType', selected);
        void advanceToNext('business-type');
      }}
    >
      <View style={{ gap: spacing.sm }}>
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSelected(option.value)}
              style={{
                backgroundColor: active ? palette.nrsGreen : tokens.bgCard,
                borderColor: active ? palette.nrsGreen : tokens.border,
                borderWidth: 1,
                borderRadius: radius.xl,
                padding: spacing.lg,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: active ? palette.white : tokens.textPrimary }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}
