import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, InfoCard, advanceToNext, skipSetupForNow } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

const OPTION_META = [
  { value: 'sole_trader', icon: '👤' },
  { value: 'partnership', icon: '🤝' },
  { value: 'limited_company', icon: '🏢' },
  { value: 'ngo', icon: '💚' },
] as const;
type BusinessTypeValue = typeof OPTION_META[number]['value'];
const OPTION_VALUES = OPTION_META.map((o) => o.value);

export default function BusinessTypeScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const saved = useBusinessProfileStore((state) => state.businessType);
  const savedTurnover = useBusinessProfileStore((state) => state.annualTurnover);
  const updateField = useBusinessProfileStore((state) => state.updateField);
  const [selected, setSelected] = useState<BusinessTypeValue>(
    (OPTION_VALUES as readonly string[]).includes(saved) ? (saved as BusinessTypeValue) : 'sole_trader'
  );
  const [turnover, setTurnover] = useState(savedTurnover ? String(savedTurnover) : '');

  const formatNaira = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('en-NG');
  };

  return (
    <OnboardingFrame
      stepId="business-type"
      title={t('onboarding.businessType.title')}
      body={t('onboarding.businessType.subtitle')}
      onPrimary={() => {
        updateField('businessType', selected);
        const numericTurnover = Number(turnover.replace(/[^0-9]/g, ''));
        if (numericTurnover > 0) {
          updateField('annualTurnover', numericTurnover);
        }
        void advanceToNext('business-type');
      }}
      secondaryLabel={t('onboarding.businessType.skipCta')}
      onSecondary={() => {
        updateField('businessType', selected);
        void skipSetupForNow();
      }}
    >
      {/* Business type selection cards */}
      <View style={{ gap: spacing.sm }}>
        {OPTION_META.map(({ value, icon }) => {
          const active = selected === value;
          return (
            <Pressable
              key={value}
              onPress={() => setSelected(value)}
              accessibilityRole="radio"
              accessibilityLabel={t(`onboarding.businessType.options.${value}`)}
              accessibilityState={{ selected: active }}
              style={{
                backgroundColor: active ? palette.nrsGreenLight : tokens.bgCard,
                borderColor: active ? palette.nrsGreen : tokens.border,
                borderWidth: active ? 2 : 1,
                borderRadius: radius.xl,
                padding: spacing.lg,
                flexDirection: 'row',
                gap: spacing.md,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  backgroundColor: active ? `${palette.nrsGreen}18` : palette.gray50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text
                  style={{ ...typography.bodyBold, color: active ? palette.nrsGreenDim : tokens.textPrimary }}
                >
                  {t(`onboarding.businessType.options.${value}`)}
                </Text>
                <Text
                  style={{ ...typography.caption, color: active ? palette.nrsGreen : tokens.textSecondary, lineHeight: 18 }}
                >
                  {t(`onboarding.businessType.descriptions.${value}`)}
                </Text>
              </View>
              {active ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.full,
                    backgroundColor: palette.nrsGreen,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={16} color={palette.white} />
                </View>
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.full,
                    borderWidth: 2,
                    borderColor: tokens.border,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Annual turnover input */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
          {t('onboarding.businessType.turnoverLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tokens.bgInput,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text style={{ ...typography.bodyBold, color: tokens.textSecondary, marginRight: spacing.xs }}>₦</Text>
          <TextInput
            value={formatNaira(turnover)}
            onChangeText={(v) => setTurnover(v.replace(/[^0-9]/g, ''))}
            placeholder={t('onboarding.businessType.turnoverPlaceholder')}
            placeholderTextColor={tokens.textMuted}
            keyboardType="numeric"
            accessibilityLabel={t('onboarding.businessType.turnoverLabel')}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              color: tokens.textPrimary,
              ...typography.body,
            }}
          />
        </View>
        <Text style={{ ...typography.caption, color: tokens.textMuted }}>
          {t('onboarding.businessType.turnoverHint')}
        </Text>
      </View>

      {/* Educational info card */}
      <InfoCard
        variant="tip"
        title={t('onboarding.businessType.whyTitle')}
        body={t('onboarding.businessType.whyBody')}
      />
    </OnboardingFrame>
  );
}
