import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Colors, Radii, Spacing, Typography } from './design-system/tokens';
import { ExpenseCategories, type DraftReceipt, type ExpenseCategory } from '../types/receipt';

interface Props {
  draft: DraftReceipt;
  ocrFailed: boolean;
  processing: boolean;
  onSave: (confirmed: DraftReceipt) => Promise<void>;
  onRetake: () => void;
}

export function ReceiptReviewForm({ draft, ocrFailed, processing, onSave, onRetake }: Readonly<Props>) {
  const { t } = useTranslation();
  const [vendor, setVendor] = useState(draft.vendorName);
  const [amount, setAmount] = useState(draft.amountNgn > 0 ? String(draft.amountNgn) : '');
  const [vat, setVat] = useState(draft.vatAmountNgn > 0 ? String(draft.vatAmountNgn) : '');
  const [date, setDate] = useState(draft.date);
  const [category, setCategory] = useState<ExpenseCategory>(draft.category);
  const [vendorError, setVendorError] = useState(false);
  const [amountError, setAmountError] = useState(false);

  const fieldStyle = {
    backgroundColor: Colors.ui.surface,
    borderColor: Colors.ui.border,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.ui.text,
    ...Typography.body,
    marginBottom: Spacing.md,
  } as const;

  const labelStyle = {
    ...Typography.micro,
    color: Colors.ui.textDim,
    marginBottom: Spacing.xs,
  } as const;

  const handleConfirm = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const amountNgn = parseFloat(amount.replace(/,/g, '')) || 0;
    const vatAmountNgn = parseFloat(vat.replace(/,/g, '')) || 0;

    const hasVendorError = !vendor.trim();
    const hasAmountError = amountNgn <= 0;
    setVendorError(hasVendorError);
    setAmountError(hasAmountError);

    if (hasVendorError || hasAmountError) {
      return;
    }

    await onSave({
      ...draft,
      vendorName: vendor.trim(),
      amountNgn,
      vatAmountNgn,
      date,
      category,
    });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Colors.ui.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xxl }} keyboardShouldPersistTaps="handled">
        {ocrFailed ? (
          <View
            style={{
              backgroundColor: Colors.status.warningBg,
              borderColor: Colors.status.warningBorder,
              borderWidth: 1,
              borderRadius: Radii.lg,
              padding: Spacing.lg,
              marginBottom: Spacing.lg,
              flexDirection: 'row',
              gap: Spacing.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 20 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ ...Typography.caption, fontWeight: '600', color: Colors.status.warningText }}>
                {t('receipts.ocrFailed')}
              </Text>
              <Text style={{ ...Typography.micro, color: Colors.status.warningText, opacity: 0.8, marginTop: 2 }}>
                {t('receipts.ocrFailedBody')}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={{ ...Typography.title, color: Colors.ui.text, marginBottom: Spacing.section }}>
          {t('receipts.edit')}
        </Text>

        <Text style={labelStyle}>{t('receipts.vendor')} *</Text>
        <TextInput
          style={[
            fieldStyle,
            vendorError ? { borderColor: Colors.status.dangerBorder } : undefined,
          ]}
          value={vendor}
          onChangeText={(text) => { setVendor(text); if (vendorError) setVendorError(false); }}
          placeholder={t('receipts.vendorPlaceholder')}
          placeholderTextColor={Colors.ui.textDim}
          accessibilityLabel={t('receipts.vendor')}
          autoCapitalize="words"
          returnKeyType="next"
        />
        {vendorError ? (
          <Text
            style={{ ...Typography.micro, color: Colors.status.dangerText, marginTop: -Spacing.sm, marginBottom: Spacing.md }}
            accessibilityRole="alert"
          >
            {t('receipts.vendorRequired')}
          </Text>
        ) : null}

        <Text style={labelStyle}>{t('receipts.amount')} *</Text>
        <TextInput
          style={[
            fieldStyle,
            amountError ? { borderColor: Colors.status.dangerBorder } : undefined,
          ]}
          value={amount}
          onChangeText={(text) => { setAmount(text); if (amountError) setAmountError(false); }}
          placeholder="0"
          placeholderTextColor={Colors.ui.textDim}
          keyboardType="numeric"
          accessibilityLabel={t('receipts.amount')}
          returnKeyType="next"
        />
        {amountError ? (
          <Text
            style={{ ...Typography.micro, color: Colors.status.dangerText, marginTop: -Spacing.sm, marginBottom: Spacing.md }}
            accessibilityRole="alert"
          >
            {t('receipts.amountRequired')}
          </Text>
        ) : null}

        <Text style={labelStyle}>{t('receipts.vatAmount')}</Text>
        <TextInput
          style={fieldStyle}
          value={vat}
          onChangeText={setVat}
          placeholder="0"
          placeholderTextColor={Colors.ui.textDim}
          keyboardType="numeric"
          accessibilityLabel={t('receipts.vatAmount')}
          returnKeyType="next"
        />
        <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginTop: -Spacing.sm, marginBottom: Spacing.md }}>
          {t('receipts.vatHint')}
        </Text>

        <Text style={labelStyle}>{t('receipts.date')}</Text>
        <TextInput
          style={fieldStyle}
          value={date}
          onChangeText={setDate}
          placeholder={t('receipts.datePlaceholder')}
          placeholderTextColor={Colors.ui.textDim}
          accessibilityLabel={t('receipts.date')}
          returnKeyType="done"
        />

        <Text style={labelStyle}>{t('receipts.category')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.section }}>
          {ExpenseCategories.map((option) => {
            const active = category === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setCategory(option);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: Spacing.sm,
                  borderRadius: Radii.pill,
                  backgroundColor: active ? Colors.brand.primary : Colors.ui.surface,
                  borderColor: active ? Colors.brand.primary : Colors.ui.border,
                  borderWidth: 1,
                }}
              >
                <Text style={{ ...Typography.caption, color: active ? Colors.ui.white : Colors.ui.textMuted }}>
                  {t(`receipts.categories.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => void handleConfirm()}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={t('receipts.confirm')}
          style={{
            backgroundColor: processing ? Colors.ui.border : Colors.brand.primary,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.lg,
            alignItems: 'center',
            marginBottom: Spacing.md,
          }}
        >
          {processing ? <ActivityIndicator color={Colors.ui.white} /> : <Text style={{ color: Colors.ui.white, fontWeight: '700' }}>{t('receipts.confirm')}</Text>}
        </Pressable>

        <Pressable onPress={onRetake} accessibilityRole="button" accessibilityLabel={t('receipts.retakePhoto')} style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
          <Text style={{ ...Typography.body, color: Colors.ui.textDim }}>{t('receipts.retakePhoto')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
