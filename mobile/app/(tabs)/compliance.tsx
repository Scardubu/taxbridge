import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ComplianceBadge } from '../../components/ComplianceBadge';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { palette, radius, shadows, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { computeObligations } from '../../services/nrsCompliance';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

const OBLIGATION_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  vatRegistration: 'receipt',
  vatFiling: 'document-text',
  einvoice: 'cloud-upload',
  burden: 'cash',
};

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

  const { t } = useTranslation();

  const rows = [
    {
      key: 'vatRegistration',
      label: t('compliance.vatRegistration'),
      value: obligations.vatRegistrationRequired ? t('compliance.required') : t('compliance.notRequired'),
    },
    {
      key: 'vatFiling',
      label: t('compliance.vatFiling'),
      value: obligations.vatFilingExempt ? t('compliance.exemptFiling') : t('compliance.monthlyRequired'),
    },
    {
      key: 'einvoice',
      label: t('compliance.einvoicePhase'),
      value: t(`einvoice.status.${obligations.eInvoicingPhase}`),
    },
    {
      key: 'burden',
      label: t('compliance.annualBurden'),
      value: `₦${Math.round(obligations.annualTaxBurden).toLocaleString('en-NG')}`,
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <OfflineIndicator />
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('compliance.title')}</Text>
        <ComplianceBadge score={obligations.complianceScore} />
        <View
          style={{
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            gap: spacing.md,
            ...shadows.sm,
          }}
        >
          {rows.map((row, index) => (
            <View key={row.key} accessibilityRole="summary" accessibilityLabel={`${row.label}: ${row.value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: index > 0 ? spacing.sm : 0, borderTopWidth: index > 0 ? 1 : 0, borderTopColor: tokens.border }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: palette.nrsGreenLight, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={OBLIGATION_ICONS[row.key] ?? 'information-circle'} size={18} color={palette.nrsGreen} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{row.label}</Text>
                <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: tokens.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="information-circle" size={18} color={palette.nrsGreen} />
          <Text style={{ ...typography.caption, color: tokens.textSecondary, flex: 1 }}>
            {t('compliance.profileTip')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
