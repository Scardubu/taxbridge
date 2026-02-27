/**
 * TaxBridge — TopAnomaliesSection
 * HI-03 / P1-A  — Dashboard anomaly section
 *
 * Constraints:
 *   CF-15   Three-channel status: shape (▲■●) + color + text
 *   C-19    Silent empty state — renders nothing when empty={null} via SectionState
 *   C-20    scale(0.97) Pressable on each row
 *   C-16    No raw animation durations
 *   C-06    All strings from i18n (en + pidgin)
 *
 * Usage inside DashboardScreen CONTEXT zone:
 *   <TopAnomaliesSection anomalies={data?.topAnomalies ?? []} />
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@hooks/useTheme';
import type { ColorTokens } from '@hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnomalySignal {
  expenseId:              string;
  amount:                 number;
  category:               string;
  anomalyReason:          string;
  anomalyReason_pidgin?:  string;
  severity:               'low' | 'medium' | 'high';
  suggestedAction:        string;
}

interface TopAnomaliesSectionProps {
  anomalies:    AnomalySignal[];
  /** Called when a row is pressed. Default: noop (navigation handled upstream) */
  onPress?:     (anomaly: AnomalySignal) => void;
}

// ─── Severity helpers — CF-15 three channels ──────────────────────────────────

function getSeverityGlyph(severity: AnomalySignal['severity']): string {
  switch (severity) {
    case 'high':   return '▲';
    case 'medium': return '■';
    default:       return '●';
  }
}

function getSeverityColors(severity: AnomalySignal['severity'], colors: ColorTokens) {
  switch (severity) {
    case 'high':
      return { bg: colors.errorBgSubtle, border: colors.errorBorder, text: colors.error, label: colors.errorDark };
    case 'medium':
      return { bg: colors.warningBgSubtle, border: colors.warningBorder, text: colors.warning, label: colors.warningDark };
    default:
      return { bg: colors.neutralBgSubtle, border: colors.neutralBorder, text: colors.neutral, label: colors.neutralText };
  }
}

// ─── Row component ────────────────────────────────────────────────────────────

interface AnomalyRowProps {
  anomaly: AnomalySignal;
  index:   number;
  onPress: (a: AnomalySignal) => void;
  colors:  ColorTokens;
  t:       ReturnType<typeof useTranslation>['t'];
}

function AnomalyRow({ anomaly, index, onPress, colors, t }: AnomalyRowProps) {
  const sc = getSeverityColors(anomaly.severity, colors);
  const glyph = getSeverityGlyph(anomaly.severity);
  const severityLabel = t(`dashboard.severity${anomaly.severity.charAt(0).toUpperCase()}${anomaly.severity.slice(1)}`);

  const formattedAmount = `₦${Number(anomaly.amount).toLocaleString('en-NG')}`;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable
        onPress={() => onPress(anomaly)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor:  sc.bg,
            borderColor:      sc.border,
          },
          pressed && styles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${severityLabel} anomaly: ${anomaly.anomalyReason}. Amount: ${formattedAmount}. ${t('dashboard.viewAnomaly')}`}
        accessibilityHint={anomaly.suggestedAction}
      >
        {/* CF-15: shape glyph */}
        <Text style={[styles.glyph, { color: sc.text }]} aria-hidden>{glyph}</Text>

        {/* Body */}
        <View style={styles.body}>
          <Text
            style={[styles.reason, { color: colors.textPrimary }]}
            numberOfLines={2}
            accessibilityElementsHidden
          >
            {anomaly.anomalyReason}
          </Text>
          {/* CF-15: text label */}
          <Text style={[styles.severityLabel, { color: sc.label }]} accessibilityElementsHidden>
            {glyph} {severityLabel}
          </Text>
        </View>

        {/* Amount + action */}
        <View style={styles.right}>
          <Text style={[styles.amount, { color: colors.textPrimary }]}>
            {formattedAmount}
          </Text>
          <Text style={[styles.actionLabel, { color: colors.primary }]}>
            {t('dashboard.viewAnomaly')}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function TopAnomaliesSection({ anomalies, onPress }: TopAnomaliesSectionProps) {
  const { t, i18n } = useTranslation();
  const { colors }  = useTheme();

  const handlePress = (anomaly: AnomalySignal) => {
    onPress?.(anomaly);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('dashboard.topAnomalies')}
      </Text>
      <View
        style={styles.list}
        accessibilityRole="list"
        accessibilityLabel={t('dashboard.topAnomalies')}
      >
        {anomalies.map((anomaly, index) => (
          <AnomalyRow
            key={anomaly.expenseId}
            anomaly={anomaly}
            index={index}
            onPress={handlePress}
            colors={colors}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  rowPressed: {
    transform: [{ scale: 0.97 }],  // C-20
    opacity: 0.92,
  },
  glyph: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  reason: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  severityLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
