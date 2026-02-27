/**
 * TaxBridge — OfflineSyncStatus
 * P1-F / CF-04 — Ambient offline + sync state strip
 *
 * Constraints:
 *   C-07   Network failures show 200 + fallback, never crash
 *   C-15   Status: color + shape icon + text (never color alone)
 *   C-06   All strings via i18n (en + pidgin)
 *   CF-04  useTheme() for all colors
 *
 * Usage in DashboardScreen AMBIENT zone:
 *   {() => <OfflineSyncStatus />}
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@hooks/useTheme';
import { useSync } from '../../contexts/SyncContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { getSyncQueueCount } from '../../services/syncQueueAdapter';

// ─── OfflineSyncStatus ────────────────────────────────────────────────────────

export function OfflineSyncStatus() {
  const { t }                              = useTranslation();
  const { colors, spacing, radii }         = useTheme();
  const { isOnline }                       = useNetwork();
  const { isSyncing, lastSyncAt, manualSync } = useSync();

  const [queueCount, setQueueCount]        = useState<number>(0);

  // Poll queue count when offline to show pending items
  const refreshCount = useCallback(async () => {
    try {
      const n = await getSyncQueueCount();
      setQueueCount(n);
    } catch {
      // C-07: silent fallback — never crash
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [isOnline, isSyncing, refreshCount]);

  // ── Don't render when online + synced + nothing pending ──────────────────
  if (isOnline && !isSyncing && queueCount === 0) return null;

  // ── Derive state vars ─────────────────────────────────────────────────────
  const lastSyncStr = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
    : null;

  // C-15: shape (◐/✓/⚠) + color + text
  const glyph      = !isOnline ? '◐' : isSyncing ? '⟳' : '⚠';
  const statusColor = !isOnline
    ? colors.warningDark
    : isSyncing
    ? colors.primary
    : colors.actionOrangeAccent;
  const statusLabel = !isOnline
    ? t('common.offlineMode')
    : isSyncing
    ? t('network.syncing')
    : t('common.syncPending');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor : colors.warningBg,
          borderColor     : statusColor + '44',
          borderRadius    : radii.md,
          marginTop       : spacing.xs,
          paddingVertical : spacing.xs,
          paddingHorizontal: spacing.sm,
        },
      ]}
      accessibilityRole="none"
      accessibilityLabel={statusLabel}
    >
      <View style={styles.row}>
        {/* C-15: glyph + color + text status */}
        <Text style={[styles.glyph, { color: statusColor }]}>{glyph}</Text>

        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: statusColor }]}>{statusLabel}</Text>

          {queueCount > 0 && (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {queueCount} {t('common.itemsPending')}
            </Text>
          )}

          {lastSyncStr && (
            <Text style={[styles.sub, { color: colors.textMuted ?? colors.textSecondary }]}>
              {t('sync.lastSync')}: {lastSyncStr}
            </Text>
          )}
        </View>

        {/* Sync spinner or manual retry */}
        {isSyncing ? (
          <ActivityIndicator size="small" color={statusColor} style={styles.action} />
        ) : isOnline && queueCount > 0 ? (
          <Pressable
            onPress={() => { void manualSync(); }}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: statusColor, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('insights.syncNow')}
          >
            <Text style={[styles.retryText, { color: colors.textOnPrimary }]}>
              {t('insights.syncNow')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container : { borderWidth: 1 },
  row       : { flexDirection: 'row', alignItems: 'center', gap: 8 },
  glyph     : { fontSize: 18, width: 24, textAlign: 'center' },
  textBlock : { flex: 1 },
  label     : { fontSize: 13, fontWeight: '600' },
  sub       : { fontSize: 11, marginTop: 2 },
  action    : { marginLeft: 8 },
  retryBtn  : {
    paddingHorizontal: 10,
    paddingVertical  : 4,
    borderRadius     : 4,
    marginLeft       : 8,
  },
  retryText : { fontSize: 12, fontWeight: '600' },
});
