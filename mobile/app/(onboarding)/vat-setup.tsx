import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, InfoCard, advanceToNext, skipSetupForNow } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function VatSetupScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const filingExempt = turnover <= 100_000_000;

  return (
    <OnboardingFrame
      stepId="vat-setup"
      title={t('onboarding.vatSetup.title')}
      body={filingExempt ? t('onboarding.vatSetup.exemptBody') : t('onboarding.vatSetup.requiredBody')}
      onPrimary={() => void advanceToNext('vat-setup')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void skipSetupForNow()}
    >
      {/* Status banner */}
      <View
        style={{
          backgroundColor: filingExempt ? palette.nrsGreenLight : palette.amber50,
          borderRadius: radius.xl,
          padding: spacing.lg,
          gap: spacing.sm,
          borderWidth: 1,
          borderColor: filingExempt ? `${palette.nrsGreen}30` : `${palette.amber600}30`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 22 }}>{filingExempt ? '✅' : '📝'}</Text>
          <Text
            style={{
              ...typography.h3,
              color: filingExempt ? palette.nrsGreen : palette.amber600,
              flex: 1,
            }}
          >
            {filingExempt ? t('onboarding.vatSetup.exemptTitle') : t('onboarding.vatSetup.requiredTitle')}
          </Text>
        </View>
        <Text style={{ ...typography.body, color: palette.gray600, lineHeight: 22 }}>
          {filingExempt ? t('onboarding.vatSetup.exemptDetail') : t('onboarding.vatSetup.requiredDetail')}
        </Text>
      </View>

      {/* Filing vs Charging — the KEY distinction (TAX-02 fix) */}
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
          {t('onboarding.vatSetup.distinctionTitle')}
        </Text>
        {/* Charging */}
        <View
          style={{
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.lg,
              backgroundColor: palette.nrsGreenLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="receipt-outline" size={18} color={palette.nrsGreen} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
              {t('onboarding.vatSetup.chargingTitle')}
            </Text>
            <Text style={{ ...typography.caption, color: tokens.textSecondary, lineHeight: 18 }}>
              {t('onboarding.vatSetup.chargingBody')}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: palette.nrsGreen,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ ...typography.label, color: palette.white, fontSize: 10 }}>
              {t('onboarding.vatSetup.allBusinesses')}
            </Text>
          </View>
        </View>
        {/* Filing */}
        <View
          style={{
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: filingExempt ? `${palette.nrsGreen}30` : `${palette.amber600}30`,
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.lg,
              backgroundColor: filingExempt ? palette.nrsGreenLight : palette.amber50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="document-text-outline" size={18} color={filingExempt ? palette.nrsGreen : palette.amber600} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
              {t('onboarding.vatSetup.filingTitle')}
            </Text>
            <Text style={{ ...typography.caption, color: tokens.textSecondary, lineHeight: 18 }}>
              {filingExempt ? t('onboarding.vatSetup.filingExemptBody') : t('onboarding.vatSetup.filingRequiredBody')}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: filingExempt ? palette.nrsGreenLight : palette.amber50,
              borderRadius: radius.full,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ ...typography.label, color: filingExempt ? palette.nrsGreen : palette.amber600, fontSize: 10 }}>
              {filingExempt ? t('onboarding.vatSetup.exempt') : t('onboarding.vatSetup.required')}
            </Text>
          </View>
        </View>
      </View>

      {/* VAT Rate card */}
      <View
        style={{
          backgroundColor: tokens.bgCard,
          borderRadius: radius.xl,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: tokens.border,
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <Text style={{ ...typography.display, color: palette.nrsGreen }}>7.5%</Text>
        <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{t('onboarding.vatSetup.rate')}</Text>
      </View>

      {/* Educational info */}
      <InfoCard
        variant="tip"
        title={t('onboarding.vatSetup.educationTitle')}
        body={t('onboarding.vatSetup.educationBody')}
      />
    </OnboardingFrame>
  );
}
