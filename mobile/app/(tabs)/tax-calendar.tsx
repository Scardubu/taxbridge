import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUpcomingDeadlines } from '../../services/taxCalendar';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';

export default function TaxCalendarTab() {
  const tokens = useTokens();
  const deadlines = getUpcomingDeadlines();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>Tax Calendar</Text>
        {deadlines.map((deadline) => (
          <View key={deadline.id} style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.xs }}>
            <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>{deadline.title}</Text>
            <Text style={{ ...typography.body, color: tokens.textSecondary }}>{deadline.description}</Text>
            <Text style={{ ...typography.caption, color: deadline.daysAway <= 3 ? palette.danger : palette.nrsGreen }}>
              Due {deadline.dueDate.toDateString()} · {deadline.daysAway} day{deadline.daysAway === 1 ? '' : 's'} away
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
