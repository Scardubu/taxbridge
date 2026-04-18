import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OnboardingFrame, InfoCard, advanceToNext, skipSetupForNow } from './_shared';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

const PHASES = [
  { key: 'large', turnoverMin: 5_000_000_000, date: 'Apr 2026', icon: '🔴', active: true },
  { key: 'medium', turnoverMin: 1_000_000_000, date: 'Jul 2026', icon: '🟡', active: false },
  { key: 'small', turnoverMin: 0, date: 'Jul 2027', icon: '🟢', active: false },
] as const;

export default function EInvoiceScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const turnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const isLarge = turnover >= 5_000_000_000;
  const isMedium = turnover >= 1_000_000_000 && !isLarge;

  let phaseText = t('onboarding.einvoice.phaseSmall');
  let userPhaseKey = 'small';
  if (isLarge) {
    phaseText = t('onboarding.einvoice.phaseLarge');
    userPhaseKey = 'large';
  } else if (isMedium) {
    phaseText = t('onboarding.einvoice.phaseMedium');
    userPhaseKey = 'medium';
  }

  return (
    <OnboardingFrame
      stepId="einvoice"
      title={t('onboarding.einvoice.title')}
      body={phaseText}
      onPrimary={() => void advanceToNext('einvoice')}
      secondaryLabel={t('common.skip')}
      onSecondary={() => void skipSetupForNow()}
    >
      {/* Urgency banner for large businesses */}
      {isLarge ? (
        <View
          style={{
            backgroundColor: palette.red50,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: `${palette.nrsRed}30`,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.md,
          }}
        >
          <Ionicons name="warning" size={24} color={palette.nrsRed} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.bodyBold, color: palette.nrsRed }}>
              {t('onboarding.einvoice.enforcementTitle')}
            </Text>
            <Text style={{ ...typography.caption, color: palette.gray600, lineHeight: 18 }}>
              {t('onboarding.einvoice.enforcementBody')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Phase timeline */}
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, marginBottom: spacing.xs }}>
          {t('onboarding.einvoice.timelineTitle')}
        </Text>
        {PHASES.map((phase, index) => {
          const isUserPhase = phase.key === userPhaseKey;
          return (
            <View key={phase.key} style={{ flexDirection: 'row', gap: spacing.md }}>
              {/* Timeline connector */}
              <View style={{ alignItems: 'center', width: 28 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.full,
                    backgroundColor: isUserPhase ? palette.nrsGreen : tokens.bgCard,
                    borderWidth: isUserPhase ? 0 : 2,
                    borderColor: tokens.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isUserPhase ? (
                    <Ionicons name="location" size={14} color={palette.white} />
                  ) : (
                    <Text style={{ fontSize: 10 }}>{phase.icon}</Text>
                  )}
                </View>
                {index < PHASES.length - 1 ? (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      backgroundColor: tokens.border,
                      marginVertical: 2,
                    }}
                  />
                ) : null}
              </View>
              {/* Phase card */}
              <View
                accessibilityRole="summary"
                accessibilityLabel={`${t(`onboarding.einvoice.phases.${phase.key}.label`)}, ${phase.date}${isUserPhase ? `, ${t('onboarding.einvoice.yourPhase')}` : ''}`}
                style={{
                  flex: 1,
                  backgroundColor: isUserPhase ? palette.nrsGreenLight : tokens.bgCard,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderWidth: isUserPhase ? 1 : 1,
                  borderColor: isUserPhase ? `${palette.nrsGreen}40` : tokens.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...typography.bodyBold, color: isUserPhase ? palette.nrsGreenDim : tokens.textPrimary }}>
                    {t(`onboarding.einvoice.phases.${phase.key}.label`)}
                  </Text>
                  <Text style={{ ...typography.label, color: isUserPhase ? palette.nrsGreen : tokens.textMuted }}>
                    {phase.date}
                  </Text>
                </View>
                <Text style={{ ...typography.caption, color: tokens.textSecondary, marginTop: spacing.xs, lineHeight: 18 }}>
                  {t(`onboarding.einvoice.phases.${phase.key}.desc`)}
                </Text>
                {isUserPhase ? (
                  <View
                    style={{
                      marginTop: spacing.sm,
                      backgroundColor: `${palette.nrsGreen}15`,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Text style={{ ...typography.label, color: palette.nrsGreen, fontSize: 10 }}>
                      {t('onboarding.einvoice.yourPhase')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Platform note */}
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
        <Ionicons name="globe-outline" size={18} color={palette.blue600} />
        <Text style={{ ...typography.caption, color: palette.gray600, flex: 1, lineHeight: 18 }}>
          {t('onboarding.einvoice.platform')}
        </Text>
      </View>

      {/* Educational info */}
      <InfoCard
        variant="tip"
        title={t('onboarding.einvoice.educationTitle')}
        body={t('onboarding.einvoice.educationBody')}
      />
    </OnboardingFrame>
  );
}
