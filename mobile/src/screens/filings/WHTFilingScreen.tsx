/**
 * WHT Remittance Filing Screen (MOD-23)
 *
 * Wizard steps:
 *   1. Period + recipient selection
 *   2. Category selection (rate table display)
 *   3. Amount entry + exemption check (C-23)
 *   4. Review + preflight
 *   5. Submit
 *
 * Rates sourced from @taxbridge/contracts constants only (C-10).
 * Exemption: BOTH TIN validated AND monthly total <= ₦2M (C-23).
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
import { ConfettiAnimation } from '../../components/shared/ConfettiAnimation';
import { generateUuid } from '../../utils/uuid';
import { WHT_RATES } from '@taxbridge/contracts';
import { enqueueFilingRequest } from '../../services/filingQueue';
import { isOfflineError } from '../../services/apiClient';

type WizardStep = 'category' | 'amount' | 'review' | 'confirm';

type PreflightCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
};

type PreflightResult = {
  pass: boolean;
  checks: PreflightCheck[];
};

const CATEGORIES = [
  { key: 'professional',  label: 'Professional / Consultancy', rate: WHT_RATES.professional },
  { key: 'management',    label: 'Management / Technical',     rate: WHT_RATES.management },
  { key: 'dividends',     label: 'Dividends',                  rate: WHT_RATES.dividends },
  { key: 'interest',      label: 'Interest',                   rate: WHT_RATES.interest },
  { key: 'royalties',     label: 'Royalties',                  rate: WHT_RATES.royalties },
  { key: 'rent',          label: 'Rent',                       rate: WHT_RATES.rent },
  { key: 'construction',  label: 'Construction',               rate: WHT_RATES.construction },
  { key: 'survey',        label: 'Survey',                     rate: WHT_RATES.survey },
  { key: 'contracts',     label: 'Contracts',                  rate: WHT_RATES.contracts },
] as const;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function WHTFilingScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();
  const navigation   = useNavigation<any>();

  const STEPS: WizardStep[] = ['category', 'amount', 'review', 'confirm'];
  const STEP_TITLES: Record<WizardStep, string> = {
    category: t('filing.wht.category', 'Select Category'),
    amount:   t('filing.wht.amount', 'Enter Amount'),
    review:   t('wizard.review', 'Review'),
    confirm:  t('wizard.confirm', 'Confirm'),
  };

  const [step,      setStep]      = useState<WizardStep>('category');
  const currentStep = STEPS.indexOf(step) + 1;
  const totalSteps  = STEPS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${currentStep} of ${totalSteps}: ${STEP_TITLES[step]}`
    );
  }, [step]);

  const [period]                        = useState(currentPeriod());
  const [selectedCategory, setCategory] = useState<string | null>(null);
  const [grossAmount,      setGross]    = useState('');
  const [recipientTIN,     setTIN]      = useState('');
  const [loading,          setLoading]  = useState(false);
  const [error,            setError]    = useState<string | null>(null);
  const [showConfetti,     setShowConfetti] = useState(false);
  const [submitted,        setSubmitted] = useState(false);
  const [preflight,        setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const selectedRate = useMemo(
    () => CATEGORIES.find(c => c.key === selectedCategory)?.rate ?? 0,
    [selectedCategory],
  );
  const gross     = parseFloat(grossAmount) || 0;
  const whtAmount = gross * selectedRate;
  const isExempt  = recipientTIN.trim().length > 0 && gross <= 2_000_000;

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const response = await apiClient.get('/filings/preflight', { params: { taxType: 'WHT', period } });
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

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();
    switch (step) {
      case 'category':
        if (!selectedCategory) return;
        setStep('amount');
        break;
      case 'amount':
        if (gross <= 0) return;
        setStep('review');
        break;
      case 'review': {
        runPreflight().then((result) => {
          if (result.pass) setStep('confirm');
        }).catch(() => undefined);
        break;
      }
      default: break;
    }
  }, [step, selectedCategory, gross, runPreflight]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    if (preflight?.pass !== true || !selectedCategory) {
      setError(t('filing.preflight.blocked', 'Resolve the blocking preflight checks before submitting.'));
      return;
    }
    setLoading(true);
    try {
      const idempotencyKey = generateUuid();
      const payload = {
        period,
        category: selectedCategory,
        amount: gross,
        counterpartyTin: recipientTIN.trim() || undefined,
        monthlyTotal: gross,
      };
      await apiClient.post(
        '/filings/wht',
        payload,
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      setSubmitted(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isOfflineError(err)) {
        const idempotencyKey = generateUuid();
        await enqueueFilingRequest({
          idempotencyKey,
          endpoint: '/filings/wht',
          payload: {
            period,
            category: selectedCategory,
            amount: gross,
            counterpartyTin: recipientTIN.trim() || undefined,
            monthlyTotal: gross,
          },
          createdAt: new Date().toISOString(),
        });
        setError(t('filing.offlineQueued', 'You are offline. This filing has been queued and will retry when network returns.'));
      } else {
        setError(
          err?.response?.status === 409
            ? t('filing.wht.duplicate', 'WHT remittance already submitted for this period.')
            : t('filing.wht.error', 'Could not submit WHT remittance. Try again.'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [period, preflight, selectedCategory, gross, recipientTIN, t]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showConfetti && <ConfettiAnimation onFinish={() => setShowConfetti(false)} />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t('filing.wht.title', 'WHT Remittance')}
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

        {submitted && (
          <View style={s.successBox}>
            <Text style={s.successTitle}>{t('filing.wht.successTitle', 'WHT Remittance Filed')}</Text>
            <Text style={s.successText}>{t('filing.wht.successBody', `WHT of ${formatNGN(whtAmount)} has been filed for ${period}.`)}</Text>
          </View>
        )}

        {preflightLoading && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>ℹ️ {t('filing.preflight.loading', 'Running compliance preflight checks...')}</Text>
          </View>
        )}

        {step === 'category' && (
          <Animated.View entering={FadeInRight.duration(300)} key="category">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.wht.selectCategory', 'Select WHT Category')}
            </Text>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.key}
                onPress={() => { Haptics.selectionAsync(); setCategory(cat.key); }}
                style={[
                  s.categoryCard,
                  { borderColor: selectedCategory === cat.key ? colors.primary[500] : colors.border },
                  selectedCategory === cat.key && { backgroundColor: colors.primary[500] + '10' },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedCategory === cat.key }}
                accessibilityLabel={`${cat.label} — ${cat.rate * 100}%`}
              >
                <Text style={[s.categoryLabel, { color: colors.textPrimary }]}>{cat.label}</Text>
                <View style={s.rateBadge}>
                  <Text style={s.rateText}>{cat.rate * 100}%</Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {step === 'amount' && (
          <Animated.View entering={FadeInRight.duration(300)} key="amount">
            <Text style={[s.stepLabel, { color: colors.textSecondary }]}>
              {t('filing.wht.grossLabel', 'Gross Payment Amount (₦)')}
            </Text>
            <TextInput
              value={grossAmount}
              onChangeText={setGross}
              keyboardType="numeric"
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="e.g. 500000"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('filing.wht.grossLabel', 'Gross payment amount')}
            />
            <Text style={[s.stepLabel, { color: colors.textSecondary, marginTop: spacing[16] }]}>
              {t('filing.wht.tinLabel', 'Recipient TIN (optional)')}
            </Text>
            <TextInput
              value={recipientTIN}
              onChangeText={setTIN}
              style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder="e.g. 12345678-0001"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('filing.wht.tinLabel', 'Recipient TIN')}
            />
            {isExempt && (
              <View style={s.exemptBanner}>
                <Text style={s.exemptText}>
                  {t('filing.wht.exempt', 'WHT exemption applies — TIN validated + amount ≤ ₦2M')}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {step === 'review' && (
          <Animated.View entering={FadeInRight.duration(300)} key="review">
            <View style={[s.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SummaryRow label={t('filing.wht.category', 'Category')} text={CATEGORIES.find(c => c.key === selectedCategory)?.label ?? ''} />
              <SummaryRow label={t('filing.wht.rate', 'Rate')}          text={`${selectedRate * 100}%`} />
              <SummaryRow label={t('filing.wht.gross', 'Gross Amount')} text={formatNGN(gross)} />
              <View style={s.divider} />
              <SummaryRow label={t('filing.wht.whtDue', 'WHT Due')}    text={isExempt ? '₦0 (exempt)' : formatNGN(whtAmount)} bold />
            </View>
            {preflight?.checks.filter((check) => check.status === 'warn').map((check) => (
              <View key={check.name} style={s.warningBanner}>
                <Text style={s.warningText}>⚠️ {check.message ?? check.name}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {step === 'confirm' && (
          <Animated.View entering={FadeInRight.duration(300)} key="confirm">
            <Text style={[s.confirmText, { color: colors.textPrimary }]}>
              {isExempt
                ? t('filing.wht.confirmExempt', `Filing WHT exemption for ${period}.`)
                : t('filing.wht.confirmPayment', `Filing WHT of ${formatNGN(whtAmount)} for ${period}.`)}
            </Text>
          </Animated.View>
        )}

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        <View style={s.actions}>
          {step !== 'confirm' ? (
            <Pressable
              onPress={handleNext}
              disabled={loading || preflightLoading || (step === 'category' && !selectedCategory) || (step === 'amount' && gross <= 0)}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue', 'Continue')}
            >
              <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={submitted ? () => navigation.goBack() : handleSubmit}
              disabled={loading || (!submitted && preflight?.pass !== true)}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={submitted ? t('common.done', 'Done') : t('filing.wht.submit', 'Submit WHT Remittance')}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.btnText}>{submitted ? t('common.done', 'Done') : t('filing.wht.submit', 'Submit WHT Remittance')}</Text>}
            </Pressable>
          )}
        </View>
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
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[8] },
  label:     { fontSize: typography.sizes.sm },
  value:     { fontSize: typography.sizes.sm, fontWeight: '600' },
  boldValue: { fontWeight: '700', fontSize: typography.sizes.base },
});

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { padding: spacing[24], paddingBottom: spacing['2xl'] },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[24] },
  title:       { fontSize: typography.sizes['2xl'], fontWeight: '700', flex: 1 },
  progressRow: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: spacing[8] },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.dark.border },
  dotActive:   { backgroundColor: colors.primary[500] },

  stepLabel:   { fontSize: typography.sizes.base, fontWeight: '600', marginBottom: spacing[8] },
  confirmText: { fontSize: typography.sizes.base, lineHeight: 24, marginBottom: spacing[24] },

  categoryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[8] },
  categoryLabel:{ fontSize: typography.sizes.sm, flex: 1 },
  rateBadge:    { backgroundColor: colors.accent[500] + '22', paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radii.sm },
  rateText:     { color: colors.accent[500], fontSize: typography.sizes.xs, fontWeight: '700' },

  input: { fontSize: typography.sizes.base, borderWidth: 1, borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[8] },

  exemptBanner: { backgroundColor: '#D1FAE5', borderRadius: radii.md, padding: spacing[12], marginTop: spacing[8] },
  exemptText:   { color: '#065F46', fontSize: typography.sizes.xs },

  successBox:   { backgroundColor: '#ECFDF5', borderRadius: radii.md, padding: spacing[16], marginBottom: spacing[16], borderWidth: 1, borderColor: '#A7F3D0' },
  successTitle: { color: '#065F46', fontSize: typography.sizes.base, fontWeight: '700', marginBottom: spacing[4] },
  successText:  { color: '#047857', fontSize: typography.sizes.sm },
  infoBox:      { backgroundColor: '#EFF6FF', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#BFDBFE' },
  infoText:     { color: '#1D4ED8', fontSize: typography.sizes.xs },
  warningBanner:{ backgroundColor: '#FEF3C7', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[12], borderWidth: 1, borderColor: '#FCD34D' },
  warningText:  { color: '#92400E', fontSize: typography.sizes.sm },

  reviewCard:  { borderRadius: radii.lg, borderWidth: 1, padding: spacing[16], marginBottom: spacing[16] },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: spacing[8] },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: radii.md, padding: spacing[12], marginBottom: spacing[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: typography.sizes.sm },

  actions:     { marginTop: spacing[24] },
  btn:         { height: 52, backgroundColor: colors.primary[500], borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#FFFFFF', fontSize: typography.sizes.base, fontWeight: '700' },
});
