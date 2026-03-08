/**
 * TaxBridge — Create Invoice Screen
 * Multi-step progressive form: client → items → review → submit
 * NRS e-invoice auto-submission, VAT 7.5% auto-calc, IRN display
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useCreateInvoice } from '../../store/queries';
import { Button, TextInputField, NairaInput, Card, Badge, TrustBadge } from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import { DURATION } from '../../design-system/animation';
import type { CreateInvoiceRequest, InvoiceItem } from '../../api/client';
import { VAT_RATE } from '@taxbridge/contracts';

// ─── NTA 2025 constants ───────────────────────────────────────────────────────

const NRS_THRESHOLD      = 200_000; // ₦200k — mandatory NRS stamp

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'client' | 'items' | 'review';

interface FormItem {
  id:          string;
  description: string;
  quantity:    number;
  unitPrice:   number;
  vatRate:     number;
}

interface ClientForm {
  clientName:  string;
  clientEmail: string;
  clientTin:   string;
  dueDate:     string;
  notes:       string;
}

// ─── Create Invoice Screen ────────────────────────────────────────────────────

export default function CreateInvoiceScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { mutateAsync: createInvoice, isPending } = useCreateInvoice();

  const [step, setStep]     = useState<Step>('client');
  const [client, setClient] = useState<ClientForm>({
    clientName: '', clientEmail: '', clientTin: '',
    dueDate: defaultDueDate(), notes: '',
  });
  const [items, setItems] = useState<FormItem[]>([newItem()]);

  // ─── Computed Totals ────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const subtotal  = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const vatAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * i.vatRate, 0);
    const total     = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  }, [items]);

  const needsNRS = totals.total >= NRS_THRESHOLD;

  // ─── Step Navigation ────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (step === 'client') setStep('items');
    else if (step === 'items') setStep('review');
  }, [step]);

  const goBack = useCallback(() => {
    if (step === 'items') setStep('client');
    else if (step === 'review') setStep('items');
    else router.back();
  }, [step]);

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    try {
      const payload: CreateInvoiceRequest = {
        clientName:  client.clientName,
        clientEmail: client.clientEmail || undefined,
        clientTin:   client.clientTin   || undefined,
        dueDate:     client.dueDate,
        notes:       client.notes       || undefined,
        items: items.map(i => ({
          description: i.description,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          vatRate:     i.vatRate,
        })),
      };
      const invoice = await createInvoice(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/invoices/${invoice.id}`);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('invoice.createFailed'));
    }
  }, [client, items, createInvoice, t]);

  // ─── Item helpers ───────────────────────────────────────────────────────────

  const addItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setItems(prev => [...prev, newItem()]);
  };

  const updateItem = (id: string, patch: Partial<FormItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // ─── Step validation ────────────────────────────────────────────────────────

  const clientValid = client.clientName.trim().length >= 2 && client.dueDate;
  const itemsValid  = items.every(i => i.description.trim() && i.quantity > 0 && i.unitPrice > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('invoice.newInvoice')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'client' && (
            <Animated.View entering={FadeInDown.duration(DURATION.transition)}>
              <ClientStep
                form={client}
                onChange={(k, v) => setClient(f => ({ ...f, [k]: v }))}
              />
              <Button
                label={t('common.next')}
                onPress={goNext}
                disabled={!clientValid}
                fullWidth size="lg"
              />
            </Animated.View>
          )}

          {step === 'items' && (
            <Animated.View entering={SlideInRight.duration(DURATION.transition)}>
              <ItemsStep
                items={items}
                onUpdate={updateItem}
                onRemove={removeItem}
                onAdd={addItem}
                totals={totals}
                needsNRS={needsNRS}
              />
              <Button
                label={t('common.reviewInvoice')}
                onPress={goNext}
                disabled={!itemsValid}
                fullWidth size="lg"
              />
            </Animated.View>
          )}

          {step === 'review' && (
            <Animated.View entering={SlideInRight.duration(DURATION.transition)}>
              <ReviewStep
                client={client}
                items={items}
                totals={totals}
                needsNRS={needsNRS}
              />
              <Button
                label={isPending ? t('common.submitting') : t('invoice.createAndSubmit')}
                onPress={handleSubmit}
                loading={isPending}
                disabled={isPending}
                fullWidth size="lg"
              />
              {needsNRS && (
                <Text style={styles.nrsNote}>
                  🔒 {t('invoice.nrsAutoSubmit')}
                </Text>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Step 1: Client Details ───────────────────────────────────────────────────

function ClientStep({
  form, onChange,
}: {
  form: ClientForm;
  onChange: (k: keyof ClientForm, v: string) => void;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];

  return (
    <View>
      <Text style={styles.stepTitle}>{t('invoice.clientDetails')}</Text>
      <TextInputField
        label={t('invoice.clientName')}
        value={form.clientName}
        onChangeText={v => onChange('clientName', v)}
        placeholder={t('invoice.clientNamePlaceholder')}
        autoCapitalize="words"
        required
      />
      <TextInputField
        label={`${t('invoice.clientEmail')} (${t('common.optional')})`}
        value={form.clientEmail}
        onChangeText={v => onChange('clientEmail', v)}
        placeholder="client@company.ng"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInputField
        label={`${t('invoice.clientTin')} (${t('common.optional')})`}
        value={form.clientTin}
        onChangeText={v => onChange('clientTin', v)}
        keyboardType="numeric"
        placeholder="1234567890"
        hint={t('invoice.tinHintWht')}
      />
      <TextInputField
        label={t('invoice.dueDate')}
        value={form.dueDate}
        onChangeText={v => onChange('dueDate', v)}
        placeholder="YYYY-MM-DD"
        keyboardType="numeric"
        required
      />
      <TextInputField
        label={`${t('invoice.notes')} (${t('common.optional')})`}
        value={form.notes}
        onChangeText={v => onChange('notes', v)}
        placeholder={t('invoice.notesPlaceholder')}
        multiline
        numberOfLines={3}
      />
    </View>
  );
}

// ─── Step 2: Line Items ───────────────────────────────────────────────────────

function ItemsStep({
  items, onUpdate, onRemove, onAdd, totals, needsNRS,
}: {
  items: FormItem[];
  onUpdate: (id: string, patch: Partial<FormItem>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  totals: { subtotal: number; vatAmount: number; total: number };
  needsNRS: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <Text style={styles.stepTitle}>{t('invoice.lineItems')}</Text>

      {items.map((item, idx) => (
        <Animated.View key={item.id} entering={FadeInDown.delay(idx * 50)}>
          <Card style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemCardLabel}>{t('invoice.item')} {idx + 1}</Text>
              {items.length > 1 && (
                <Pressable onPress={() => onRemove(item.id)} accessibilityRole="button">
                  <Text style={styles.removeBtn}>✕</Text>
                </Pressable>
              )}
            </View>

            <TextInputField
              label={t('invoice.description')}
              value={item.description}
              onChangeText={v => onUpdate(item.id, { description: v })}
              placeholder={t('invoice.descriptionPlaceholder')}
              required
            />

            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <NairaInput
                  label={t('invoice.unitPrice')}
                  value={item.unitPrice || undefined}
                  onChangeText={(raw) => onUpdate(item.id, { unitPrice: raw })}
                  required
                />
              </View>
              <View style={{ width: spacing[3] }} />
              <View style={{ width: 90 }}>
                <TextInputField
                  label={t('invoice.qty')}
                  value={String(item.quantity)}
                  onChangeText={v => onUpdate(item.id, { quantity: Number(v) || 1 })}
                  keyboardType="numeric"
                  required
                />
              </View>
            </View>

            {/* VAT toggle */}
            <Pressable
              style={styles.vatToggle}
              onPress={() => onUpdate(item.id, { vatRate: item.vatRate > 0 ? 0 : VAT_RATE })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.vatRate > 0 }}
            >
              <View style={[styles.checkbox, item.vatRate > 0 && styles.checkboxChecked]}>
                {item.vatRate > 0 && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.vatToggleText}>
                {t('invoice.applyVat')} (7.5% NTA 2025 §11)
              </Text>
            </Pressable>

            {/* Line total */}
            <View style={styles.itemTotal}>
              <Text style={styles.itemTotalLabel}>{t('invoice.lineTotal')}:</Text>
              <Text style={styles.itemTotalValue}>
                ₦{(item.quantity * item.unitPrice * (1 + item.vatRate)).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>
        </Animated.View>
      ))}

      <Pressable onPress={onAdd} style={styles.addItemBtn} accessibilityRole="button">
        <Text style={styles.addItemBtnText}>+ {t('invoice.addItem')}</Text>
      </Pressable>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <TotalRow label={t('invoice.subtotal')} value={totals.subtotal} />
        <TotalRow label="VAT (7.5%)" value={totals.vatAmount} />
        <View style={styles.summaryDivider} />
        <TotalRow label={t('invoice.total')} value={totals.total} bold />
        {needsNRS && (
          <TrustBadge type="nrs_stamped" label={t('invoice.nrsRequired')} />
        )}
      </Card>
    </View>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function ReviewStep({
  client, items, totals, needsNRS,
}: {
  client: ClientForm;
  items: FormItem[];
  totals: { subtotal: number; vatAmount: number; total: number };
  needsNRS: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <Text style={styles.stepTitle}>{t('invoice.reviewInvoice')}</Text>

      <Card style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>{t('invoice.client')}</Text>
        <ReviewRow label={t('invoice.clientName')} value={client.clientName} />
        {client.clientEmail && <ReviewRow label={t('invoice.email')} value={client.clientEmail} />}
        {client.clientTin   && <ReviewRow label="TIN" value={client.clientTin} />}
        <ReviewRow label={t('invoice.dueDate')} value={client.dueDate} />
      </Card>

      <Card style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>{t('invoice.items')}</Text>
        {items.map((item, idx) => (
          <View key={item.id} style={idx < items.length - 1 ? styles.reviewItemSep : undefined}>
            <Text style={styles.reviewItemDesc}>{item.description}</Text>
            <Text style={styles.reviewItemMath}>
              {item.quantity} × ₦{item.unitPrice.toLocaleString('en-NG')}
              {item.vatRate > 0 ? ' + VAT' : ''}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>{t('invoice.summary')}</Text>
        <TotalRow label={t('invoice.subtotal')} value={totals.subtotal} />
        <TotalRow label="VAT (7.5%)" value={totals.vatAmount} />
        <View style={styles.summaryDivider} />
        <TotalRow label={t('invoice.total')} value={totals.total} bold />
        {needsNRS && (
          <View style={{ marginTop: spacing[3] }}>
            <TrustBadge type="nrs_stamped" label={t('invoice.willBeNrsStamped')} />
          </View>
        )}
      </Card>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['client', 'items', 'review'];
  const labels = ['Client', 'Items', 'Review'];
  return (
    <View style={styles.stepIndicator}>
      {steps.map((s, idx) => (
        <React.Fragment key={s}>
          <View style={[styles.stepDot, current === s && styles.stepDotActive,
            steps.indexOf(current) > idx && styles.stepDotDone]}>
            <Text style={[styles.stepDotText,
              (current === s || steps.indexOf(current) > idx) && styles.stepDotTextActive]}>
              {steps.indexOf(current) > idx ? '✓' : idx + 1}
            </Text>
          </View>
          {idx < steps.length - 1 && (
            <View style={[styles.stepLine,
              steps.indexOf(current) > idx && styles.stepLineDone]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && styles.totalLabelBold]}>{label}</Text>
      <Text style={[styles.totalValue, bold && styles.totalValueBold]}>
        ₦{value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <Text style={styles.reviewRowValue}>{value}</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newItem(): FormItem {
  return { id: Math.random().toString(36).slice(2), description: '', quantity: 1, unitPrice: 0, vatRate: VAT_RATE };
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.gray[50] },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[4] },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding, paddingVertical: spacing[3],
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 22, color: colors.textSecondary },

  stepIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing[3], backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.screenPadding,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.gray[200],
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.primary[500] },
  stepDotDone:   { backgroundColor: colors.primary[500] },
  stepDotText:   { fontSize: 12, fontWeight: typography.weights.bold, color: colors.textMuted },
  stepDotTextActive: { color: colors.textInverse },
  stepLine:  { flex: 1, height: 2, backgroundColor: colors.gray[200], marginHorizontal: spacing[2] },
  stepLineDone: { backgroundColor: colors.primary[500] },

  stepTitle: {
    fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[4],
  },

  itemCard:       { marginBottom: spacing[3] },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  itemCardLabel:  { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.textSecondary },
  removeBtn:      { fontSize: 16, color: colors.error, padding: spacing[1] },
  itemRow:        { flexDirection: 'row', alignItems: 'flex-start' },

  vatToggle:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
  checkmark:       { color: colors.textInverse, fontSize: 11, fontWeight: typography.weights.bold },
  vatToggleText:   { fontSize: typography.sizes.sm, color: colors.textSecondary, flex: 1 },

  itemTotal: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing[2] },
  itemTotalLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
  itemTotalValue: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary },

  addItemBtn: {
    borderWidth: 2, borderColor: colors.primary[200],
    borderStyle: 'dashed', borderRadius: radii.md,
    paddingVertical: spacing[3],
    alignItems: 'center', marginBottom: spacing[4],
  },
  addItemBtnText: { color: colors.primary[600], fontWeight: typography.weights.semibold, fontSize: typography.sizes.sm },

  summaryCard:    { marginBottom: spacing[4] },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing[2] },
  totalRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  totalLabel:     { fontSize: typography.sizes.sm, color: colors.textMuted },
  totalLabelBold: { fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textPrimary },
  totalValue:     { fontSize: typography.sizes.sm, color: colors.textSecondary },
  totalValueBold: { fontSize: typography.sizes.lg, fontWeight: typography.weights.extrabold, color: colors.primary[600] },

  nrsNote: {
    fontSize: typography.sizes.xs, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing[2], lineHeight: 16,
  },

  reviewSection: { marginBottom: spacing[3] },
  reviewSectionTitle: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2],
  },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  reviewRowLabel: { fontSize: typography.sizes.sm, color: colors.textMuted },
  reviewRowValue: { fontSize: typography.sizes.sm, color: colors.textPrimary, fontWeight: typography.weights.medium, flex: 1, textAlign: 'right' },
  reviewItemSep:  { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing[2], marginBottom: spacing[2] },
  reviewItemDesc: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.textPrimary },
  reviewItemMath: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
});
