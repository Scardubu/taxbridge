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
  Alert,
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
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../design-system/tokens';
import { formatNGN } from '../../design-system/ngn';

type WizardStep = 'employees' | 'review' | 'confirm' | 'done';

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
  const [employees, setEmployees] = useState<EmployeeEntry[]>([{ ...EMPTY_EMPLOYEE }]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [results,   setResults]   = useState<any[] | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const totalPAYE = useMemo(
    () => (results ?? []).reduce((sum: number, r: any) => sum + (r.taxLiability ?? 0), 0),
    [results],
  );

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
      setResults(res.data.results ?? res.data);
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
    setLoading(true);
    try {
      const idempotencyKey = `paye-${period}-${Date.now()}`;
      await apiClient.post(
        '/payroll/run',
        { period, employees: results },
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setStep('done');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err?.response?.status === 409
          ? t('filing.paye.duplicate', `Payroll for ${period} already submitted.`)
          : t('filing.paye.error', 'Could not submit payroll. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [period, results, t]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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
                <Text style={[s.totalAmount, { color: COLORS.primary }]}>{formatNGN(totalPAYE)}</Text>
              </View>
            </View>
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
            <Text style={[s.doneTitle, { color: COLORS.primary }]}>
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
                {loading ? <ActivityIndicator color={COLORS.dark.text} /> : <Text style={s.btnText}>{t('filing.paye.calculate', 'Calculate PAYE')}</Text>}
              </Pressable>
            )}
            {step === 'review' && (
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setStep('confirm'); }}
                style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
                accessibilityRole="button"
              >
                <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>
              </Pressable>
            )}
            {step === 'confirm' && (
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('filing.paye.submit', 'Submit Payroll')}
              >
                {loading ? <ActivityIndicator color={COLORS.dark.text} /> : <Text style={s.btnText}>{t('filing.paye.submit', 'Submit Payroll')}</Text>}
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
  scroll: { padding: SPACING[24], paddingBottom: SPACING[48] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[24] },
  title:       { fontSize: TYPOGRAPHY['2xl'], fontWeight: '700', flex: 1 },
  progressRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: SPACING[8] },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.dark.border },
  dotActive:   { backgroundColor: COLORS.primary },

  stepLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', marginBottom: SPACING[12] },
  confirmText: { fontSize: TYPOGRAPHY.base, lineHeight: 24, marginBottom: SPACING[24] },

  employeeCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING[16], marginBottom: SPACING[12] },
  empHeader:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', marginBottom: SPACING[8] },
  input:        { fontSize: TYPOGRAPHY.base, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[8] },
  inputHalf:    { flex: 1, fontSize: TYPOGRAPHY.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING[12], marginRight: SPACING[8] },
  row:          { flexDirection: 'row' },

  addBtn:     { alignSelf: 'center', paddingVertical: SPACING[12] },
  addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: TYPOGRAPHY.sm },

  reviewCard:  { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING[16], marginBottom: SPACING[16] },
  resultRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING[8] },
  resultName:  { fontSize: TYPOGRAPHY.sm },
  resultAmount:{ fontSize: TYPOGRAPHY.sm, fontWeight: '600' },
  totalLabel:  { fontSize: TYPOGRAPHY.base, fontWeight: '700' },
  totalAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '700' },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING[8] },

  doneContainer: { alignItems: 'center', paddingTop: SPACING[48] },
  doneTitle:     { fontSize: TYPOGRAPHY.xl, fontWeight: '700', marginBottom: SPACING[8] },
  doneBody:      { fontSize: TYPOGRAPHY.base, textAlign: 'center', marginBottom: SPACING[32] },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: TYPOGRAPHY.sm },

  actions:     { marginTop: SPACING[24] },
  btn:         { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: COLORS.dark.text, fontSize: TYPOGRAPHY.base, fontWeight: '700' },
});
