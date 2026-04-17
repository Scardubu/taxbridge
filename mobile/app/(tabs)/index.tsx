import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { TaxShieldRing } from '../../components/TaxShieldRing';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { OnboardingProgressBanner } from '../../components/OnboardingProgressBanner';
import { EducativeTaxObligationsSection } from '../../components/EducativeTaxObligationsSection';
import { ExpenseSummaryCard } from '../../components/ExpenseSummaryCard';
import { SkeletonDashboard } from '../../components/SkeletonDashboard';
import { TaxCalculationSummary } from '../../components/TaxCalculationSummary';
import { Colors, Spacing, Radii, Typography } from '../../components/design-system/tokens';
import { computeObligations } from '../../services/nrsCompliance';
import { type ComplianceNudge, generateNudges } from '../../services/nudgeEngine';
import { offlineQueue } from '../../services/offlineQueue';
import { RECEIPT_FALLBACK_BUSINESS_ID } from '../../services/receiptService';
import { sseService } from '../../services/sseService';
import { getAlerts } from '../../services/api';
import { logComplianceEvent } from '../../services/complianceEventService';
import { markPaymentConfirmed } from '../../services/paymentService';
import { TokenService } from '../../services/tokenService';
import { useTaxEngine } from '../../hooks/useTaxEngine';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { type EventNudge, useNudgeStore } from '../../stores/nudgeStore';
import { useReceiptStore } from '../../stores/receiptStore';
import { useCurrentStepId, useIsOnboardingDone, usePreviewMode, STEP_ROUTES } from '../../stores/onboardingStore';

const PREVIEW_PROFILE = {
  businessName: 'TaxBridge Demo Shop',
  employeeCount: 0,
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
  'admin-alert': 'notifications',
  'einvoice-alert': 'warning',
};

const NUDGE_PRIORITY_ORDER = {
  critical: 0,
  warning: 1,
  opportunity: 2,
} as const;

type DashboardNudge = Omit<ComplianceNudge, 'route'> & {
  route: string;
  external?: boolean;
};

function mapSeverityToPriority(severity: 'info' | 'warning' | 'critical') {
  if (severity === 'critical') return 'critical' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'opportunity' as const;
}

