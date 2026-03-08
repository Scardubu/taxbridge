/**
 * SectionState — V10.3 Declarative Section State Machine
 *
 * ER-09: Replaces ALL raw ternary conditionals in DashboardScreen.
 *        Zero raw ternaries must remain for: topAnomalies, upcomingDeadlines, trendCharts.
 *
 * State priority:  isLoading → error → isEmpty(data) → children(data)
 *
 * C-19 (Silent anomaly empty state):
 *   When anomalies section passes empty={null}, nothing renders when list is empty.
 *   When empty, render nothing — zero UI output prevents misleading users.
 */

import React from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { typography, spacing, radii } from '../../design-system/tokens';

// ─── InlineError ──────────────────────────────────────────────────────────────

export interface InlineErrorProps {
  /** Emoji icon — never a spinner (appears too "loading", not "errored") */
  icon:      string;
  /** One sentence max; fromm i18n key — never raw English */
  message:   string;
  /** Action label, e.g. t('common.retry') */
  action:    string;
  onAction:  () => void;
}

export function InlineError({ icon, message, action, onAction }: InlineErrorProps) {
  const { colors } = useTheme();
  return (
    <View style={[e.container, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}>
      <Text style={e.icon}>{icon}</Text>
      <Text style={[e.message, { color: colors.textSecondary }]}>{message}</Text>
      <Pressable
        onPress={onAction}
        style={({ pressed }) => [
          e.retryBtn,
          { backgroundColor: colors.primary[500] },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text style={e.retryText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const e = StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing[2] ?? 8,
    padding:        spacing[3] ?? 12,
    borderRadius:   radii.md ?? 10,
    borderWidth:    1,
    marginVertical: spacing[2] ?? 8,
  },
  icon: {
    fontSize: 18,
  },
  message: {
    flex:       1,
    fontSize:   typography.sizes.sm ?? 13,
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       radii.sm ?? 6,
  },
  retryText: {
    color:      '#FFFFFF',
    fontSize:   typography.sizes.sm ?? 13,
    fontWeight: typography.weights.semibold ?? '600',
  },
});

// ─── SectionState ─────────────────────────────────────────────────────────────

interface SectionStateProps<T> {
  data:       T | undefined | null;
  isLoading:  boolean;
  error:      Error | null | unknown;
  isEmpty:    (data: T) => boolean;
  /** Skeleton placeholder — rendered while isLoading=true */
  loading:    React.ReactNode;
  /**
   * Empty-state node.
   * Pass null for anomaly section (C-19) — renders nothing when list is empty.
   */
  empty:      React.ReactNode;
  /** Always an <InlineError> — never a raw text node */
  errorView:  React.ReactNode;
  children:   (data: T) => React.ReactNode;
}

export function SectionState<T>({
  data,
  isLoading,
  error,
  isEmpty,
  loading,
  empty,
  errorView,
  children,
}: SectionStateProps<T>) {
  // State priority: isLoading → error → isEmpty → children
  if (isLoading && (data === undefined || data === null)) return <>{loading}</>;
  if (error)                                               return <>{errorView}</>;
  if (data === undefined || data === null)                 return <>{empty}</>;
  if (isEmpty(data))                                       return <>{empty}</>;
  return <>{children(data)}</>;
}

export default SectionState;
