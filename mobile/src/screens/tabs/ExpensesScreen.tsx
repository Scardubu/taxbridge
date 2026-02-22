/**
 * TaxBridge Expense Tracking Screen
 * OCR-first workflow, 13 NTA categories, VAT eligibility, offline-queued
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  RefreshControl, FlatList, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useExpenses, useCreateExpense, useDeleteExpense, useScanReceipt } from '../../store/queries';
import {
  Button, Card, Badge, NairaInput, TextInputField,
  EmptyState, Skeleton, TrustBadge,
} from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import type { Expense, CreateExpenseRequest } from '../../api/client';

// ─── NTA 2025 expense categories (M03 spec) ───────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'Food & Beverage',                emoji: '🍽️',  vatEligible: false },
  { value: 'Transportation',                 emoji: '🚗',  vatEligible: false },
  { value: 'Office Supplies',               emoji: '📎',  vatEligible: true  },
  { value: 'Utilities (PHCN/DSTV/Internet)', emoji: '💡',  vatEligible: false },
  { value: 'Professional Services',          emoji: '👔',  vatEligible: true  },
  { value: 'Rent & Accommodation',           emoji: '🏢',  vatEligible: false },
  { value: 'Marketing & Advertising',        emoji: '📣',  vatEligible: true  },
  { value: 'Equipment & Machinery',          emoji: '⚙️',  vatEligible: true  },
  { value: 'Raw Materials',                  emoji: '🏭',  vatEligible: true  },
  { value: 'Staff Welfare',                  emoji: '👥',  vatEligible: false },
  { value: 'Government Levies & Taxes',      emoji: '🏛️',  vatEligible: false },
  { value: 'Telecoms & Data',                emoji: '📡',  vatEligible: false },
  { value: 'General Business Expenses',      emoji: '💼',  vatEligible: false },
] as const;

// ─── Expense List Screen ──────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | undefined>();

  const {
    data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage,
  } = useExpenses({ category: filterCategory });
  const expenses = data?.expenses ?? [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('expenses.title')}</Text>
        <Button
          label={t('expenses.addExpense')}
          onPress={() => setShowAdd(true)}
          size="sm"
          variant="primary"
        />
      </View>

      {/* Category Filter */}
      <CategoryFilter
        selected={filterCategory}
        onSelect={setFilterCategory}
      />

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[0,1,2,3].map(i => <Skeleton key={i} height={80} style={{ marginBottom: 8 }} />)}
        </View>
      ) : expenses.length === 0 ? (
        <EmptyState
          emoji="📊"
          title={t('expenses.emptyTitle')}
          body={t('expenses.emptyBody')}
          action={{ label: t('expenses.addFirst'), onPress: () => setShowAdd(true) }}
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={e => e.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary[500]} />
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 30).duration(300)}>
              <ExpenseItem expense={item} />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
        />
      )}

      {/* Add Expense Sheet */}
      {showAdd && (
        <AddExpenseSheet onClose={() => setShowAdd(false)} />
      )}
    </View>
  );
}

// ─── Category Filter Bar ──────────────────────────────────────────────────────

