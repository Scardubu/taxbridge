import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

const OPTION_VALUES = ['sole_trader', 'partnership', 'limited_company', 'ngo'] as const;
type BusinessTypeValue = typeof OPTION_VALUES[number];

export default function BusinessTypeScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const saved = useBusinessProfileStore((state) => state.businessType);
  const updateField = useBusinessProfileStore((state) => state.updateField);
  const [selected, setSelected] = useState<BusinessTypeValue>(
    (OPTION_VALUES as readonly string[]).includes(saved) ? (saved as BusinessTypeValue) : 'sole_trader'
  );

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
        {OPTION_VALUES.map((value) => {
          const active = selected === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSelected(value)}
              accessibilityRole="button"
              accessibilityLabel={t(`onboarding.businessType.options.${value}`)}
              accessibilityState={{ selected: active }}
              style={{
                backgroundColor: active ? palette.nrsGreen : tokens.bgCard,
                borderColor: active ? palette.nrsGreen : tokens.border,
                borderWidth: 1,
                borderRadius: radius.xl,
                padding: spacing.lg,
              }}
            >
              <Text
                style={{ ...typography.bodyBold, color: active ? palette.white : tokens.textPrimary }}
              >
                {t(`onboarding.businessType.options.${value}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}
