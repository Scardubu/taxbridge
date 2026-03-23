import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, radius, spacing, typography, useTokens } from '../../components/design-system/tokens';
import { logComplianceEvent } from '../../services/complianceEventService';

export default function InvoicesTab() {
  const tokens = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text style={{ ...typography.h1, color: tokens.textPrimary }}>Invoices</Text>
        <View style={{ backgroundColor: tokens.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: tokens.border, gap: spacing.sm }}>
          <Text style={{ ...typography.bodyBold, color: tokens.textPrimary }}>NRS-compliant invoice workflows</Text>
          <Text style={{ ...typography.body, color: tokens.textSecondary }}>Generate structured invoices, keep FIRS/NRS references, and prepare for PDF/download integration.</Text>
          <Pressable
            onPress={() => {
              void logComplianceEvent('invoice_submitted', 'Demo invoice submission event emitted from invoices tab', 'info');
            }}
            style={{ backgroundColor: palette.nrsGreen, borderRadius: radius.xl, paddingVertical: spacing.md, alignItems: 'center' }}
          >
            <Text style={{ ...typography.bodyBold, color: palette.white }}>Emit submission event</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
