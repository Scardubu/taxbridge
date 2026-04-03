import React, { useMemo } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { TaxShieldRing } from '../../components/TaxShieldRing';
import { ComplianceBadge } from '../../components/ComplianceBadge';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { buildComplianceNudges, type ComplianceNudge } from '../../services/nudgeEngine';
import { computeObligations } from '../../services/nrsCompliance';
import { router } from 'expo-router';
import { STEP_ROUTES, useResumeStepId } from '../../stores/onboardingStore';

function formatCurrency(value: number): string {
  return `₦${Math.round(value).toLocaleString('en-NG')}`;
}

function QuickActionCard({ label, route, icon }: Readonly<{ label: string; route: string; icon: React.ComponentProps<typeof Ionicons>['name'] }>) {
  const tokens = useTokens();

  return (
    <Pressable
      onPress={() => router.push(route)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 88,
        backgroundColor: tokens.bgCard,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: tokens.border,
        padding: spacing.md,
        justifyContent: 'space-between',
      }}
    >
      <Ionicons name={icon} size={22} color={palette.nrsGreen} />
      <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, marginTop: spacing.sm }}>{label}</Text>
    </Pressable>
  );
}

export default function DashboardTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const resumeStepId = useResumeStepId();
  const businessName = useBusinessProfileStore((state) => state.businessName);
  const annualTurnover = useBusinessProfileStore((state) => state.annualTurnover);
  const totalFixedAssets = useBusinessProfileStore((state) => state.totalFixedAssets);
  const sector = useBusinessProfileStore((state) => state.sector);
  const businessType = useBusinessProfileStore((state) => state.businessType);
  const isVatRegistered = useBusinessProfileStore((state) => state.isVatRegistered);
  const hasValidTIN = useBusinessProfileStore((state) => state.hasValidTIN);
  const monthlyRevenue = useBusinessProfileStore((state) => state.monthlyRevenue);
  const tin = useBusinessProfileStore((state) => state.tin);
  const isHydrated = useBusinessProfileStore((state) => state.isHydrated);

  const snapshot = {
    businessName,
    annualTurnover,
    totalFixedAssets,
    sector,
    businessType,
    isVatRegistered,
    hasValidTIN,
    monthlyRevenue,
    tin,
    isHydrated,
  };

  const profile = {
    annualTurnover: snapshot.annualTurnover ?? 0,
    totalFixedAssets: snapshot.totalFixedAssets ?? 0,
    sector: snapshot.sector ?? '',
    businessType: snapshot.businessType ?? 'sole_trader',
    isVatRegistered: snapshot.isVatRegistered ?? false,
    hasValidTIN: snapshot.hasValidTIN ?? false,
    monthlyRevenue: snapshot.monthlyRevenue ?? 0,
  };

  const dashboardData = useMemo(() => {
    try {
      return {
        obligations: computeObligations(profile),
        nudges: buildComplianceNudges(profile),
        hadError: false,
      };
    } catch (error) {
      Sentry.captureException(error, {
        contexts: {
          dashboard: {
            businessType: profile.businessType,
            annualTurnover: profile.annualTurnover,
            hasValidTIN: profile.hasValidTIN,
          },
        },
      });

      return {
        obligations: {
          vatRegistrationRequired: false,
          vatFilingRequired: false,
          vatFilingExempt: false,
          citRate: 0,
          citLiability: 0,
          pitLiability: 0,
          whtExemptEligible: false,
          eInvoicingPhase: 'small' as const,
          eInvoicingMandatory: false,
          eInvoicingRequired: false,
          eInvoicingStatus: 'VOLUNTARY' as const,
          eInvoicingDeadline: new Date('2027-07-01'),
          complianceScore: 0,
          annualTaxBurden: 0,
        },
        nudges: [] as ComplianceNudge[],
        hadError: true,
      };
    }
  }, [profile]);

  const businessTypeLabel = snapshot.businessType
    ? t(`onboarding.businessType.options.${snapshot.businessType}`)
    : t('dashboard.yourBusiness');
  const businessLabel = snapshot.businessName.trim() || businessTypeLabel;
  const needsGuidedSetup = !snapshot.businessType || !snapshot.tin || !snapshot.hasValidTIN;
  const resumeRoute = STEP_ROUTES[resumeStepId];

  const quickActions = [
    { key: 'invoices', label: t('tabs.invoices'), route: '/(tabs)/invoices', icon: 'document-text' as const },
    { key: 'calendar', label: t('tabs.calendar'), route: '/(tabs)/tax-calendar', icon: 'calendar' as const },
    { key: 'compliance', label: t('tabs.compliance'), route: '/(tabs)/compliance', icon: 'shield-checkmark' as const },
  ];

  const obligationRows = [
    {
      key: 'vatRegistration',
      label: t('compliance.vatRegistration'),
      value: dashboardData.obligations.vatRegistrationRequired ? t('compliance.required') : t('compliance.notRequired'),
    },
    {
      key: 'vatFiling',
      label: t('compliance.vatFiling'),
      value: dashboardData.obligations.vatFilingExempt ? t('compliance.exemptFiling') : t('compliance.monthlyRequired'),
    },
    {
      key: 'einvoice',
      label: t('compliance.einvoicePhase'),
      value: t(`einvoice.status.${dashboardData.obligations.eInvoicingPhase}`),
    },
    {
      key: 'burden',
      label: t('compliance.annualBurden'),
      value: formatCurrency(dashboardData.obligations.annualTaxBurden),
    },
  ];

  if (!snapshot.isHydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.loading.title')}</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary, textAlign: 'center' }}>{t('dashboard.loading.body')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <OfflineIndicator />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{t('dashboard.greeting')}</Text>
            <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{businessLabel}</Text>
          </View>
          <TaxShieldRing compliance={dashboardData.obligations.complianceScore} isStreaking={dashboardData.obligations.complianceScore >= 80} />
        </View>

        <ComplianceBadge score={dashboardData.obligations.complianceScore} />

        {(needsGuidedSetup || dashboardData.hadError) ? (
          <View
            style={{
              backgroundColor: tokens.bgCard,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: tokens.border,
              gap: spacing.sm,
            }}
          >
            <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.resumeSetup.title')}</Text>
            <Text style={{ ...typography.body, color: tokens.textSecondary }}>
              {dashboardData.hadError ? t('dashboard.resumeSetup.fallbackBody') : t('dashboard.resumeSetup.body')}
            </Text>
            <Pressable
              onPress={() => router.push(resumeRoute)}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.resumeSetup.action')}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: palette.nrsGreen,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: palette.white }}>{t('dashboard.resumeSetup.action')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.quickActionsTitle')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {quickActions.map((action) => (
              <QuickActionCard key={action.key} label={action.label} route={action.route} icon={action.icon} />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.nudges.title')}</Text>
          {dashboardData.nudges.length > 0 ? dashboardData.nudges.map((nudge) => (
            <Pressable
              key={nudge.id}
              onPress={() => router.push(nudge.route)}
              accessibilityRole="button"
              accessibilityLabel={nudge.title}
              accessibilityHint={nudge.actionLabel}
              style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}
            >
              <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{nudge.title}</Text>
              <Text style={{ ...typography.body, color: tokens.textSecondary }}>{nudge.body}</Text>
              <Text style={{ ...typography.caption, color: palette.nrsGreen }}>{nudge.actionLabel}</Text>
            </Pressable>
          )) : (
            <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
              <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{t('dashboard.emptyState.title')}</Text>
              <Text style={{ ...typography.body, color: tokens.textSecondary }}>{t('dashboard.emptyState.body')}</Text>
            </View>
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.obligations.title')}</Text>
          <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.md }}>
            {obligationRows.map((row) => (
              <View key={row.key} style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.caption, color: tokens.textSecondary }}>{row.label}</Text>
                <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
