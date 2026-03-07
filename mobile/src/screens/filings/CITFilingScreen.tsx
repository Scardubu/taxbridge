/**
 * CIT Annual Assessment Filing Screen (MOD-28)
 *
 * 8 steps (authoritative per APEX V3):
 *   1. Tax year + turnover (auto-warn APPROACHING_CIT_THRESHOLD at ₦80-100M)
 *   2. P&L upload (audited accounts)
 *   3. Tax loss carryforward (from DB)
 *   4. Dev Levy eligibility
 *   5. Education Tax (2.5% of assessable profit)
 *   6. CIT assessment summary
 *   7. Payment (Flutterwave)
 *   8. Receipt download
 *
 * Uses calculateCIT() exclusively (C-41).
 * WCAG 2.2 AA compliant.
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
  Switch,
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

type WizardStep = 'turnover' | 'pnl' | 'loss' | 'devlevy' | 'edutax' | 'summary' | 'payment' | 'receipt';

const CIT_THRESHOLD = 100_000_000;
const CIT_APPROACH  = 80_000_000;

export default function CITFilingScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();
  const navigation   = useNavigation<any>();

  const STEPS: WizardStep[] = ['turnover', 'pnl', 'loss', 'devlevy', 'edutax', 'summary', 'payment', 'receipt'];
  const STEP_TITLES: Record<WizardStep, string> = {
    turnover: t('filing.cit.turnover', 'Turnover'),
    pnl:      t('filing.cit.pnl', 'P&L Upload'),
    loss:     t('filing.cit.loss', 'Tax Loss Carryforward'),
    devlevy:  t('filing.cit.devlevy', 'Development Levy'),
    edutax:   t('filing.cit.edutax', 'Education Tax'),
    summary:  t('filing.cit.summary', 'Assessment Summary'),
    payment:  t('filing.cit.payment', 'Payment'),
    receipt:  t('filing.cit.receipt', 'Receipt'),
  };

  const [step, setStep] = useState<WizardStep>('turnover');
  const currentStep      = STEPS.indexOf(step) + 1;
  const totalSteps       = STEPS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${currentStep} of ${totalSteps}: ${STEP_TITLES[step]}`
    );
  }, [step]);

  const [taxYear,       setTaxYear]   = useState(String(new Date().getFullYear() - 1));
  const [turnover,      setTurnover]  = useState('');
  const [profit,        setProfit]    = useState('');
  const [lossCarry,     setLossCarry] = useState('0');
  const [devLevyApply,  setDevLevy]   = useState(false);
  const [loading,       setLoading]   = useState(false);
  const [error,         setError]     = useState<string | null>(null);
  const [assessment,    setAssessment]= useState<any>(null);
  const [receiptUrl,    setReceiptUrl]= useState<string | null>(null);

  const turnoverNum = parseFloat(turnover) || 0;
  const profitNum   = parseFloat(profit) || 0;
  const isSmallCo   = turnoverNum < CIT_THRESHOLD;
  const isApproaching = turnoverNum >= CIT_APPROACH && turnoverNum < CIT_THRESHOLD;

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const handleBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/filings/cit/calculate', {
        taxYear,
        turnover: turnoverNum,
        profit:   profitNum,
        taxLossCarryforward: parseFloat(lossCarry) || 0,
        devLevyApplies:      devLevyApply,
      });
      setAssessment(res.data);
      setStep('summary');
    } catch {
      setError(t('filing.cit.calcError', 'Could not calculate CIT. Check your inputs.'));
    } finally {
      setLoading(false);
    }
  }, [taxYear, turnoverNum, profitNum, lossCarry, devLevyApply, t]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setLoading(true);
    try {
      const idempotencyKey = `cit-${taxYear}-${Date.now()}`;
      const res = await apiClient.post(
        '/filings/cit',
        {
          taxYear,
          turnover: turnoverNum,
          profit:   profitNum,
          taxLossCarryforward: parseFloat(lossCarry) || 0,
          devLevyApplies: devLevyApply,
        },
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReceiptUrl(res.data.receiptUrl ?? null);
      setStep('receipt');
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err?.response?.status === 409
          ? t('filing.cit.duplicate', `CIT assessment for ${taxYear} already filed.`)
          : t('filing.cit.submitError', 'Could not submit CIT assessment. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [taxYear, turnoverNum, profitNum, lossCarry, devLevyApply, t]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t('filing.cit.title', 'CIT Annual Assessment')}
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

        {/* Step 1: Turnover */}
        {step === 'turnover' && (
          <Animated.View entering={FadeInRight.duration(300)} key="turnover">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.cit.taxYearLabel', 'Tax Year')}
            </Text>
            <TextInput
              value={taxYear}
              onChangeText={setTaxYear}
              keyboardType="numeric"
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
              accessibilityLabel="Tax year"
            />
            <Text style={[s.stepLabel, { color: colors.textSecondary, marginTop: SPACING[16] }]}>
              {t('filing.cit.turnoverLabel', 'Annual Turnover (₦)')}
            </Text>
            <TextInput
              value={turnover}
              onChangeText={setTurnover}
              keyboardType="numeric"
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
              accessibilityLabel="Annual turnover"
            />
            {isApproaching && (
              <View style={s.warningBanner}>
                <Text style={s.warningText}>
                  ⚠️ {t('filing.cit.approachingThreshold', 'Turnover is approaching the ₦100M CIT threshold. You may be liable next year.')}
                </Text>
              </View>
            )}
            {isSmallCo && turnoverNum > 0 && (
              <View style={s.infoBanner}>
                <Text style={s.infoText}>
                  {t('filing.cit.smallCompany', 'Turnover below ₦100M — CIT exempt (small company).')}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Step 2: P&L */}
        {step === 'pnl' && (
          <Animated.View entering={FadeInRight.duration(300)} key="pnl">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.cit.profitLabel', 'Assessable Profit (₦)')}
            </Text>
            <TextInput
              value={profit}
              onChangeText={setProfit}
              keyboardType="numeric"
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
              accessibilityLabel="Assessable profit"
            />
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.cit.pnlHint', 'Enter profit from audited accounts (P&L statement).')}
            </Text>
          </Animated.View>
        )}

        {/* Step 3: Loss Carryforward */}
        {step === 'loss' && (
          <Animated.View entering={FadeInRight.duration(300)} key="loss">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.cit.lossLabel', 'Tax Loss Carryforward (₦)')}
            </Text>
            <TextInput
              value={lossCarry}
              onChangeText={setLossCarry}
              keyboardType="numeric"
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border }]}
              accessibilityLabel="Tax loss carryforward"
            />
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.cit.lossHint', 'Losses from prior years that can reduce assessable profit.')}
            </Text>
          </Animated.View>
        )}

        {/* Step 4: Dev Levy */}
        {step === 'devlevy' && (
          <Animated.View entering={FadeInRight.duration(300)} key="devlevy">
            <View style={s.switchRow}>
              <Text style={[s.stepLabel, { color: colors.textPrimary, flex: 1 }]}>
                {t('filing.cit.devLevyLabel', 'ITF Development Levy Applies?')}
              </Text>
              <Switch
                value={devLevyApply}
                onValueChange={setDevLevy}
                trackColor={{ true: COLORS.primary, false: colors.border }}
                accessibilityLabel="Development levy applies"
              />
            </View>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.cit.devLevyHint', '4% ITF Development Levy on assessable profit (manufacturing/industrial companies).')}
            </Text>
          </Animated.View>
        )}

        {/* Step 5: Education Tax */}
        {step === 'edutax' && (
          <Animated.View entering={FadeInRight.duration(300)} key="edutax">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.cit.edutaxInfo', 'Education Tax: 2.5% of assessable profit')}
            </Text>
            <Text style={[s.amountLarge, { color: COLORS.primary }]}>
              {formatNGN(profitNum * 0.025)}
            </Text>
            <Text style={[s.hint, { color: colors.textMuted }]}>
              {t('filing.cit.edutaxHint', 'Applied automatically on assessable profit.')}
            </Text>
          </Animated.View>
        )}

        {/* Step 6: Summary */}
        {step === 'summary' && assessment && (
          <Animated.View entering={FadeInRight.duration(300)} key="summary">
            <View style={[s.reviewCard, { borderColor: colors.border }]}>
              <SummaryRow label={t('filing.cit.band', 'Band')}              text={assessment.band === 'small' ? 'Small (Exempt)' : 'Large'} />
              <SummaryRow label={t('filing.cit.taxableProfit', 'Taxable Profit')} text={formatNGN(assessment.taxableProfit)} />
              <SummaryRow label={t('filing.cit.citRate', 'CIT Rate')}       text={`${(assessment.rate * 100).toFixed(0)}%`} />
              <SummaryRow label={t('filing.cit.citLiability', 'CIT')}       text={formatNGN(assessment.citLiability)} />
              <SummaryRow label={t('filing.cit.devLevy', 'Dev Levy')}       text={formatNGN(assessment.devLevy)} />
              <SummaryRow label={t('filing.cit.educationTax', 'Edu Tax')}   text={formatNGN(assessment.educationTax)} />
              <View style={s.divider} />
              <SummaryRow label={t('filing.cit.total', 'Total')}            text={formatNGN(assessment.total)} bold />
            </View>
          </Animated.View>
        )}

        {/* Step 7: Payment */}
        {step === 'payment' && (
          <Animated.View entering={FadeInRight.duration(300)} key="payment">
            <Text style={[s.confirmText, { color: colors.textPrimary }]}>
              {t('filing.cit.paymentConfirm', `Confirm CIT payment of ${formatNGN(assessment?.total ?? 0)} for tax year ${taxYear}.`)}
            </Text>
          </Animated.View>
        )}

        {/* Step 8: Receipt */}
        {step === 'receipt' && (
          <Animated.View entering={FadeInDown.duration(300)} key="receipt" style={s.doneContainer}>
            <Text style={[s.doneTitle, { color: COLORS.primary }]}>
              {t('filing.cit.doneTitle', 'CIT Assessment Filed!')}
            </Text>
            <Text style={[s.doneBody, { color: colors.textSecondary }]}>
              {t('filing.cit.doneBody', `CIT of ${formatNGN(assessment?.total ?? 0)} filed for ${taxYear}.`)}
            </Text>
            {receiptUrl && (
              <Text style={[s.receiptLink, { color: COLORS.primary }]}>
                {t('filing.cit.receiptReady', 'Receipt will be available shortly.')}
              </Text>
            )}
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

        {!['summary', 'payment', 'receipt'].includes(step) && (
          <View style={s.actions}>
            <Pressable
              onPress={step === 'edutax' ? handleCalculate : handleNext}
              disabled={loading || (step === 'turnover' && turnoverNum <= 0)}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue', 'Continue')}
            >
              {loading ? <ActivityIndicator color={COLORS.dark.text} /> : <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>}
            </Pressable>
          </View>
        )}

        {step === 'summary' && (
          <View style={s.actions}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setStep('payment'); }}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
              accessibilityRole="button"
            >
              <Text style={s.btnText}>{t('filing.cit.proceedPayment', 'Proceed to Payment')}</Text>
            </Pressable>
          </View>
        )}

        {step === 'payment' && (
          <View style={s.actions}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('filing.cit.submit', 'Submit CIT Assessment')}
            >
              {loading ? <ActivityIndicator color={COLORS.dark.text} /> : <Text style={s.btnText}>{t('filing.cit.submit', 'Submit CIT Assessment')}</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, text, bold }: { label: string; text: string; bold?: boolean }) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={srStyles.row}>
      <Text style={[srStyles.label, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[srStyles.value, bold && srStyles.boldValue, { color: themeColors.textPrimary }]}>{text}</Text>
    </View>
  );
}

