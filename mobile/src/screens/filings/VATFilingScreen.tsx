/**
 * VAT Monthly Filing Screen (MOD-22)
 *
 * Wizard steps:
 *   1. Period selection (auto-selects last unfiled month)
 *   2. Output VAT review (NRS-stamped invoices)
 *   3. Input VAT review (receipted expenses)
 *   4. Prior-period credit display (C-22 — never recomputed)
 *   5. Net calculation + payment or credit carryforward
 *   6. Preflight compliance check before Submit CTA
 *
 * NIL condition: if output+input = 0, redirect to NILReturnScreen.
 * Deadline: "Due 21st {{month}} — {{days}} days" + red badge ≤ 5 days
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { apiClient } from '../../services/apiClient';
import { useTheme } from '../../hooks/useTheme';
import { colors, typography, spacing, radii } from '../../design-system/tokens';
import { formatNGN } from '../../design-system/ngn';
import { ConfettiAnimation } from '../../components/shared/ConfettiAnimation';
import { generateUuid } from '../../utils/uuid';

// ─── Types ────────────────────────────────────────────────────────────────

type WizardStep = 'period' | 'output' | 'input' | 'review' | 'confirm';

type PreflightCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
};

type PreflightResult = {
  pass: boolean;
  checks: PreflightCheck[];
};

function currentPeriod(): string {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getDaysToVATDeadline(period: string): number {
  const [year, month] = period.split('-').map(Number);
  const deadline      = new Date(year, month, 21);  // 21st of following month
  return Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
}

// ─── Component ────────────────────────────────────────────────────────────

export default function VATFilingScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();
  const navigation   = useNavigation<any>();

  const STEPS: WizardStep[] = ['period', 'output', 'input', 'review', 'confirm'];
  const STEP_TITLES: Record<WizardStep, string> = {
    period: t('wizard.period', 'Select Period'),
    output: t('wizard.outputVat', 'Output VAT'),
    input: t('wizard.inputVat', 'Input VAT'),
    review: t('wizard.review', 'Review'),
    confirm: t('wizard.confirm', 'Confirm'),
  };
  const [step,        setStep]        = useState<WizardStep>('period');
  const currentStep = STEPS.indexOf(step) + 1;
  const totalSteps = STEPS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${currentStep} of ${totalSteps}: ${STEP_TITLES[step]}`
    );
  }, [step]);

  const [period,      setPeriod]      = useState(currentPeriod());
  const [outputVAT,   setOutputVAT]   = useState(0);
  const [inputVAT,    setInputVAT]    = useState(0);
  const [creditCarry, setCreditCarry] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [preflight,   setPreflight]   = useState<PreflightResult | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const net        = outputVAT - inputVAT - creditCarry;
  const daysLeft   = useMemo(() => getDaysToVATDeadline(period), [period]);
  const isUrgent   = daysLeft <= 5;
  const isLate     = daysLeft < 0;

  const PREFLIGHT_ERROR_MESSAGE = 'Could not run preflight checks.';

  // Preflight check before showing Submit CTA (§6.9)
  const runPreflight = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/filings/preflight', { params: { taxType: 'VAT', period } });
      const result = res.data as PreflightResult;
      setPreflight(result);
      if (!result.pass) {
        const failures = result.checks.filter((check) => check.status === 'fail');
        if (failures.length > 0) {
          setError(failures.map((check) => check.message ?? check.name).join('; '));
        }
        return false;
      }
      return true;
    } catch {
      const fallback = {
        pass: false,
        checks: [{ name: 'preflight', status: 'fail' as const, message: t('filing.preflight.error', PREFLIGHT_ERROR_MESSAGE) }],
      };
      setPreflight(fallback);
      setError(t('filing.preflight.error', PREFLIGHT_ERROR_MESSAGE));
      return false;
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  const handleNext = useCallback(async () => {
    Haptics.selectionAsync();
    switch (step) {
      case 'period': {
        // Load actual VAT data from backend
        setLoading(true);
        try {
          const res = await apiClient.get('/invoices/vat-summary', { params: { period } });
          setOutputVAT(res.data.outputVAT ?? 0);
          setInputVAT(res.data.inputVAT ?? 0);
          setCreditCarry(res.data.creditCarryforward ?? 0);
          setStep('output');
        } catch {
          setStep('output');  // Proceed with defaults on error (C-07)
        } finally {
          setLoading(false);
        }
        break;
      }
      case 'output': setStep('input');   break;
      case 'input':  setStep('review');  break;
      case 'review': {
        // Preflight before confirm step
        const ok = await runPreflight();
        if (ok) setStep('confirm');
        break;
      }
      default: break;
    }
  }, [step, period, runPreflight]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setLoading(true);

    try {
      const idempotencyKey = generateUuid();
      const res = await apiClient.post(
        '/filings/vat',
        { period, outputVAT, inputVAT },
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      Alert.alert(
        t('filing.vat.successTitle', 'VAT Return Filed'),
        res.data.paymentRequired
          ? t('filing.vat.paymentRequired', `₦${net.toLocaleString()} VAT payment required.`)
          : t('filing.vat.creditCarryforward', `₦${Math.abs(net).toLocaleString()} credit carried forward.`),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err?.response?.status === 409) {
        setError(t('filing.vat.duplicate', `VAT return for ${period} already submitted.`));
      } else {
        setError(t('filing.vat.error', 'Could not submit VAT return. Try again.'));
      }
    } finally {
      setLoading(false);
    }
  }, [period, outputVAT, inputVAT, net, t, navigation]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showConfetti && <ConfettiAnimation onFinish={() => setShowConfetti(false)} />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t('filing.vat.title', 'VAT Monthly Return')}
          </Text>
          {/* Deadline badge */}
          <View style={[s.deadlineBadge, isLate ? s.deadlineLate : isUrgent ? s.deadlineUrgent : s.deadlineOk]}>
            <Text style={s.deadlineText}>
              {isLate
                ? t('filing.overdue', 'OVERDUE')
                : t('filing.dueIn', `Due in ${daysLeft} days`)}
            </Text>
          </View>
        </Animated.View>

        {/* ── Step: Period ──────────────────────────────────────────── */}
        {step === 'period' && (
          <Animated.View entering={FadeInRight.duration(300)} key="period">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.vat.period', 'Filing Period: ')}
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{period}</Text>
            </Text>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.vat.periodHint', 'Auto-selected: last unfiled month.')}
            </Text>
          </Animated.View>
        )}

        {/* ── Step: Output VAT ─────────────────────────────────────── */}
        {step === 'output' && (
          <Animated.View entering={FadeInRight.duration(300)} key="output">
            <SummaryRow label={t('filing.vat.outputVAT', 'Output VAT (Sales)')} value={outputVAT} />
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.vat.outputHint', 'Total VAT collected on NRS-stamped invoices for this period.')}
            </Text>
          </Animated.View>
        )}

        {/* ── Step: Input VAT ──────────────────────────────────────── */}
        {step === 'input' && (
          <Animated.View entering={FadeInRight.duration(300)} key="input">
            <SummaryRow label={t('filing.vat.inputVAT', 'Input VAT (Expenses)')} value={inputVAT} />
            <SummaryRow label={t('filing.vat.creditCarryforward', 'Prior Period Credit')} value={creditCarry} />
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.vat.inputHint', 'VAT paid on eligible business expenses.')}
            </Text>
          </Animated.View>
        )}

        {/* ── Step: Review ─────────────────────────────────────────── */}
        {step === 'review' && (
          <Animated.View entering={FadeInRight.duration(300)} key="review">
            <View style={[s.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SummaryRow label={t('filing.vat.outputVAT', 'Output VAT')}     value={outputVAT}   />
              <SummaryRow label={t('filing.vat.inputVAT', 'Input VAT')}       value={-inputVAT}   isDeduction />
              <SummaryRow label={t('filing.vat.creditCarryforward', 'Credit')} value={-creditCarry} isDeduction />
              <View style={s.divider} />
              <SummaryRow
                label={net >= 0 ? t('filing.vat.netDue', 'Net VAT Due') : t('filing.vat.netCredit', 'Net Credit')}
                value={Math.abs(net)}
                isTotal
                isCredit={net < 0}
              />
            </View>
            {preflight?.checks.filter((check) => check.status === 'warn').map((warning, i: number) => (
              <View key={i} style={s.warningBanner}>
                <Text style={s.warningText}>⚠️ {warning.message ?? warning.name}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ── Step: Confirm ────────────────────────────────────────── */}
        {step === 'confirm' && (
          <Animated.View entering={FadeInRight.duration(300)} key="confirm">
            <Text style={[s.confirmText, { color: colors.textPrimary }]}>
              {net >= 0
                ? t('filing.vat.confirmPayment', `You are filing a VAT return for ${period} with ₦${net.toLocaleString()} payable.`)
                : t('filing.vat.confirmCredit', `You are filing a VAT return for ${period} with ₦${Math.abs(net).toLocaleString()} credit carryforward.`)}
            </Text>
          </Animated.View>
        )}

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* ── Action buttons ───────────────────────────────────────── */}
        <View style={s.actions}>
          {step !== 'confirm' ? (
            <Pressable
              onPress={handleNext}
              disabled={loading}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue', 'Continue')}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSubmit}
              disabled={loading || preflight?.pass !== true}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('filing.vat.submit', 'Submit VAT Return')}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('filing.vat.submit', 'Submit VAT Return')}</Text>}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

interface SummaryRowProps { label: string; value: number; isDeduction?: boolean; isTotal?: boolean; isCredit?: boolean }
function SummaryRow({ label, value, isDeduction, isTotal, isCredit }: SummaryRowProps) {
  const { colors } = useTheme();
  return (
    <View style={srStyles.row}>
      <Text style={[srStyles.label, isTotal && srStyles.totalLabel, { color: isTotal ? colors.textPrimary : colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[
        srStyles.value,
        isTotal && srStyles.totalValue,
        isCredit && { color: colors.primary[500] },
        { color: isTotal ? (isCredit ? colors.primary[500] : colors.error) : colors.textPrimary },
      ]}>
        {isDeduction ? '−' : ''}{formatNGN(Math.abs(value))}
      </Text>
    </View>
  );
}

const srStyles = StyleSheet.create({
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[8] },
  label:      { fontSize: typography.sizes.sm },
  value:      { fontSize: typography.sizes.sm, fontWeight: '600' },
  totalLabel: { fontWeight: '700', fontSize: typography.sizes.base },
  totalValue: { fontWeight: '700', fontSize: typography.sizes.base },
});

// ─── Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: spacing[24], paddingBottom: spacing['2xl'] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[24] },
  title:       { fontSize: typography.sizes['2xl'], fontWeight: '700', flex: 1 },
  deadlineBadge:{ paddingVertical: spacing[4], paddingHorizontal: spacing[8], borderRadius: radii.sm },
  deadlineOk:  { backgroundColor: '#D1FAE5' },
  deadlineUrgent:{ backgroundColor: '#FEF3C7' },
  deadlineLate:{ backgroundColor: '#FEE2E2' },
  deadlineText:{ fontSize: typography.sizes.xs, fontWeight: '700', color: '#1F2937' },

  stepLabel:   { fontSize: typography.sizes.base, fontWeight: '600', marginBottom: spacing[8] },
  hint:        { fontSize: typography.sizes.xs, marginBottom: spacing[24], lineHeight: 18 },
  confirmText: { fontSize: typography.sizes.base, lineHeight: 24, marginBottom: spacing[24] },

  reviewCard:  { borderRadius: radii.lg, borderWidth: 1, padding: spacing[16], marginBottom: spacing[16] },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: spacing[8] },

  warningBanner: { backgroundColor: '#FEF3C7', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[8] },
  warningText:   { color: '#92400E', fontSize: typography.sizes.xs },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: typography.sizes.sm },

  actions:     { marginTop: spacing[24] },
  btn:         { height: 52, backgroundColor: colors.primary[500], borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: typography.sizes.base, fontWeight: '700' },
});
