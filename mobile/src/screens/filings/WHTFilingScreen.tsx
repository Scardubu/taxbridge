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
import { ConfettiAnimation } from '../../components/shared/ConfettiAnimation';

type WizardStep = 'category' | 'amount' | 'review' | 'confirm';

const CATEGORIES = [
  { key: 'professional',  label: 'Professional / Consultancy', rate: 0.10 },
  { key: 'management',    label: 'Management / Technical',     rate: 0.10 },
  { key: 'dividends',     label: 'Dividends',                  rate: 0.10 },
  { key: 'interest',      label: 'Interest',                   rate: 0.10 },
  { key: 'royalties',     label: 'Royalties',                  rate: 0.10 },
  { key: 'rent',          label: 'Rent',                       rate: 0.10 },
  { key: 'construction',  label: 'Construction',               rate: 0.05 },
  { key: 'survey',        label: 'Survey',                     rate: 0.05 },
  { key: 'contracts',     label: 'Contracts',                  rate: 0.05 },
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

  const selectedRate = useMemo(
    () => CATEGORIES.find(c => c.key === selectedCategory)?.rate ?? 0,
    [selectedCategory],
  );
  const gross     = parseFloat(grossAmount) || 0;
  const whtAmount = gross * selectedRate;
  const isExempt  = recipientTIN.trim().length > 0 && gross <= 2_000_000;

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
      case 'review':
        setStep('confirm');
        break;
      default: break;
    }
  }, [step, selectedCategory, gross]);

  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setLoading(true);
    try {
      const idempotencyKey = `wht-${period}-${selectedCategory}-${Date.now()}`;
      await apiClient.post(
        '/filings/wht',
        { period, category: selectedCategory, grossAmount: gross, recipientTIN: recipientTIN.trim() || undefined },
        { headers: { 'X-Idempotency-Key': idempotencyKey } },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowConfetti(true);
      Alert.alert(
        t('filing.wht.successTitle', 'WHT Remittance Filed'),
        t('filing.wht.successBody', `WHT of ${formatNGN(whtAmount)} has been filed for ${period}.`),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(
        err?.response?.status === 409
          ? t('filing.wht.duplicate', 'WHT remittance already submitted for this period.')
          : t('filing.wht.error', 'Could not submit WHT remittance. Try again.'),
      );
    } finally {
      setLoading(false);
    }
  }, [period, selectedCategory, gross, recipientTIN, whtAmount, t, navigation]);

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showConfetti && <ConfettiAnimation onFinish={() => setShowConfetti(false)} />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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
                  { borderColor: selectedCategory === cat.key ? COLORS.primary : colors.border },
                  selectedCategory === cat.key && { backgroundColor: COLORS.primary + '10' },
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
            <Text style={[s.stepLabel, { color: colors.textSecondary, marginTop: SPACING[16] }]}>
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
              disabled={loading || (step === 'category' && !selectedCategory) || (step === 'amount' && gross <= 0)}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('common.continue', 'Continue')}
            >
              <Text style={s.btnText}>{t('common.continue', 'Continue')}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [s.btn, pressed && s.btnPressed, loading && s.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('filing.wht.submit', 'Submit WHT Remittance')}
            >
              {loading ? <ActivityIndicator color={COLORS.dark.text} /> : <Text style={s.btnText}>{t('filing.wht.submit', 'Submit WHT Remittance')}</Text>}
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
  confirmText: { fontSize: TYPOGRAPHY.base, lineHeight: 24, marginBottom: SPACING[24] },

  categoryCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[8] },
  categoryLabel:{ fontSize: TYPOGRAPHY.sm, flex: 1 },
  rateBadge:    { backgroundColor: COLORS.amber + '22', paddingHorizontal: SPACING[8], paddingVertical: 2, borderRadius: RADIUS.sm },
  rateText:     { color: COLORS.amber, fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  input: { fontSize: TYPOGRAPHY.base, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[8] },

  exemptBanner: { backgroundColor: '#D1FAE5', borderRadius: RADIUS.md, padding: SPACING[12], marginTop: SPACING[8] },
  exemptText:   { color: '#065F46', fontSize: TYPOGRAPHY.xs },

  reviewCard:  { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING[16], marginBottom: SPACING[16] },
  divider:     { height: 1, backgroundColor: '#E5E7EB', marginVertical: SPACING[8] },

  errorBox:    { backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: SPACING[12], marginBottom: SPACING[16], borderWidth: 1, borderColor: '#FECACA' },
  errorText:   { color: '#991B1B', fontSize: TYPOGRAPHY.sm },

  actions:     { marginTop: SPACING[24] },
  btn:         { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  btnPressed:  { opacity: 0.88, transform: [{ scale: 0.97 }] },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: COLORS.dark.text, fontSize: TYPOGRAPHY.base, fontWeight: '700' },
});
