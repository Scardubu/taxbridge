import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, InfoCard, advanceToNext } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { logComplianceEvent } from '../../services/complianceEventService';

export default function TinVerifyScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const savedTin = useBusinessProfileStore((state) => state.tin);
  const updateField = useBusinessProfileStore((state) => state.updateField);
  const [tin, setTin] = useState(savedTin);
  const [isFocused, setIsFocused] = useState(false);
  const tinDigits = tin.replace(/[^0-9]/g, '');
  const isValidLength = tinDigits.length >= 8;

  const handleVerify = async () => {
    const trimmed = tin.trim();
    updateField('tin', trimmed);
    updateField('hasValidTIN', isValidLength);

    if (isValidLength) {
      await logComplianceEvent('tin_verified', 'TIN captured during onboarding', 'info', { tin: trimmed }).catch(() => undefined);
      await advanceToNext('tin-verify');
      return;
    }

    await logComplianceEvent('tin_failed', 'TIN validation failed during onboarding', 'warning', { tin: trimmed }).catch(() => undefined);
    Alert.alert(t('onboarding.tinRequiredTitle'), t('onboarding.tinRequiredBody'));
  };

  return (
    <OnboardingFrame
      stepId="tin-verify"
      title={t('onboarding.tinVerify.title')}
      body={t('onboarding.tinVerify.body')}
      onPrimary={() => void handleVerify()}
      primaryLabel={t('onboarding.tinVerify.verifyCta')}
      secondaryLabel={t('onboarding.tinVerify.skipCta')}
      onSecondary={() => {
        updateField('tin', tin.trim());
        updateField('hasValidTIN', false);
        void advanceToNext('tin-verify');
      }}
    >
      {/* WHT penalty warning — prominent */}
      <View
        style={{
          backgroundColor: palette.red50,
          borderRadius: radius.xl,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: `${palette.nrsRed}20`,
          flexDirection: 'row',
          gap: spacing.md,
          alignItems: 'flex-start',
        }}
      >
        <Text style={{ fontSize: 20 }}>⚠️</Text>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ ...typography.bodyBold, color: palette.nrsRed }}>
            {t('onboarding.tinVerify.whtWarningTitle')}
          </Text>
          <Text style={{ ...typography.caption, color: palette.gray600, lineHeight: 18 }}>
            {t('onboarding.tinVerify.whtWarningBody')}
          </Text>
        </View>
      </View>

      {/* TIN input with format guidance */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
          {t('onboarding.tinVerify.inputLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: tokens.bgInput,
            borderWidth: isFocused ? 2 : 1,
            borderColor: isFocused
              ? palette.nrsGreen
              : isValidLength && tinDigits.length > 0
                ? palette.shield
                : tokens.border,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={isValidLength ? palette.shield : tokens.textMuted}
            style={{ marginRight: spacing.sm }}
          />
          <TextInput
            value={tin}
            onChangeText={setTin}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={t('onboarding.tinVerify.placeholder')}
            placeholderTextColor={tokens.textMuted}
            autoCapitalize="characters"
            keyboardType="default"
            maxLength={15}
            accessibilityLabel={t('onboarding.tinVerify.inputLabel')}
            accessibilityHint={t('onboarding.tinVerify.formatHint')}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              color: tokens.textPrimary,
              ...typography.body,
              letterSpacing: 1,
            }}
          />
          {isValidLength ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: radius.full,
                backgroundColor: palette.shield,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={16} color={palette.white} />
            </View>
          ) : null}
        </View>
        <Text style={{ ...typography.caption, color: tokens.textMuted }}>
          {t('onboarding.tinVerify.formatHint')}
        </Text>
      </View>

      {/* Verification note */}
      <View
        style={{
          backgroundColor: palette.blue50,
          borderRadius: radius.xl,
          padding: spacing.lg,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: `${palette.blue600}15`,
        }}
      >
        <Text style={{ fontSize: 16 }}>⏱️</Text>
        <Text style={{ ...typography.caption, color: palette.gray600, flex: 1, lineHeight: 18 }}>
          {t('onboarding.tinVerify.pendingNote')}
        </Text>
      </View>

      {/* Educational info */}
      <InfoCard
        variant="tip"
        title={t('onboarding.tinVerify.educationTitle')}
        body={t('onboarding.tinVerify.educationBody')}
      />
    </OnboardingFrame>
  );
}