function toEventNudge(nudge: EventNudge): DashboardNudge {
  return {
    ...nudge,
  };
}

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
  const previewMode = usePreviewMode();
  const eventNudges = useNudgeStore((state) => state.eventNudges);
  const hydrateReceiptStats = useReceiptStore((state) => state.hydrate);
  const receiptStats = useReceiptStore((state) => state.stats);
  const snapshot = useBusinessProfileStore((state) => ({
    businessId: state.businessId,
    businessName: state.businessName,
    annualTurnover: state.annualTurnover,
    totalFixedAssets: state.totalFixedAssets,
    sector: state.sector,
    businessType: state.businessType,
    employeeCount: state.employeeCount,
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
      if (!token) return;

      sseService.connect(token);
      void getAlerts()
        .then((alerts) => {
          alerts
            .slice()
            .reverse()
            .forEach((alert) => {
              useNudgeStore.getState().prependNudge({
                id: `admin-alert-${alert.id}`,
                title: t('dashboard.nudgeCards.adminAlert.title'),
                body: alert.message,
                severity: alert.severity,
                priority: mapSeverityToPriority(alert.severity),
                actionLabel: t('dashboard.nudgeCards.adminAlert.action'),
                route: alert.action_url ?? '/(tabs)/compliance',
                external: typeof alert.action_url === 'string' && /^https?:\/\//.test(alert.action_url),
                source: 'admin',
              });
            });
        })
        .catch(() => undefined);
    });
    const offTinVerified = sseService.on('tin_verified', () => {
      void useBusinessProfileStore.getState().hydrate();
    });
    const offDeadline = sseService.on('compliance_deadline', (payload) => {
      useNudgeStore.getState().prependNudge({
        id: String(payload.id ?? `deadline-${Date.now()}`),
        title: typeof payload.title === 'string' ? payload.title : t('dashboard.nudgeCards.deadline.title'),
        body: typeof payload.body === 'string' ? payload.body : t('dashboard.nudgeCards.deadline.body'),
        severity: 'critical',
        priority: 'critical',
        actionLabel: t('dashboard.nudgeCards.deadline.action'),
        route: typeof payload.action_url === 'string' ? payload.action_url : '/(tabs)/tax-calendar',
        external: typeof payload.action_url === 'string' && /^https?:\/\//.test(payload.action_url),
        source: 'system',
      });
    });
    const offPaymentConfirmed = sseService.on('payment_confirmed', (payload) => {
      if (typeof payload.remita_rrr === 'string') {
        void markPaymentConfirmed(payload.remita_rrr);
      }
      void useBusinessProfileStore.getState().hydrate();
    });
    const offEinvoiceAlert = sseService.on('einvoice_alert', () => {
      useNudgeStore.getState().prependNudge({
        id: 'einvoice-alert',
        title: t('dashboard.nudgeCards.einvoiceAlert.title'),
        body: t('dashboard.nudgeCards.einvoiceAlert.body'),
        severity: 'warning',
        priority: 'warning',
        actionLabel: t('dashboard.nudgeCards.einvoiceAlert.action'),
        route: 'https://einvoice.firs.gov.ng',
        external: true,
        source: 'system',
      });
    });
    const offAdminAlert = sseService.on('admin_alert', (payload) => {
      const severity = payload.severity === 'critical' || payload.severity === 'warning' ? payload.severity : 'info';
      useNudgeStore.getState().prependNudge({
        id: String(payload.id ?? `admin-alert-${Date.now()}`),
        title: t('dashboard.nudgeCards.adminAlert.title'),
        body: typeof payload.message === 'string' ? payload.message : t('dashboard.nudgeCards.adminAlert.body'),
        severity,
        priority: mapSeverityToPriority(severity),
        actionLabel: t('dashboard.nudgeCards.adminAlert.action'),
        route: typeof payload.action_url === 'string' ? payload.action_url : '/(tabs)/compliance',
        external: typeof payload.action_url === 'string' && /^https?:\/\//.test(payload.action_url),
        source: 'admin',
      });
      void logComplianceEvent(
        'admin_alert_received',
        typeof payload.message === 'string' ? payload.message : 'Admin alert received',
        severity === 'info' ? 'warning' : severity,
        payload,
        { source: 'admin', actionUrl: typeof payload.action_url === 'string' ? payload.action_url : undefined }
      );
    });
    const offObligationOverride = sseService.on('obligation_override', (payload) => {
      void useBusinessProfileStore.getState().hydrate();
      void logComplianceEvent(
        'obligation_override',
        'Compliance obligation overridden by admin',
        'warning',
        payload,
        { source: 'admin' }
      );
    });
    const offTinManualVerify = sseService.on('tin_manual_verify', (payload) => {
      if (typeof payload.status === 'string') {
        void useBusinessProfileStore.getState().updateField('hasValidTIN', payload.status === 'verified');
      }
      void useBusinessProfileStore.getState().hydrate();
    });
    const offReceiptProcessed = sseService.on('receipt_processed', (payload) => {
      const clientReceiptId = typeof payload.client_receipt_id === 'string' ? payload.client_receipt_id : null;
      const serverId = typeof payload.server_id === 'string' ? payload.server_id : null;
      const vatCredit = typeof payload.vat_credit_ngn === 'number' ? payload.vat_credit_ngn : undefined;

      if (clientReceiptId && serverId) {
        void useReceiptStore.getState().markServerConfirmed(clientReceiptId, serverId, vatCredit);
      }
    });
    const offReceiptFlagged = sseService.on('receipt_flagged', (payload) => {
      const clientReceiptId = typeof payload.client_receipt_id === 'string' ? payload.client_receipt_id : null;
      const reason = typeof payload.reason === 'string' ? payload.reason : 'review_needed';

      if (clientReceiptId) {
        void useReceiptStore.getState().markFlagged(clientReceiptId);
      }

      useNudgeStore.getState().prependNudge({
        id: `receipt-flagged-${clientReceiptId ?? Date.now()}`,
        title: t('dashboard.nudgeCards.adminAlert.title'),
        body: t('receipts.flaggedBody', { reason }),
        severity: 'warning',
        priority: 'warning',
        actionLabel: t('dashboard.nudgeCards.adminAlert.action'),
        route: '/(tabs)/receipts',
        source: 'admin',
      });
    });
    const offVatReturnAccepted = sseService.on('vat_return_accepted', (payload) => {
      void logComplianceEvent(
        'vat_return_submitted',
        'VAT return accepted by admin workflow',
        'info',
        payload,
      );
    });
    const offTaxAssessmentIssued = sseService.on('tax_assessment_issued', (payload) => {
      useNudgeStore.getState().prependNudge({
        id: `tax-assessment-${String(payload.firs_ref ?? Date.now())}`,
        title: t('dashboard.nudgeCards.deadline.title'),
        body: t('receipts.taxAssessmentBody', {
          amount: typeof payload.amount_ngn === 'number' ? payload.amount_ngn.toLocaleString('en-NG') : '0',
          dueDate: typeof payload.due_date === 'string' ? payload.due_date : 'N/A',
        }),
        severity: 'critical',
        priority: 'critical',
        actionLabel: t('dashboard.nudgeCards.adminAlert.action'),
        route: '/(tabs)/compliance',
        source: 'admin',
      });
    });
    return () => {
      offTinVerified();
      offDeadline();
      offPaymentConfirmed();
      offEinvoiceAlert();
      offAdminAlert();
      offObligationOverride();
      offTinManualVerify();
      offReceiptProcessed();
      offReceiptFlagged();
      offVatReturnAccepted();
      offTaxAssessmentIssued();
      useNudgeStore.getState().clearEventNudges();
      sseService.disconnect();
    };
  }, [isDone, t]);

  useEffect(() => {
    if (!isDone || !snapshot.isHydrated) {
      return;
    }

    const now = new Date();
    void hydrateReceiptStats(
      snapshot.businessId ?? RECEIPT_FALLBACK_BUSINESS_ID,
      now.getMonth() + 1,
      now.getFullYear()
    );
  }, [hydrateReceiptStats, isDone, snapshot.businessId, snapshot.isHydrated]);

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
  const taxCalc = useTaxEngine(profile, receiptStats.totalVatCreditNgn);
  const nudges = useMemo<DashboardNudge[]>(() => {
    const generated = generateNudges(profile, obligations).map((nudge) => ({
      ...nudge,
      external: false,
    }));

    return [...eventNudges.map(toEventNudge), ...generated]
      .sort((left, right) => NUDGE_PRIORITY_ORDER[left.priority] - NUDGE_PRIORITY_ORDER[right.priority])
      .slice(0, 3);
  }, [eventNudges, obligations, profile]);
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

  const handleNudgePress = useCallback((nudge: DashboardNudge) => {
    if (nudge.external || /^https?:\/\//.test(nudge.route)) {
      void Linking.openURL(nudge.route);
      return;
    }

    router.push(nudge.route as never);
  }, []);

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
            <Text style={{ ...Typography.displaySm }}>{businessLabel}</Text>
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
              <Text style={{ ...Typography.sectionBold, color: shieldMeta.textColor }}>{shieldMeta.label}</Text>
              <Text style={{ ...Typography.caption, color: shieldMeta.textColor, opacity: 0.75, marginTop: Spacing.xs }}>
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
              <Text style={{ ...Typography.sectionBold, color: Colors.brand.accent }}>{t('dashboard.finishSetupTitle')}</Text>
            </View>
            <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: Spacing.sm }}>{t('dashboard.finishSetupBody')}</Text>
            <Pressable
              onPress={handleExitPreview}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.continueSetup')}
              style={{
                marginTop: Spacing.lg,
                backgroundColor: Colors.brand.primary,
                borderRadius: Radii.md,
                paddingVertical: Spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...Typography.bodyBold, color: Colors.ui.white }}>{t('dashboard.continueSetup')}</Text>
            </Pressable>
          </View>
        ) : null}

        {isDone ? (
          <ExpenseSummaryCard
            totalExpenses={receiptStats.totalAmountNgn}
            vatCredits={receiptStats.totalVatCreditNgn}
            receiptCount={receiptStats.count}
            onScanPress={() => router.push('/(tabs)/receipts')}
          />
        ) : null}

        <TaxCalculationSummary calculation={taxCalc} isPreviewMode={previewMode} />

        <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
          <Text style={{ ...Typography.section, color: Colors.ui.textMuted, marginBottom: Spacing.md }}>{t('dashboard.nudges.title')}</Text>
          {nudges.length > 0 ? (
            nudges.map((nudge) => (
              <Pressable
                key={nudge.id}
                onPress={() => handleNudgePress(nudge)}
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
                    <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: Spacing.xs }}>{nudge.body}</Text>
                    <Text style={{ ...Typography.caption, color: Colors.brand.accent, fontWeight: '600', marginTop: Spacing.sm }}>{nudge.actionLabel}</Text>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ backgroundColor: Colors.ui.surface, borderRadius: Radii.lg, padding: Spacing.xl }}>
              <Text style={{ ...Typography.body, color: Colors.ui.text, fontWeight: '600' }}>{t('dashboard.emptyState.title')}</Text>
              <Text style={{ ...Typography.caption, color: Colors.ui.textDim, marginTop: Spacing.xs }}>{t('dashboard.emptyState.body')}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: Spacing.xxl, marginTop: Spacing.section }}>
          <Text style={{ ...Typography.section, color: Colors.ui.textMuted, marginBottom: Spacing.md }}>{t('dashboard.quickActions')}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            {[
              { icon: 'document-text' as const, label: t('dashboard.invoices'), route: '/invoices' },
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
