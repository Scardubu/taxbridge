import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { TaxShieldRing } from '../../components/TaxShieldRing';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { OnboardingProgressBanner } from '../../components/OnboardingProgressBanner';
import { EducativeTaxObligationsSection } from '../../components/EducativeTaxObligationsSection';
import { palette, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { computeObligations } from '../../services/nrsCompliance';
import { generateNudges } from '../../services/nudgeEngine';
import { offlineQueue } from '../../services/offlineQueue';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useIsOnboardingDone, useOnboardingStore } from '../../stores/onboardingStore';

const PREVIEW_PROFILE = {
  businessType: 'sole_trader',
  sector: 'retail',
  annualTurnover: 8_500_000,
  totalFixedAssets: 0,
  hasValidTIN: false,
  isVatRegistered: false,
  monthlyRevenue: 708_333,
} as const;

const NUDGE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'missing-tin': 'alert-circle',
  'vat-required': 'receipt',
  'cit-zero': 'checkmark-circle',
  'vat-filing-exempt': 'information-circle',
  'einvoice-readiness': 'document-text',
};

function getNudgeIcon(id: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (id.startsWith('deadline-')) {
    return 'calendar';
  }

  return NUDGE_ICONS[id] ?? 'information-circle';
}

function getShieldMeta(score: number, t: ReturnType<typeof useTranslation>['t']) {
  if (score >= 80) {
    return {
      label: t('compliance.excellent'),
      sublabel: t('shield.fullyProtected'),
      bannerColor: '#065F46',
      textColor: '#D1FAE5',
      icon: '🏆',
    };
  }

  if (score >= 50) {
    return {
      label: t('compliance.good'),
      sublabel: t('shield.moderate'),
      bannerColor: '#78350F',
      textColor: '#FEF3C7',
      icon: '📋',
    };
  }

  if (score >= 20) {
    return {
      label: t('compliance.actionNeeded'),
      sublabel: t('shield.partial'),
      bannerColor: '#7C2D12',
      textColor: '#FEE2E2',
      icon: '⚠️',
    };
  }

  return {
    label: t('compliance.getStarted'),
    sublabel: t('shield.none'),
    bannerColor: '#1C1C1C',
    textColor: '#9CA3AF',
    icon: '🚀',
  };
}

