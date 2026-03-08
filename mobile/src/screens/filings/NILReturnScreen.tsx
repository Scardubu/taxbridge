/**
 * NIL Return Screen (MOD-21)
 *
 * Allows filing a NIL (zero) return for any tax type when there are
 * no taxable transactions in the period.
 *
 * Includes:
 *   - Period selection (current month auto-selected)
 *   - Tax type selection
 *   - NilReason selection (NO_REVENUE_THIS_PERIOD, BUSINESS_INACTIVE, etc.)
 *   - Penalty warning if late
 *   - Idempotency: 409 DUPLICATE_FILING handled gracefully
 *   - Compliance preflight before submission
 *
 * Constraints:
 *   C-06  All strings via i18n (en + pidgin)
 *   C-19  No "no anomaly" style messaging
 *   C-20  scale(0.97) ack on Pressable
 *   C-34  No schema.parse() inline — uses backend validation
 *   C-35  Idempotency via X-Idempotency-Key header
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { apiClient } from '../../services/apiClient';
import { useTheme } from '../../hooks/useTheme';
import { colors, typography, spacing, radii } from '../../design-system/tokens';
import { calculatePenalty } from '@taxbridge/contracts';
import { ConfettiAnimation } from '../../components/shared/ConfettiAnimation';
import { generateUuid } from '../../utils/uuid';

// ─── Constants ────────────────────────────────────────────────────────────

const TAX_TYPES = ['VAT', 'WHT', 'PAYE', 'CIT'] as const;
type TaxType = typeof TAX_TYPES[number];

const NIL_REASONS = [
  { id: 'NO_REVENUE_THIS_PERIOD',       label: 'No revenue this period',           pidgin: 'No money come in for this period' },
  { id: 'BUSINESS_INACTIVE',            label: 'Business temporarily inactive',    pidgin: 'Business don close small time' },
  { id: 'EXEMPT_SUPPLY_ONLY',           label: 'Exempt supply only',              pidgin: 'Only exempt goods/services' },
  { id: 'BELOW_REGISTRATION_THRESHOLD', label: 'Below registration threshold',    pidgin: 'Too small to register' },
] as const;

type NilReasonId = typeof NIL_REASONS[number]['id'];

type PreflightCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
};

type PreflightResult = {
  pass: boolean;
  checks: PreflightCheck[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isLate(taxType: TaxType, period: string): boolean {
  const [year, month] = period.split('-').map(Number);
  let deadline: Date;
  switch (taxType) {
    case 'PAYE': deadline = new Date(year, month, 10);  break;  // 10th next month
    default:     deadline = new Date(year, month, 21);  break;  // 21st next month
  }
  return Date.now() > deadline.getTime();
}

function getPenaltyInfo(taxType: TaxType, period: string): { daysLate: number; penalty: number } | null {
  const [year, month] = period.split('-').map(Number);
  let deadline: Date;
  switch (taxType) {
    case 'PAYE': deadline = new Date(year, month, 10);  break;
    default:     deadline = new Date(year, month, 21);  break;
  }
  const daysLate = Math.max(0, Math.floor((Date.now() - deadline.getTime()) / 86_400_000));
  if (daysLate === 0) return null;
  const info = calculatePenalty({ entityType: 'company', daysLate, taxAmountDue: 0, disclosurePhase: 'after_assessment' });
  return { daysLate, penalty: info.netPenalty };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function NILReturnScreen() {
  const { t, i18n }  = useTranslation();
  const { colors }   = useTheme();
  const navigation   = useNavigation<any>();

  const NIL_STEPS = ['type', 'period', 'reason', 'confirm'] as const;
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const totalSteps = NIL_STEPS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${currentStepIdx + 1} of ${totalSteps}: NIL Return`
    );
  }, [currentStepIdx]);

  const [taxType,  setTaxType]  = useState<TaxType>('VAT');
  const [period,   setPeriod]   = useState(currentPeriod());
  const [reason,   setReason]   = useState<NilReasonId>('NO_REVENUE_THIS_PERIOD');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const isPidgin = i18n.language === 'pidgin';
  const penaltyInfo = useMemo(() => getPenaltyInfo(taxType, period), [taxType, period]);

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const response = await apiClient.get('/filings/preflight', {
        params: { taxType, period },
      });
      const result = response.data as PreflightResult;
      setPreflight(result);
      return result;
    } catch {
      const fallback = {
        pass: false,
        checks: [{ name: 'preflight', status: 'fail' as const, message: t('filing.preflight.error', 'Could not run preflight checks.') }],
      };
      setPreflight(fallback);
      return fallback;
    } finally {
      setPreflightLoading(false);
    }
  }, [taxType, period, t]);

  useEffect(() => {
    runPreflight().catch(() => undefined);
  }, [runPreflight]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    if (preflight?.pass !== true) {
      setError(t('filing.preflight.blocked', 'Resolve the blocking preflight checks before submitting.'));
      return;
    }
    setLoading(true);

    try {
      const idempotencyKey = generateUuid();
      await apiClient.post(
        '/filings/nil',
        { taxType, period, nilReason: reason },
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setSubmitted(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.response?.status === 409) {
        setError(t('filing.nil.duplicate', `NIL ${taxType} return for ${period} was already submitted.`));
      } else {
        setError(t('filing.nil.error', 'Could not submit NIL return. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  }, [preflight, taxType, period, reason, t]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showConfetti && <ConfettiAnimation onFinish={() => setShowConfetti(false)} />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t('filing.nil.title', 'File NIL Return')}
          </Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>
            {t('filing.nil.subtitle', 'No taxable activity this period? File a NIL return to stay compliant.')}
          </Text>
        </Animated.View>

        {submitted && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.successBox}>
            <Text style={s.successTitle}>{t('filing.nil.successTitle', 'NIL Return Filed')}</Text>
            <Text style={s.successText}>
              {t('filing.nil.successMessage', `NIL ${taxType} return for ${period} has been submitted.`)}
            </Text>
          </Animated.View>
        )}

        {/* ── Penalty warning ─────────────────────────────────────────── */}
        {penaltyInfo && (
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={s.penaltyBanner}>
            <Text style={s.penaltyTitle}>⚠️ {t('filing.nil.lateTitle', 'Late Filing')}</Text>
            <Text style={s.penaltyText}>
              {t('filing.nil.lateMessage', `${penaltyInfo.daysLate} days late. Estimated penalty: ₦${penaltyInfo.penalty.toLocaleString()}`)}
            </Text>
          </Animated.View>
        )}

        {preflightLoading && (
          <View style={s.infoBox}>
            <Text style={s.infoBoxText}>{t('filing.preflight.loading', 'Running compliance preflight checks...')}</Text>
          </View>
        )}

        {preflight?.checks.filter((check) => check.status === 'warn').map((check) => (
          <View key={`warn-${check.name}`} style={s.warningBanner}> 
            <Text style={s.warningText}>⚠️ {check.message ?? check.name}</Text>
          </View>
        ))}

        {preflight?.checks.filter((check) => check.status === 'fail').map((check) => (
          <View key={`fail-${check.name}`} style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {check.message ?? check.name}</Text>
          </View>
        ))}

        {/* ── Tax type selector ───────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
            {t('filing.nil.taxType', 'Tax Type')}
          </Text>
          <View style={s.chipRow}>
            {TAX_TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => { setTaxType(type); Haptics.selectionAsync(); }}
                style={({ pressed }) => [
                  s.chip,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  taxType === type && { borderColor: colors.primary[500], backgroundColor: `${colors.primary[500]}18` },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: taxType === type }}
                accessibilityLabel={type}
              >
                <Text style={[s.chipText, { color: taxType === type ? colors.primary[500] : colors.textPrimary }]}>
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── NIL reason selector ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)} style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
            {t('filing.nil.reason', 'Reason for NIL Return')}
          </Text>
          {NIL_REASONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => { setReason(r.id); Haptics.selectionAsync(); }}
              style={({ pressed }) => [
                s.reasonRow,
                { borderColor: reason === r.id ? colors.primary[500] : colors.border, backgroundColor: reason === r.id ? `${colors.primary[500]}18` : colors.surface },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === r.id }}
              accessibilityLabel={isPidgin ? r.pidgin : r.label}
            >
              <View style={[s.radio, { borderColor: reason === r.id ? colors.primary[500] : colors.border }]}>
                {reason === r.id && <View style={s.radioDot} />}
              </View>
              <Text style={[s.reasonText, { color: colors.textPrimary }]}>
                {isPidgin ? r.pidgin : r.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Error message ────────────────────────────────────────────── */}
        {error && (
          <Animated.View entering={FadeInDown.duration(200)} style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </Animated.View>
        )}

        {/* ── Submit button ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)}>
          <Pressable
            onPress={submitted ? () => navigation.goBack() : handleSubmit}
            disabled={loading || preflightLoading || (!submitted && preflight?.pass !== true)}
            style={({ pressed }) => [s.submitBtn, pressed && s.submitBtnPressed, loading && s.submitBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={submitted ? t('common.done', 'Done') : t('filing.nil.submit', 'Submit NIL Return')}
            accessibilityState={{ disabled: loading || preflightLoading || (!submitted && preflight?.pass !== true) }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>{submitted ? t('common.done', 'Done') : t('filing.nil.submit', 'Submit NIL Return')}</Text>
            }
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: spacing[24], paddingBottom: spacing['2xl'] },

  title:    { fontSize: typography.sizes['2xl'], fontWeight: '700', marginBottom: spacing[8] },
  subtitle: { fontSize: typography.sizes.sm, marginBottom: spacing[24], lineHeight: 22 },

  penaltyBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius:    radii.md,
    padding:         spacing[16],
    marginBottom:    spacing[16],
    borderWidth:     1,
    borderColor:     '#F59E0B',
  },
  penaltyTitle: { color: '#92400E', fontWeight: '700', fontSize: typography.sizes.sm, marginBottom: spacing[4] },
  penaltyText:  { color: '#78350F', fontSize: typography.sizes.xs, lineHeight: 18 },

  successBox:   { backgroundColor: '#ECFDF5', borderRadius: radii.md, padding: spacing[16], marginBottom: spacing[16], borderWidth: 1, borderColor: '#A7F3D0' },
  successTitle: { color: '#065F46', fontWeight: '700', fontSize: typography.sizes.base, marginBottom: spacing[4] },
  successText:  { color: '#047857', fontSize: typography.sizes.sm },

  infoBox:      { backgroundColor: '#EFF6FF', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#BFDBFE' },
  infoBoxText:  { color: '#1D4ED8', fontSize: typography.sizes.xs },

  warningBanner:{ backgroundColor: '#FEF3C7', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#FCD34D' },
  warningText:  { color: '#92400E', fontSize: typography.sizes.sm },

  section:      { marginBottom: spacing[24] },
  sectionLabel: { fontSize: typography.sizes.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[12] },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  chip:    { paddingVertical: spacing[8], paddingHorizontal: spacing[16], borderRadius: radii.full, borderWidth: 1.5 },
  chipText:{ fontSize: typography.sizes.sm, fontWeight: '600' },

  reasonRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing[16],
    borderRadius:   radii.md,
    borderWidth:    1.5,
    marginBottom:   spacing[8],
    gap:            spacing[12],
  },
  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary[500] },
  reasonText:{ flex: 1, fontSize: typography.sizes.sm },

  errorBox:  { backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#991B1B', fontSize: typography.sizes.sm },

  submitBtn:         { height: 52, backgroundColor: colors.primary[500], borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  submitBtnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { color: '#fff', fontSize: typography.sizes.base, fontWeight: '700' },
});