function CategoryFilter({
  selected, onSelect,
}: { selected?: string; onSelect: (c?: string) => void }) {
  const { t } = useTranslation();
  const categories = [{ value: undefined, emoji: '🔍', label: t('common.all') }, ...EXPENSE_CATEGORIES];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBar}
    >
      {categories.map(cat => (
        <Pressable
          key={cat.value ?? 'all'}
          onPress={() => onSelect(cat.value)}
          style={[
            styles.filterChip,
            selected === cat.value && styles.filterChipActive,
          ]}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === cat.value }}
        >
          <Text style={styles.filterChipEmoji}>{cat.emoji}</Text>
          <Text style={[
            styles.filterChipLabel,
            selected === cat.value && styles.filterChipLabelActive,
          ]}>
            {'label' in cat ? cat.label : cat.value.split(' ')[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Expense Item ─────────────────────────────────────────────────────────────

function ExpenseItem({ expense }: { expense: Expense }) {
  const { t } = useTranslation();
  const { mutateAsync: deleteExpense } = useDeleteExpense();

  const cat = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
  const emoji = cat?.emoji ?? '💼';

  const handleDelete = useCallback(() => {
    Alert.alert(
      t('expenses.deleteTitle'),
      t('expenses.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(expense.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message);
            }
          },
        },
      ]
    );
  }, [expense.id, deleteExpense, t]);

  return (
    <Card style={styles.expenseCard} onPress={() => router.push(`/expenses/${expense.id}`)}>
      <View style={styles.expenseRow}>
        <View style={styles.expenseIconWrap}>
          <Text style={styles.expenseEmoji}>{emoji}</Text>
        </View>

        <View style={styles.expenseBody}>
          <Text style={styles.expenseMerchant} numberOfLines={1}>
            {expense.vendorName ?? expense.description ?? expense.category}
          </Text>
          <Text style={styles.expenseCategory}>{expense.category}</Text>
          <Text style={styles.expenseDate}>{formatDate(expense.date)}</Text>
        </View>

        <View style={styles.expenseRight}>
          <Text style={styles.expenseAmount}>
            ₦{expense.amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
          </Text>
          {expense.vatEligible && (
            <Badge label="VAT" variant="success" size="sm" />
          )}
          {expense.receiptUrl && (
            <Text style={styles.receiptIcon}>🧾</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

// ─── Add Expense Bottom Sheet ─────────────────────────────────────────────────

function AddExpenseSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { mutateAsync: createExpense, isPending } = useCreateExpense();
  const { mutateAsync: scanReceipt,  isPending: isScanning } = useScanReceipt();

  const [form, setForm] = useState<{
    amount:      number;
    category:    string;
    description: string;
    vendorName:  string;
    date:        string;
    vatEligible: boolean;
    vatAmount:   number;
  }>({
    amount:      0,
    category:    '',
    description: '',
    vendorName:  '',
    date:        new Date().toISOString().split('T')[0],
    vatEligible: false,
    vatAmount:   0,
  });

  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.value === form.category);

  const handleScanReceipt = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.permissionRequired'), t('expenses.cameraPermission'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]?.base64) return;

    try {
      const ocr = await scanReceipt({ base64: result.assets[0].base64 });
      // Pre-fill form from OCR result
      setForm(f => ({
        ...f,
        amount:      ocr.amount || f.amount,
        vendorName:  ocr.merchantName !== 'Unknown Merchant' ? ocr.merchantName : f.vendorName,
        category:    ocr.category || f.category,
        vatEligible: ocr.vatEligible,
        vatAmount:   ocr.vatAmount,
        date:        ocr.date || f.date,
      }));

      if (ocr.requiresReview) {
        Alert.alert(
          t('expenses.ocrReviewTitle'),
          `${t('expenses.ocrConfidence')}: ${Math.round(ocr.confidence * 100)}%\n${ocr.validationWarnings.join('\n')}`,
          [{ text: t('common.ok') }]
        );
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('expenses.ocrFailed'));
    }
  }, [scanReceipt, t]);

  const handleSubmit = useCallback(async () => {
    if (!form.amount || !form.category) return;

    try {
      const payload: CreateExpenseRequest = {
        amount:      form.amount,
        category:    form.category,
        description: form.description || undefined,
        vendorName:  form.vendorName  || undefined,
        date:        form.date,
        vatEligible: form.vatEligible,
        vatAmount:   form.vatEligible ? form.vatAmount || form.amount * 0.075 : undefined,
      };
      await createExpense(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message);
    }
  }, [form, createExpense, onClose, t]);

  const isValid = form.amount > 0 && form.category !== '';

  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.duration(350).springify()}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{t('expenses.addExpense')}</Text>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetScroll}
          >
            {/* OCR Scan Button */}
            <Pressable
              onPress={handleScanReceipt}
              disabled={isScanning}
              style={styles.scanBtn}
              accessibilityRole="button"
              accessibilityLabel={t('expenses.scanReceipt')}
            >
              <Text style={styles.scanBtnEmoji}>{isScanning ? '⏳' : '📷'}</Text>
              <Text style={styles.scanBtnText}>
                {isScanning ? t('expenses.scanning') : t('expenses.scanToAutofill')}
              </Text>
            </Pressable>

            <NairaInput
              label={t('expenses.amount')}
              value={form.amount || undefined}
              onChangeText={(raw) => {
                set('amount')(raw);
                if (form.vatEligible) set('vatAmount')(raw * 0.075);
              }}
              required
            />

            {/* Category Grid */}
            <Text style={styles.catLabel}>{t('expenses.category')} *</Text>
            <View style={styles.catGrid}>
              {EXPENSE_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.value}
                  onPress={() => {
                    set('category')(cat.value);
                    set('vatEligible')(cat.vatEligible);
                    if (cat.vatEligible && form.amount > 0) {
                      set('vatAmount')(form.amount * 0.075);
                    }
                  }}
                  style={[
                    styles.catChip,
                    form.category === cat.value && styles.catChipSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: form.category === cat.value }}
                >
                  <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.catChipText,
                      form.category === cat.value && styles.catChipTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {cat.value.split(' (')[0]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {form.category && (
              <Animated.View entering={FadeIn}>
                <TextInputField
                  label={t('expenses.vendorName')}
                  value={form.vendorName}
                  onChangeText={set('vendorName')}
                  placeholder={t('expenses.vendorPlaceholder')}
                />

                <TextInputField
                  label={t('expenses.description')}
                  value={form.description}
                  onChangeText={set('description')}
                  placeholder={t('expenses.descriptionPlaceholder')}
                />

                <TextInputField
                  label={t('expenses.date')}
                  value={form.date}
                  onChangeText={set('date')}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numeric"
                />

                {/* VAT Toggle */}
                {selectedCat?.vatEligible && (
                  <Card variant="success" style={styles.vatCard}>
                    <View style={styles.vatRow}>
                      <View>
                        <Text style={styles.vatTitle}>✅ {t('expenses.vatEligible')}</Text>
                        <Text style={styles.vatSub}>
                          {t('expenses.vatAmount')}: ₦{(form.vatAmount || form.amount * 0.075).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                      <TrustBadge type="nrs_stamped" label="NTA §11" compact />
                    </View>
                  </Card>
                )}
              </Animated.View>
            )}

            <Button
              label={isPending ? t('common.saving') : t('expenses.saveExpense')}
              onPress={handleSubmit}
              loading={isPending}
              disabled={!isValid || isPending}
              fullWidth
              size="lg"
              style={{ marginTop: spacing[4] }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.gray[50] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.screenPadding, paddingVertical: spacing[3],
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.textPrimary },
  loadingContainer: { padding: spacing.screenPadding },

  filterBar: { paddingHorizontal: spacing.screenPadding, paddingVertical: spacing[2], gap: spacing[2] },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  filterChipEmoji:  { fontSize: 14 },
  filterChipLabel:  { fontSize: 12, color: colors.textMuted, fontWeight: typography.weights.medium },
  filterChipLabelActive: { color: colors.primary[700] },

  list: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[2] },

  expenseCard:    { },
  expenseRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  expenseIconWrap:{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center' },
  expenseEmoji:   { fontSize: 22 },
  expenseBody:    { flex: 1 },
  expenseMerchant:{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.textPrimary },
  expenseCategory:{ fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 1 },
  expenseDate:    { fontSize: typography.sizes.xs, color: colors.textDisabled, marginTop: 1 },
  expenseRight:   { alignItems: 'flex-end', gap: 4 },
  expenseAmount: {
    fontSize: typography.sizes.base, fontWeight: typography.weights.bold,
    color: colors.textPrimary, fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
  },
  receiptIcon:    { fontSize: 12 },

  // Sheet
  sheetOverlay:   { ...StyleSheet.absoluteFillObject, zIndex: 50 },
  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.modal, borderTopRightRadius: radii.modal,
    padding: spacing[5], maxHeight: '90%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing[4],
  },
  sheetTitle: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing[4] },
  sheetScroll:{ },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    borderWidth: 2, borderColor: colors.primary[200], borderStyle: 'dashed',
    borderRadius: radii.md, padding: spacing[3], marginBottom: spacing[4],
    backgroundColor: colors.primary[50],
  },
  scanBtnEmoji: { fontSize: 22 },
  scanBtnText:  { fontSize: typography.sizes.base, color: colors.primary[700], fontWeight: typography.weights.semibold },

  catLabel: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium,
    color: colors.textSecondary, marginBottom: spacing[2],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  catChip: {
    width: '30%', alignItems: 'center', padding: spacing[2],
    borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.gray[50], gap: 4,
  },
  catChipSelected: { backgroundColor: colors.primary[50], borderColor: colors.primary[500] },
  catChipEmoji:    { fontSize: 22 },
  catChipText:     { fontSize: 10, color: colors.textMuted, textAlign: 'center', fontWeight: typography.weights.medium },
  catChipTextSelected: { color: colors.primary[700] },

  vatCard:  { marginBottom: spacing[3] },
  vatRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vatTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.primary[700] },
  vatSub:   { fontSize: typography.sizes.xs, color: colors.primary[600], marginTop: 2 },
});