export default function DashboardTab() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const isDone = useIsOnboardingDone();
  const previewMode = useOnboardingStore((state) => state.previewMode);
  const snapshot = useBusinessProfileStore((state) => ({
    businessName: state.businessName,
    annualTurnover: state.annualTurnover,
    totalFixedAssets: state.totalFixedAssets,
    sector: state.sector,
    businessType: state.businessType,
    isVatRegistered: state.isVatRegistered,
    hasValidTIN: state.hasValidTIN,
    monthlyRevenue: state.monthlyRevenue,
    isHydrated: state.isHydrated,
  }));
  const [refreshing, setRefreshing] = useState(false);

  const profile = useMemo(() => {
    if (previewMode && !snapshot.businessType) {
      return PREVIEW_PROFILE;
    }

    return {
      annualTurnover: snapshot.annualTurnover ?? 0,
      totalFixedAssets: snapshot.totalFixedAssets ?? 0,
      sector: snapshot.sector ?? '',
      businessType: snapshot.businessType || 'sole_trader',
      isVatRegistered: snapshot.isVatRegistered ?? false,
      hasValidTIN: snapshot.hasValidTIN ?? false,
      monthlyRevenue: snapshot.monthlyRevenue ?? 0,
    };
  }, [previewMode, snapshot]);

  const obligations = useMemo(() => computeObligations(profile), [profile]);
  const nudges = useMemo(() => generateNudges(profile, obligations), [obligations, profile]);
  const score = previewMode && !isDone ? 0 : obligations.complianceScore ?? 0;
  const shieldMeta = useMemo(() => getShieldMeta(score, t), [score, t]);
  const businessLabel = snapshot.businessName.trim() || t('dashboard.yourBusiness');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await offlineQueue.flush();
    setRefreshing(false);
  }, []);

  const handleExitPreview = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(onboarding)/business-type');
  }, []);

  if (!snapshot.isHydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
          <ActivityIndicator size="large" color={palette.nrsGreen} />
          <Text style={{ ...typography.h3, color: tokens.textPrimary }}>{t('dashboard.loading.title')}</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary, textAlign: 'center' }}>{t('dashboard.loading.body')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top', 'bottom']}>
      <OfflineIndicator />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D9E75" />}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: '#6B7280', fontSize: 14 }}>{t('dashboard.greeting')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800', lineHeight: 36 }}>{businessLabel}</Text>
          </View>
          <TaxShieldRing compliance={score} isStreaking={score >= 80} size={88} />
        </View>

        <Text style={{ color: '#6B7280', fontSize: 12, paddingHorizontal: 24, marginTop: 4 }}>
          {shieldMeta.sublabel}
        </Text>

        <View style={{ marginHorizontal: 24, marginTop: 20, borderRadius: 16, backgroundColor: shieldMeta.bannerColor, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 28 }}>{shieldMeta.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: shieldMeta.textColor, fontWeight: '700', fontSize: 16 }}>{shieldMeta.label}</Text>
              <Text style={{ color: shieldMeta.textColor, opacity: 0.75, fontSize: 13, marginTop: 4 }}>
                {t('shield.percentProtected', { score })}
              </Text>
            </View>
          </View>
        </View>

        {previewMode && !isDone ? <OnboardingProgressBanner onContinue={handleExitPreview} /> : null}

        {!isDone && !previewMode ? (
          <View
            style={{
              marginHorizontal: 24,
              marginTop: 16,
              backgroundColor: '#0D2B22',
              borderColor: '#1D9E75',
              borderWidth: 1,
              borderRadius: 20,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>🚀</Text>
              <Text style={{ color: '#34D399', fontWeight: '700', fontSize: 16 }}>{t('dashboard.resumeSetup.title')}</Text>
            </View>
            <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>{t('dashboard.resumeSetup.fallbackBody')}</Text>
            <Pressable
              onPress={() => router.push('/(onboarding)/business-type')}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.resumeSetup.action')}
              style={{
                marginTop: 16,
                backgroundColor: '#1D9E75',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('preview.cta')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{t('dashboard.nudges.title')}</Text>
          {nudges.length > 0 ? (
            nudges.map((nudge) => (
              <Pressable
                key={nudge.id}
                onPress={() => router.push(nudge.route)}
                accessibilityRole="button"
                accessibilityLabel={nudge.title}
                style={({ pressed }) => ({
                  backgroundColor: '#1C1C1C',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 12,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: '#0D2B22',
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={getNudgeIcon(nudge.id)} size={20} color={palette.nrsGreen} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F9FAFB', fontWeight: '600', fontSize: 15 }}>{nudge.title}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4, lineHeight: 19 }}>{nudge.body}</Text>
                    <Text style={{ color: '#34D399', fontSize: 13, fontWeight: '600', marginTop: 10 }}>{nudge.actionLabel}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ backgroundColor: '#1C1C1C', borderRadius: 16, padding: 20 }}>
              <Text style={{ color: '#F9FAFB', fontWeight: '600', fontSize: 15 }}>{t('dashboard.emptyState.title')}</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 6, lineHeight: 19 }}>{t('dashboard.emptyState.body')}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <Text style={{ color: '#9CA3AF', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{t('dashboard.quickActionsTitle')}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { icon: 'document-text' as const, label: t('tabs.invoices'), route: '/(tabs)/invoices' },
              { icon: 'calendar' as const, label: t('tabs.calendar'), route: '/(tabs)/tax-calendar' },
              { icon: 'shield-checkmark' as const, label: t('tabs.compliance'), route: '/(tabs)/compliance' },
            ].map((action) => (
              <Pressable
                key={action.route}
                onPress={() => {
                  void Haptics.selectionAsync();
                  router.push(action.route);
                }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={{
                  flex: 1,
                  backgroundColor: '#1C1C1C',
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: '#0D2B22',
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={action.icon} size={24} color="#34D399" />
                </View>
                <Text style={{ color: '#F9FAFB', fontWeight: '500', fontSize: 13 }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <EducativeTaxObligationsSection obligations={obligations} isPreviewMode={previewMode} />
      </ScrollView>
    </SafeAreaView>
  );
}
