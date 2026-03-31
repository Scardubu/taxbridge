import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generateTaxCalendar } from '../../services/taxCalendar';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

export default function TaxCalendarTab() {
  const { t } = useTranslation();
  const tokens = useTokens();

  // Use the real business profile for personalised deadlines
  const profile = useBusinessProfileStore((state) => ({
    annualTurnover: state.annualTurnover ?? 0,
    totalFixedAssets: state.totalFixedAssets ?? 0,
    sector: state.sector ?? '',
    businessType: state.businessType || 'limited_company',
    isVatRegistered: state.isVatRegistered,
    hasValidTIN: state.hasValidTIN,
    monthlyRevenue: state.monthlyRevenue ?? 0,
  }));

  const deadlines = generateTaxCalendar(profile, new Date().getFullYear());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('tabs.calendar')}</Text>
        {deadlines.map((deadline) => (
          <View
            key={deadline.id}
            style={{
              backgroundColor: tokens.bgCard,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: tokens.border,
              gap: spacing.xs,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{deadline.title}</Text>
            <Text style={{ ...typography.body, color: tokens.textSecondary }}>{deadline.description}</Text>
            <Text
              style={{
                ...typography.caption,
                color: deadline.daysAway <= 3 ? palette.danger : palette.nrsGreen,
              }}
            >
              {t('calendar.daysAway', { date: deadline.dueDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }), count: deadline.daysAway })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
