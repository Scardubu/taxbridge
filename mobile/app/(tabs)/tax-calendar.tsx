import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { generateTaxCalendar } from '../../services/taxCalendar';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { palette, radius, shadows, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';

function getUrgencyColor(daysAway: number) {
  if (daysAway <= 3) return palette.danger;
  if (daysAway <= 14) return palette.warning;
  return palette.nrsGreen;
}

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
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <OfflineIndicator />
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>{t('tabs.calendar')}</Text>
        {deadlines.length > 0 ? deadlines.map((deadline) => {
          const urgencyColor = getUrgencyColor(deadline.daysAway);
          return (
            <View
              key={deadline.id}
              style={{
                backgroundColor: tokens.bgCard,
                borderRadius: radius.xl,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: tokens.border,
                gap: spacing.sm,
                ...shadows.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: urgencyColor + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar" size={18} color={urgencyColor} />
                </View>
                <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, flex: 1 }}>{deadline.title}</Text>
                {deadline.daysAway <= 7 && (
                  <View style={{ backgroundColor: urgencyColor + '18', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <Text style={{ ...typography.label, color: urgencyColor }}>{deadline.daysAway <= 0 ? t('calendar.overdue') : t('calendar.urgent')}</Text>
                  </View>
                )}
              </View>
              <Text style={{ ...typography.body, color: tokens.textSecondary }}>{deadline.description}</Text>
              <Text style={{ ...typography.caption, color: urgencyColor }}>
                {t('calendar.daysAway', { date: deadline.dueDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }), count: deadline.daysAway })}
              </Text>
            </View>
          );
        }) : (
          <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: tokens.border, alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="calendar-outline" size={48} color={tokens.textMuted} />
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary, textAlign: 'center' }}>{t('calendar.emptyState.title')}</Text>
            <Text style={{ ...typography.body, color: tokens.textSecondary, textAlign: 'center' }}>{t('calendar.emptyState.body')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
