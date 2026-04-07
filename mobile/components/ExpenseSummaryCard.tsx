import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Colors, Radii, Spacing, Typography } from './design-system/tokens';

interface Props {
  totalExpenses: number;
  vatCredits: number;
  receiptCount: number;
  onScanPress: () => void;
}

function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function ExpenseSummaryCard({ totalExpenses, vatCredits, receiptCount, onScanPress }: Readonly<Props>) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.section,
        backgroundColor: Colors.ui.surface,
        borderColor: Colors.ui.border,
        borderWidth: 1,
        borderRadius: Radii.xl,
        padding: Spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Text style={{ fontSize: 18 }}>🧾</Text>
          <Text style={{ ...Typography.section, color: Colors.ui.textMuted }}>{t('expenses.title')}</Text>
        </View>
        <Text style={{ ...Typography.micro, color: Colors.ui.textDim }}>{t('expenses.thisMonth')}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <View style={{ flex: 1, backgroundColor: Colors.ui.surfaceAlt, borderRadius: Radii.lg, padding: Spacing.lg }}>
          <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginBottom: Spacing.xs }}>{t('expenses.totalSpend')}</Text>
          <Text style={{ ...Typography.mono, color: Colors.ui.text, fontSize: 18, fontWeight: '700' }}>{formatNgn(totalExpenses)}</Text>
          <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginTop: Spacing.xs }}>
            {t('expenses.receiptCount', { count: receiptCount })}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            backgroundColor: vatCredits > 0 ? Colors.receipt.vatCreditBg : Colors.ui.surfaceAlt,
            borderColor: vatCredits > 0 ? Colors.receipt.vatCredit : 'transparent',
            borderWidth: vatCredits > 0 ? 1 : 0,
            borderRadius: Radii.lg,
            padding: Spacing.lg,
          }}
        >
          <Text
            style={{
              ...Typography.micro,
              color: vatCredits > 0 ? Colors.receipt.vatCredit : Colors.ui.textDim,
              marginBottom: Spacing.xs,
            }}
          >
            {t('expenses.vatRecoverable')}
          </Text>
          <Text
            style={{
              ...Typography.mono,
              color: vatCredits > 0 ? Colors.receipt.vatCredit : Colors.ui.textMuted,
              fontSize: 18,
              fontWeight: '700',
            }}
          >
            {formatNgn(vatCredits)}
          </Text>
          {vatCredits === 0 ? (
            <Text style={{ ...Typography.micro, color: Colors.ui.textDim, marginTop: Spacing.xs }}>{t('expenses.scanToEarn')}</Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onScanPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('receipts.scanCta')}
        style={{
          marginTop: Spacing.lg,
          backgroundColor: Colors.brand.primaryDim,
          borderColor: Colors.brand.border,
          borderWidth: 1,
          borderRadius: Radii.md,
          paddingVertical: Spacing.md,
          paddingHorizontal: Spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Spacing.sm,
        }}
      >
        <Text style={{ fontSize: 16 }}>📸</Text>
        <Text style={{ ...Typography.caption, fontWeight: '600', color: Colors.brand.accent }}>{t('receipts.scanCta')}</Text>
      </Pressable>
    </View>
  );
}
