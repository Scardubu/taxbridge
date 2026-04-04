import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { palette, radius, shadows, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { logComplianceEvent } from '../../services/complianceEventService';

export default function InvoicesTab() {
  const { t } = useTranslation();
  const tokens = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <OfflineIndicator />
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('invoices.title')}</Text>

        <View
          style={{
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            gap: spacing.md,
            ...shadows.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.nrsGreenLight, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="document-text" size={22} color={palette.nrsGreen} />
            </View>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, flex: 1 }}>
              {t('invoices.featureTitle')}
            </Text>
          </View>
          <Text style={{ ...typography.body, color: tokens.textSecondary }}>
            {t('invoices.featureBody')}
          </Text>
          {__DEV__ ? (
            <Pressable
              onPress={() => {
                void logComplianceEvent(
                  'invoice_submitted',
                  'Demo invoice submission event emitted from invoices tab',
                  'info'
                );
              }}
              accessibilityRole="button"
              accessibilityLabel={t('invoices.testEventLabel')}
              style={({ pressed }) => ({
                backgroundColor: palette.nrsGreen,
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                alignSelf: 'flex-start',
                flexDirection: 'row',
                gap: spacing.xs,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="flash" size={16} color={palette.white} />
              <Text style={{ ...typography.bodyBold, color: palette.white }}>
                {t('invoices.testEventLabel')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: tokens.border, alignItems: 'center', gap: spacing.md }}>
          <Ionicons name="receipt-outline" size={48} color={tokens.textMuted} />
          <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, textAlign: 'center' }}>{t('invoices.emptyTitle')}</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary, textAlign: 'center' }}>{t('invoices.emptyBody')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
