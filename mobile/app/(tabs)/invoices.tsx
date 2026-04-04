import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { logComplianceEvent } from '../../services/complianceEventService';

export default function InvoicesTab() {
  const { t } = useTranslation();
  const tokens = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('invoices.title')}</Text>
        <View
          style={{
            backgroundColor: tokens.bgCard,
            borderRadius: radius.xl,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: tokens.border,
            gap: spacing.sm,
          }}
        >
          <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>
            {t('invoices.featureTitle')}
          </Text>
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
              style={{
                backgroundColor: palette.nrsGreen,
                borderRadius: radius.xl,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.bodyBold, color: palette.white }}>
                {t('invoices.testEventLabel')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
