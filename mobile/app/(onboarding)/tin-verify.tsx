import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, advanceToNext } from './shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { logComplianceEvent } from '../../services/complianceEventService';

export default function TinVerifyScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const savedTin = useBusinessProfileStore((state) => state.tin);
  const updateField = useBusinessProfileStore((state) => state.updateField);
  const [tin, setTin] = useState(savedTin);

  const handleVerify = async () => {
    const valid = tin.trim().length >= 8;
    updateField('tin', tin.trim());
    updateField('hasValidTIN', valid);

    if (valid) {
      await logComplianceEvent('tin_verified', 'TIN captured during onboarding', 'info', { tin: tin.trim() }).catch(() => undefined);
      await advanceToNext('tin-verify');
      return;
    }

    await logComplianceEvent('tin_failed', 'TIN validation failed during onboarding', 'warning', { tin: tin.trim() }).catch(() => undefined);
    Alert.alert(t('onboarding.tinRequiredTitle'), t('onboarding.tinRequiredBody'));
  };

  return (
    <OnboardingFrame
      stepId="tin-verify"
      title={t('onboarding.tinVerify.title')}
      body={t('onboarding.tinVerify.body')}
      onPrimary={() => void handleVerify()}
      secondaryLabel={t('onboarding.tinVerify.skipCta')}
      onSecondary={() => {
        updateField('tin', tin.trim());
        updateField('hasValidTIN', false);
        void advanceToNext('tin-verify');
      }}
    >
      <View style={{ gap: spacing.sm }}>
        <TextInput
          value={tin}
          onChangeText={setTin}
          placeholder={t('onboarding.tinVerify.placeholder')}
          placeholderTextColor={tokens.textMuted}
          autoCapitalize="characters"
          accessibilityLabel={t('onboarding.tinVerify.title')}
          accessibilityHint={t('onboarding.tinVerify.body')}
          style={{
            backgroundColor: tokens.bgInput,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            color: tokens.textPrimary,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.tinVerify.pendingNote')}
          style={{ backgroundColor: palette.gray50, borderRadius: radius.xl, padding: spacing.lg }}
        >
          <Text style={{ ...typography.body, color: palette.gray600 }}>{t('onboarding.tinVerify.pendingNote')}</Text>
        </Pressable>
        <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
          <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('onboarding.tinVerify.educationTitle')}</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('onboarding.tinVerify.educationBody')}</Text>
        </View>
      </View>
    </OnboardingFrame>
  );
}
