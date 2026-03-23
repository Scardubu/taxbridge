import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ComplianceBadge } from '../../components/ComplianceBadge';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { computeObligations } from '../../services/nrsCompliance';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function ComplianceTab() {
  const tokens = useTokens();
  const annualTurnover = useBusinessProfileStore((state) => state.annualTurnover) ?? 0;
  const totalFixedAssets = useBusinessProfileStore((state) => state.totalFixedAssets) ?? 0;
  const sector = useBusinessProfileStore((state) => state.sector);
  const businessType = useBusinessProfileStore((state) => state.businessType || 'sole_trader');
  const isVatRegistered = useBusinessProfileStore((state) => state.isVatRegistered);
  const hasValidTIN = useBusinessProfileStore((state) => state.hasValidTIN);
  const monthlyRevenue = useBusinessProfileStore((state) => state.monthlyRevenue) ?? 0;

  const obligations = computeObligations({
    annualTurnover,
    totalFixedAssets,
    sector,
    businessType,
    isVatRegistered,
    hasValidTIN,
    monthlyRevenue,
  });

  const rows = [
    { label: 'VAT registration', value: obligations.vatRegistrationRequired ? 'Required' : 'Not required yet' },
    { label: 'VAT filing', value: obligations.vatFilingExempt ? 'Exempt from filing' : 'Required monthly' },
    { label: 'E-invoicing phase', value: obligations.eInvoicingPhase },
    { label: 'Annual tax burden', value: `₦${Math.round(obligations.annualTaxBurden).toLocaleString('en-NG')}` },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>Compliance</Text>
        <ComplianceBadge score={obligations.complianceScore} />
        <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.sm }}>
          {rows.map((row) => (
            <View key={row.label} style={{ gap: spacing.xs }}>
              <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{row.label}</Text>
              <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{row.value}</Text>
            </View>
          ))}
          <Text style={{ ...typography.caption, color: palette.gray600 }}>Keep your business profile complete to improve guidance accuracy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
