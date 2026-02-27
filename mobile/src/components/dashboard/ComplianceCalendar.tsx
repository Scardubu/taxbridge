/**
 * TaxBridge — ComplianceCalendar
 * HI-04 / P1-D — Multi-deadline compliance calendar strip
 *
 * Constraints:
 *   CF-06   Shows multiple deadlines (was single-deadline — fixed here)
 *   CF-15   Three-channel status: glyph (▲■●) + color + text label
 *   C-20    scale(0.97) Pressable on each row
 *   C-06    All strings via i18n (en + pidgin)
 *
 * Usage inside DashboardScreen CONTEXT zone:
 *   <ComplianceCalendar deadlines={data?.upcomingDeadlines ?? []} />
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '@hooks/useTheme';
import type { ColorTokens } from '@hooks/useTheme';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ComplianceEvent {
  id:             string;
  type:           string;    // e.g. "VAT", "PIT", "WHT"
  dueDate:        string;    // ISO date string
  daysRemaining:  number;
  penaltyIfLate?: string;
  status:         'upcoming' | 'overdue' | 'filed';
}

interface ComplianceCalendarProps {
  deadlines:  ComplianceEvent[];
  /** Maximum deadlines to show (default: 4 per UX-09 compact strip) */
  maxItems?:  number;
  /** Navigates to full filing wizard for a deadline */
  onPress?:   (event: ComplianceEvent) => void;
}

// ─── Urgency helpers — CF-15 ──────────────────────────────────────────────

function getEventStyle(event: ComplianceEvent, colors: ColorTokens) {
  if (event.status === 'filed') {
    return {
      bg:        colors.successBgSubtle,
      border:    colors.successBorder,
      leftAccent: colors.success,
      glyph:     '✓',
      textColor: colors.success,
      labelColor: colors.successDark,
    };
  }
  if (event.status === 'overdue' || event.daysRemaining < 0) {
    return {
      bg:        colors.errorBgSubtle,
      border:    colors.errorBorder,
      leftAccent: colors.error,
      glyph:     '▲',
      textColor: colors.error,
      labelColor: colors.errorDark,
    };
  }
  if (event.daysRemaining <= 7) {
    return {
      bg:        colors.warningBgSubtle,
      border:    colors.warningBorder,
      leftAccent: colors.warning,
      glyph:     '■',
      textColor: colors.warning,
      labelColor: colors.warningDark,
    };
  }
  return {
    bg:        colors.neutralBgSubtle,
    border:    colors.neutralBorder,
    leftAccent: colors.primary,
    glyph:     '●',
    textColor: colors.primary,
    labelColor: colors.textSecondary,
  };
}

// ─── Single deadline row ──────────────────────────────────────────────────

interface DeadlineRowProps {
  event:   ComplianceEvent;
  index:   number;
  onPress: (e: ComplianceEvent) => void;
  colors:  ColorTokens;
  t:       ReturnType<typeof useTranslation>['t'];
}

function DeadlineRow({ event, index, onPress, colors, t }: DeadlineRowProps) {
  const style = getEventStyle(event, colors);
  const isOverdue  = event.status === 'overdue' || event.daysRemaining < 0;
  const isUrgent   = !isOverdue && event.daysRemaining <= 7;
  const isFiled    = event.status === 'filed';

  const statusText = isFiled
    ? '✓ Filed'
    : isOverdue
    ? t('common.overdue')
    : isUrgent
    ? t('common.urgent')
    : t('common.upcoming');

  const daysLabel  = isFiled
    ? ''
    : isOverdue
    ? `${Math.abs(event.daysRemaining)} ${t('common.daysOverdue')}`
    : `${event.daysRemaining} ${t('common.daysRemaining')}`;

  const a11yLabel = `${event.type} ${t('common.filingDue')} ${event.dueDate}. ${statusText}. ${daysLabel}`;

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <Pressable
        onPress={() => !isFiled && onPress(event)}
        disabled={isFiled}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: style.bg,
            borderColor:     style.border,
            borderLeftColor: style.leftAccent,
          },
          pressed && !isFiled && styles.rowPressed,
          isFiled && styles.rowFiled,
        ]}
        accessibilityRole={isFiled ? 'text' : 'button'}
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: isFiled }}
      >
        {/* Left: type + due date */}
        <View style={styles.left}>
          {/* CF-15: glyph channel */}
          <Text style={[styles.glyph, { color: style.textColor }]} aria-hidden>
            {style.glyph}
          </Text>
          <View style={styles.labelBlock}>
            <Text style={[styles.type, { color: colors.textPrimary }]}>
              {event.type}
            </Text>
            <Text style={[styles.dueDate, { color: colors.textMuted }]}>
              {t('common.dueOn')} {event.dueDate}
            </Text>
          </View>
        </View>

        {/* Right: days + status label — CF-15: text channel */}
        <View style={styles.right}>
          {!isFiled && (
            <Text style={[styles.daysCount, { color: style.textColor }]}>
              {isOverdue ? `-${Math.abs(event.daysRemaining)}` : event.daysRemaining}
            </Text>
          )}
          <Text style={[styles.statusLabel, { color: style.labelColor }]}>
            {statusText}
          </Text>
          {event.penaltyIfLate && !isFiled && isOverdue && (
            <Text
              style={[styles.penalty, { color: colors.error }]}
              numberOfLines={1}
            >
              ⚠ {event.penaltyIfLate}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────

export function ComplianceCalendar({
  deadlines,
  maxItems = 4,
  onPress,
}: ComplianceCalendarProps) {
  const { t }      = useTranslation();
  const { colors } = useTheme();

  // Sort: overdue first → by daysRemaining asc
  const sorted = [...deadlines]
    .sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (a.status !== 'overdue' && b.status === 'overdue') return  1;
      return a.daysRemaining - b.daysRemaining;
    })
    .slice(0, maxItems);

  const handlePress = (event: ComplianceEvent) => {
    onPress?.(event);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('dashboard.upcomingDeadlines')}
      </Text>
      <View
        style={styles.list}
        accessibilityRole="list"
        accessibilityLabel={t('dashboard.upcomingDeadlines')}
      >
        {sorted.map((event, index) => (
          <DeadlineRow
            key={event.id}
            event={event}
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

// ─── Styles ──────────────────────────────────────────────────────────────

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
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    gap: 10,
  },
  rowPressed: {
    transform: [{ scale: 0.97 }],  // C-20
    opacity: 0.92,
  },
  rowFiled: {
    opacity: 0.65,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  glyph: {
    fontSize: 14,
    width: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  labelBlock: {
    flex: 1,
  },
  type: {
    fontSize: 14,
    fontWeight: '600',
  },
  dueDate: {
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 60,
  },
  daysCount: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  penalty: {
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 80,
    textAlign: 'right',
  },
});
