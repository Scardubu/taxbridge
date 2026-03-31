import React from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { TaxShieldRing } from '../../components/TaxShieldRing';
import { ComplianceBadge } from '../../components/ComplianceBadge';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { buildComplianceNudges } from '../../services/nudgeEngine';
import { computeObligations } from '../../services/nrsCompliance';
import { router } from 'expo-router';

export default function DashboardTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const snapshot = useBusinessProfileStore((state) => ({
    businessName: state.businessName,
    annualTurnover: state.annualTurnover,
    totalFixedAssets: state.totalFixedAssets,
    sector: state.sector,
    businessType: state.businessType,
    isVatRegistered: state.isVatRegistered,
    hasValidTIN: state.hasValidTIN,
    monthlyRevenue: state.monthlyRevenue,
  }));
  const profile = {
    annualTurnover: snapshot.annualTurnover ?? 0,
    totalFixedAssets: snapshot.totalFixedAssets ?? 0,
    sector: snapshot.sector ?? '',
    businessType: snapshot.businessType ?? 'sole_trader',
    isVatRegistered: snapshot.isVatRegistered ?? false,
    hasValidTIN: snapshot.hasValidTIN,
    monthlyRevenue: snapshot.monthlyRevenue ?? 0,
  };
  const obligations = computeObligations(profile);
  const nudges = buildComplianceNudges(profile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <OfflineIndicator />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{t('dashboard.greeting')}</Text>
            <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{snapshot.businessName || 'TaxBridge Business'}</Text>
          </View>
          <TaxShieldRing compliance={obligations.complianceScore} isStreaking={obligations.complianceScore >= 80} />
        </View>

        <ComplianceBadge score={obligations.complianceScore} />

        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.nudges.title')}</Text>
          {nudges.map((nudge) => (
            <Pressable
              key={nudge.id}
              onPress={() => router.replace(nudge.route)}
              accessibilityRole="button"
              accessibilityLabel={nudge.title}
              accessibilityHint={nudge.actionLabel}
              style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}
            >
              <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{nudge.title}</Text>
              <Text style={{ ...typography.body, color: tokens.textSecondary }}>{nudge.body}</Text>
              <Text style={{ ...typography.caption, color: palette.nrsGreen }}>{nudge.actionLabel}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
