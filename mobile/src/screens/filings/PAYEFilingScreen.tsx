/**
 * PAYE Payroll Filing Screen (MOD-24)
 *
 * Per-employee PIT calculation via calculatePIT from @taxbridge/contracts.
 * Idempotency on POST /api/v1/payroll/run.
 * ConfettiAnimation on completion.
 *
 * WCAG 2.2 AA: announceForAccessibility on step changes,
 * progressbar semantics, 44×44 touch targets.
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
  TextInput,
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
import { generateUuid } from '../../utils/uuid';
import { getBusinessProfile } from '../../services/businessApi';
import { enqueueFilingRequest } from '../../services/filingQueue';
import { isOfflineError } from '../../services/apiClient';
import { ConfettiAnimation } from '../../components/shared/ConfettiAnimation';

type WizardStep = 'employees' | 'review' | 'confirm' | 'done';

type PreflightCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
};

type PreflightResult = {
  pass: boolean;
  checks: PreflightCheck[];
};

interface EmployeeEntry {
  name: string;
  grossIncome: string;
  rentPaid: string;
  pension: string;
}

const EMPTY_EMPLOYEE: EmployeeEntry = { name: '', grossIncome: '', rentPaid: '0', pension: '0' };

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PAYEFilingScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();
  const navigation   = useNavigation<any>();

  const STEPS: WizardStep[] = ['employees', 'review', 'confirm', 'done'];
  const STEP_TITLES: Record<WizardStep, string> = {
    employees: t('filing.paye.employees', 'Employee Details'),
    review:    t('wizard.review', 'Review'),
    confirm:   t('wizard.confirm', 'Confirm'),
    done:      t('wizard.done', 'Done'),
  };

  const [step, setStep]         = useState<WizardStep>('employees');
  const currentStep             = STEPS.indexOf(step) + 1;
  const totalSteps              = STEPS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${currentStep} of ${totalSteps}: ${STEP_TITLES[step]}`
    );
  }, [step]);

  const [period]                = useState(currentPeriod());
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeEntry[]>([{ ...EMPTY_EMPLOYEE }]);

  useEffect(() => {
    getBusinessProfile()
      .then((profile) => setBusinessId(profile.id))
      .catch(() => setError(t('filing.paye.noBusinessError', 'Could not load business profile.')));
  }, []);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [results,   setResults]   = useState<any[] | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const totalPAYE = useMemo(
    () => (results ?? []).reduce((sum: number, r: any) => sum + (r.taxLiability ?? 0), 0),
    [results],
  );

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const response = await apiClient.get('/filings/preflight', { params: { taxType: 'PAYE', period } });
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
  }, [period, t]);

  const addEmployee = useCallback(() => {
    setEmployees(prev => [...prev, { ...EMPTY_EMPLOYEE }]);
  }, []);

  const updateEmployee = useCallback((index: number, field: keyof EmployeeEntry, value: string) => {
    setEmployees(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }, []);

  const handleCalculate = useCallback(async () => {
    Haptics.selectionAsync();
    setLoading(true);
    setError(null);
    try {
      const payload = employees
        .filter(e => e.name.trim() && parseFloat(e.grossIncome) > 0)
        .map(e => ({
          name:        e.name.trim(),
          grossIncome: parseFloat(e.grossIncome) || 0,
          rentPaid:    parseFloat(e.rentPaid) || 0,
          pension:     parseFloat(e.pension) || 0,
        }));
      if (payload.length === 0) {
        setError(t('filing.paye.noEmployees', 'Add at least one employee with a gross income.'));
        return;
      }
      const res = await apiClient.post('/payroll/calculate', { period, employees: payload });
      setResults(res.data?.data?.results ?? res.data?.results ?? res.data);
      setStep('review');
    } catch {
      setError(t('filing.paye.calcError', 'Could not calculate PAYE. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [employees, period, t]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    if (preflight?.pass !== true) {
      setError(t('filing.preflight.blocked', 'Resolve the blocking preflight checks before submitting.'));
      return;
    }
    setLoading(true);
    try {
      if (!businessId) {
        setError(t('filing.paye.noBusinessError', 'Business profile not loaded.'));
        return;
      }
      const idempotencyKey = generateUuid();
      const payload = { businessId, period };
      await apiClient.post(
        '/payroll/process',
        payload,
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setSubmitted(true);
      setStep('done');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isOfflineError(err) && businessId) {
        const idempotencyKey = generateUuid();
        await enqueueFilingRequest({
          idempotencyKey,
          endpoint: '/payroll/process',
          payload: { businessId, period },
          createdAt: new Date().toISOString(),
        });
        setError(t('filing.offlineQueued', 'You are offline. This filing has been queued and will retry when network returns.'));
      } else {
        setError(
          err?.response?.status === 409
            ? t('filing.paye.duplicate', `Payroll for ${period} already submitted.`)
            : t('filing.paye.error', 'Could not submit payroll. Try again.'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, period, preflight, t]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showConfetti && <ConfettiAnimation onFinish={() => setShowConfetti(false)} />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t('filing.paye.title', 'PAYE Payroll Run')}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
            style={s.progressRow}
          >
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i < currentStep && s.dotActive]} />
            ))}
          </View>
        </Animated.View>

        {preflightLoading && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>ℹ️ {t('filing.preflight.loading', 'Running compliance preflight checks...')}</Text>
          </View>
        )}

        {preflight?.checks.filter((check) => check.status === 'warn').map((check) => (
          <View key={check.name} style={s.warningBanner}>
            <Text style={s.warningText}>⚠️ {check.message ?? check.name}</Text>
          </View>
        ))}

        {step === 'employees' && (
          <Animated.View entering={FadeInRight.duration(300)} key="employees">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.paye.addEmployees', 'Add employees for this payroll period')}
            </Text>
            {employees.map((emp, idx) => (
              <View key={idx} style={[s.employeeCard, { borderColor: colors.border }]}>
                <Text style={[s.empHeader, { color: colors.textPrimary }]}>
                  {t('filing.paye.employee', `Employee ${idx + 1}`)}
                </Text>
                <TextInput
                  value={emp.name}
                  onChangeText={v => updateEmployee(idx, 'name', v)}
                  placeholder={t('filing.paye.namePlaceholder', 'Full name')}
                  placeholderTextColor={colors.textMuted}
                  style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  accessibilityLabel={`Employee ${idx + 1} name`}
                />
                <TextInput
                  value={emp.grossIncome}
                  onChangeText={v => updateEmployee(idx, 'grossIncome', v)}
                  placeholder={t('filing.paye.grossPlaceholder', 'Annual gross income (₦)')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  accessibilityLabel={`Employee ${idx + 1} gross income`}
                />
                <View style={s.row}>
                  <TextInput
                    value={emp.rentPaid}
                    onChangeText={v => updateEmployee(idx, 'rentPaid', v)}
                    placeholder="Rent paid"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[s.inputHalf, { color: colors.textPrimary, borderColor: colors.border }]}
                    accessibilityLabel={`Employee ${idx + 1} rent paid`}
                  />
                  <TextInput
                    value={emp.pension}
                    onChangeText={v => updateEmployee(idx, 'pension', v)}
                    placeholder="Pension"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[s.inputHalf, { color: colors.textPrimary, borderColor: colors.border }]}
                    accessibilityLabel={`Employee ${idx + 1} pension`}
                  />
                </View>
              </View>
            ))}
            <Pressable onPress={addEmployee} style={s.addBtn} accessibilityRole="button">
              <Text style={s.addBtnText}>+ {t('filing.paye.addAnother', 'Add Employee')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {step === 'review' && results && (
          <Animated.View entering={FadeInRight.duration(300)} key="review">
            <View style={[s.reviewCard, { borderColor: colors.border }]}>
              {results.map((r: any, i: number) => (
                <View key={i} style={s.resultRow}>
                  <Text style={[s.resultName, { color: colors.textPrimary }]}>{r.name ?? `Employee ${i + 1}`}</Text>
                  <Text style={[s.resultAmount, { color: colors.textSecondary }]}>{formatNGN(r.taxLiability ?? 0)}</Text>
                </View>
              ))}
              <View style={s.divider} />
              <View style={s.resultRow}>
                <Text style={[s.totalLabel, { color: colors.textPrimary }]}>{t('filing.paye.totalPAYE', 'Total PAYE')}</Text>
                <Text style={[s.totalAmount, { color: colors.primary[500] }]}>{formatNGN(totalPAYE)}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                runPreflight().then((result) => {
                  if (result.pass) {
                    Haptics.selectionAsync();
                    setStep('confirm');
                  }
                }).catch(() => undefined);
              }}
              disabled={preflightLoading}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, preflightLoading && s.btnDisabled]}
              accessibilityRole="button"
            >
              <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {step === 'confirm' && (
          <Animated.View entering={FadeInRight.duration(300)} key="confirm">
            <Text style={[s.confirmText, { color: colors.textPrimary }]}>
              {t('filing.paye.confirmBody', `Submit PAYE payroll for ${period} — total ${formatNGN(totalPAYE)} for ${results?.length ?? 0} employees.`)}
            </Text>
          </Animated.View>
        )}

        {step === 'done' && (
          <Animated.View entering={FadeInDown.duration(300)} key="done" style={s.doneContainer}>
            <Text style={[s.doneTitle, { color: colors.primary[500] }]}>
              {t('filing.paye.doneTitle', 'Payroll Submitted!')}
            </Text>
            <Text style={[s.doneBody, { color: colors.textSecondary }]}>
              {t('filing.paye.doneBody', `PAYE of ${formatNGN(totalPAYE)} filed for ${period}.`)}
            </Text>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              accessibilityRole="button"
            >
              <Text style={s.btnText}>{t('common.done', 'Done')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {step !== 'done' && (
          <View style={s.actions}>
            {step === 'employees' && (
              <Pressable
                onPress={handleCalculate}
                disabled={loading}
                style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('filing.paye.calculate', 'Calculate PAYE')}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.btnText}>{t('filing.paye.calculate', 'Calculate PAYE')}</Text>}
              </Pressable>
            )}
            {step === 'confirm' && (
              <Pressable
                onPress={submitted ? () => navigation.goBack() : handleSubmit}
                disabled={loading || (!submitted && preflight?.pass !== true)}
                style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={submitted ? t('common.done', 'Done') : t('filing.paye.submit', 'Submit Payroll')}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.btnText}>{submitted ? t('common.done', 'Done') : t('filing.paye.submit', 'Submit Payroll')}</Text>}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: spacing[24], paddingBottom: spacing['2xl'] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[24] },
  title:       { fontSize: typography.sizes['2xl'], fontWeight: '700', flex: 1 },
  progressRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: spacing[8] },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dark.border },
  dotActive:   { backgroundColor: colors.primary[500] },

  stepLabel:   { fontSize: typography.sizes.base, fontWeight: '600', marginBottom: spacing[12] },
  confirmText: { fontSize: typography.sizes.base, lineHeight: 24, marginBottom: spacing[24] },

  employeeCard: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[16], marginBottom: spacing[12] },
  empHeader:    { fontSize: typography.sizes.sm, fontWeight: '700', marginBottom: spacing[8] },
  input:        { fontSize: typography.sizes.base, borderWidth: 1, borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[8] },
  inputHalf:    { flex: 1, fontSize: typography.sizes.sm, borderWidth: 1, borderRadius: radii.md, padding: spacing[12], marginRight: spacing[8] },
  row:          { flexDirection: 'row' },

  addBtn:     { alignSelf: 'center', paddingVertical: spacing[12] },
  addBtnText: { color: colors.primary[500], fontWeight: '700', fontSize: typography.sizes.sm },

  reviewCard:  { borderWidth: 1, borderRadius: radii.lg, padding: spacing[16], marginBottom: spacing[16] },
  resultRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[8] },
  resultName:  { fontSize: typography.sizes.sm },
  resultAmount:{ fontSize: typography.sizes.sm, fontWeight: '600' },
  totalLabel:  { fontSize: typography.sizes.base, fontWeight: '700' },
  totalAmount: { fontSize: typography.sizes.base, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: spacing[8] },
  infoBox:      { backgroundColor: '#EFF6FF', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#BFDBFE' },
  infoText:     { color: '#1D4ED8', fontSize: typography.sizes.xs },
  warningBanner:{ backgroundColor: '#FEF3C7', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#FCD34D' },
  warningText:  { color: '#92400E', fontSize: typography.sizes.sm },

  doneContainer: { alignItems: 'center', paddingTop: spacing['2xl'] },
  doneTitle:     { fontSize: typography.sizes.xl, fontWeight: '700', marginBottom: spacing[8] },
  doneBody:      { fontSize: typography.sizes.base, textAlign: 'center', marginBottom: spacing[32] },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: typography.sizes.sm },

  actions:     { marginTop: spacing[24] },
  btn:         { height: 52, backgroundColor: colors.primary[500], borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#FFFFFF', fontSize: typography.sizes.base, fontWeight: '700' },
});