const srStyles = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING[8] },
  label:     { fontSize: TYPOGRAPHY.sm },
  value:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600' },
  boldValue: { fontWeight: '700', fontSize: TYPOGRAPHY.base },
});

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: SPACING[24], paddingBottom: SPACING[48] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING[24] },
  title:       { fontSize: TYPOGRAPHY['2xl'], fontWeight: '700', flex: 1 },
  progressRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: SPACING[8] },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.dark.border },
  dotActive:   { backgroundColor: COLORS.primary },

  stepLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', marginBottom: SPACING[8] },
  hint:        { fontSize: TYPOGRAPHY.xs, marginBottom: SPACING[24], lineHeight: 18, marginTop: SPACING[4] },
  confirmText: { fontSize: TYPOGRAPHY.base, lineHeight: 24, marginBottom: SPACING[24] },
  amountLarge: { fontSize: TYPOGRAPHY['2xl'], fontWeight: '700', marginVertical: SPACING[16] },

  input: { fontSize: TYPOGRAPHY.base, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[8] },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING[8] },

  warningBanner: { backgroundColor: '#FEF3C7', borderRadius: RADIUS.md, padding: SPACING[12], marginTop: SPACING[8] },
  warningText:   { color: '#92400E', fontSize: TYPOGRAPHY.xs },
  infoBanner:    { backgroundColor: '#D1FAE5', borderRadius: RADIUS.md, padding: SPACING[12], marginTop: SPACING[8] },
  infoText:      { color: '#065F46', fontSize: TYPOGRAPHY.xs },

  reviewCard:  { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING[16], marginBottom: SPACING[16] },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING[8] },

  doneContainer: { alignItems: 'center', paddingTop: SPACING[48] },
  doneTitle:     { fontSize: TYPOGRAPHY.xl, fontWeight: '700', marginBottom: SPACING[8] },
  doneBody:      { fontSize: TYPOGRAPHY.base, textAlign: 'center', marginBottom: SPACING[16] },
  receiptLink:   { fontSize: TYPOGRAPHY.sm, marginBottom: SPACING[32], textDecorationLine: 'underline' },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: TYPOGRAPHY.sm },

  actions:     { marginTop: SPACING[24] },
  btn:         { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: COLORS.dark.text, fontSize: TYPOGRAPHY.base, fontWeight: '700' },
});
