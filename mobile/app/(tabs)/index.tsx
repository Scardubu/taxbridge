import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { TaxShieldRing } from '../../components/TaxShieldRing';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { OnboardingProgressBanner } from '../../components/OnboardingProgressBanner';
import { EducativeTaxObligationsSection } from '../../components/EducativeTaxObligationsSection';
import { SkeletonDashboard } from '../../components/SkeletonDashboard';
import { Colors, Spacing, Radii, Typography } from '../../components/design-system/tokens';
import { computeObligations } from '../../services/nrsCompliance';
import { generateNudges } from '../../services/nudgeEngine';
import { offlineQueue } from '../../services/offlineQueue';
import { sseService } from '../../services/sseService';
import { TokenService } from '../../services/tokenService';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useCurrentStepId, useIsOnboardingDone, useOnboardingStore, STEP_ROUTES } from '../../stores/onboardingStore';

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
      bannerColor: Colors.status.successBg,
      textColor: Colors.status.successText,
      icon: '🏆',
    };
  }

  if (score >= 50) {
    return {
      label: t('compliance.good'),
      sublabel: t('shield.moderate'),
      bannerColor: Colors.status.warningBg,
      textColor: Colors.status.warningText,
      icon: '📋',
    };
  }

  if (score >= 20) {
    return {
      label: t('compliance.actionNeeded'),
      sublabel: t('shield.partial'),
      bannerColor: Colors.status.dangerBg,
      textColor: Colors.status.dangerText,
      icon: '⚠️',
    };
  }

  return {
    label: t('compliance.getStarted'),
    sublabel: t('shield.none'),
    bannerColor: Colors.ui.surface,
    textColor: Colors.ui.textMuted,
    icon: '🚀',
  };
}

export default function DashboardTab() {
  const { t } = useTranslation();
  const isDone = useIsOnboardingDone();
  const currentStepId = useCurrentStepId();
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

  // SSE: only connect in MODE B (onboarding complete)
  useEffect(() => {
    if (!isDone) return;
    void TokenService.getAccessToken().then((token) => {
      if (token) sseService.connect(token);
    });
    const offTinVerified = sseService.on('tin_verified', () => {
      void useBusinessProfileStore.getState().hydrate();
    });
    const offEinvoiceAlert = sseService.on('einvoice_alert', () => {
      // alerts surface via getAlerts() poll; SSE just triggers a UI nudge refresh
    });
    return () => {
      offTinVerified();
      offEinvoiceAlert();
    };
  }, [isDone]);

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
    const route = (currentStepId !== 'done' ? STEP_ROUTES[currentStepId] : null) ?? '/(onboarding)/business-type';
    router.push(route);
  }, [currentStepId]);

  if (!snapshot.isHydrated) {
    return <SkeletonDashboard />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.ui.bg }} edges={['top', 'bottom']}>
      <OfflineIndicator />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />}
      >
        <View style={{ paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={{ ...Typography.label, color: Colors.ui.textDim }}>{t('dashboard.greeting')}</Text>
            <Text style={{ fontSize: 32, fontWeight: '800', lineHeight: 36, color: Colors.ui.white }}>{businessLabel}</Text>
          </View>
          <TaxShieldRing score={score} size={88} />
        </View>

        <Text style={{ ...Typography.micro, color: Colors.ui.textDim, paddingHorizontal: Spacing.xxl, marginTop: Spacing.xs }}>
          {shieldMeta.sublabel}
        </Text>

        <View style={{ marginHorizontal: Spacing.xxl, marginTop: Spacing.xl, borderRadius: Radii.lg, backgroundColor: shieldMeta.bannerColor, padding: Spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
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
              marginHorizontal: Spacing.xxl,
              marginTop: Spacing.lg,
              backgroundColor: Colors.brand.primaryDim,
              borderColor: Colors.brand.primary,
              borderWidth: 1,
              borderRadius: Radii.xl,
              padding: Spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Text style={{ fontSize: 24 }}>🚀</Text>
              <Text style={{ color: Colors.brand.accent, fontWeight: '700', fontSize: 16 }}>{t('dashboard.finishSetupTitle')}</Text>
            </View>
            <Text style={{ color: Colors.ui.textDim, marginTop: Spacing.sm, fontSize: 14 }}>{t('dashboard.finishSetupBody')}</Text>
            <Pressable
              onPress={handleExitPreview}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.continueSetup')}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: Colors.brand.primary,
                borderRadius: Radii.md,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: Colors.ui.white, fontWeight: '700' }}>{t('dashboard.continueSetup')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
          <Text style={{ ...Typography.section, color: Colors.ui.textMuted, marginBottom: Spacing.md }}>{t('dashboard.nudges.title')}</Text>
          {nudges.length > 0 ? (
            nudges.map((nudge) => (
              <Pressable
                key={nudge.id}
                onPress={() => router.push(nudge.route)}
                accessibilityRole="button"
                accessibilityLabel={nudge.title}
                style={({ pressed }) => ({
                  backgroundColor: Colors.ui.surface,
                  borderRadius: Radii.lg,
                  padding: Spacing.xl,
                  marginBottom: Spacing.md,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: Colors.brand.primaryDim,
                      borderRadius: Radii.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={getNudgeIcon(nudge.id)} size={20} color={Colors.brand.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...Typography.body, color: Colors.ui.text, fontWeight: '600' }}>{nudge.title}</Text>
                    <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: 4 }}>{nudge.body}</Text>
                    <Text style={{ ...Typography.caption, color: Colors.brand.accent, fontWeight: '600', marginTop: Spacing.sm }}>{nudge.actionLabel}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ backgroundColor: Colors.ui.surface, borderRadius: Radii.lg, padding: Spacing.xl }}>
              <Text style={{ ...Typography.body, color: Colors.ui.text, fontWeight: '600' }}>{t('dashboard.emptyState.title')}</Text>
              <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: 6 }}>{t('dashboard.emptyState.body')}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
          <Text style={{ ...Typography.section, color: Colors.ui.textMuted, marginBottom: Spacing.md }}>{t('dashboard.quickActions')}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            {[
              { icon: 'document-text' as const, label: t('dashboard.invoices'), route: '/(tabs)/invoices' },
              { icon: 'calendar' as const, label: t('dashboard.calendar'), route: '/(tabs)/tax-calendar' },
              { icon: 'shield-checkmark' as const, label: t('dashboard.compliance'), route: '/(tabs)/compliance' },
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
                  backgroundColor: Colors.ui.surface,
                  borderRadius: Radii.lg,
                  padding: Spacing.lg,
                  alignItems: 'center',
                  gap: Spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: Colors.brand.primaryDim,
                    borderRadius: Radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={action.icon} size={24} color={Colors.brand.accent} />
                </View>
                <Text style={{ ...Typography.caption, color: Colors.ui.text, fontWeight: '500' }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <EducativeTaxObligationsSection obligations={obligations} isPreviewMode={previewMode} />
      </ScrollView>
    </SafeAreaView>
  );
}
