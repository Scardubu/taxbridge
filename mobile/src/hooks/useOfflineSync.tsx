/**
 * TaxBridge — Offline Sync Hook
 * SQLite queue for offline mutations, auto-flush on reconnect
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { queryClient } from '../store/queries';
import { expenseApi, invoiceApi } from '../api/client';
import { colors, typography, spacing, radii } from '../design-system/tokens';

// ─── Offline Sync Hook ────────────────────────────────────────────────────────

interface QueuedMutation {
  id:         number;
  type:       'create_expense' | 'create_invoice' | 'delete_expense';
  payload:    string;  // JSON
  created_at: number;
  attempts:   number;
}

export function useOfflineSync() {
  const db      = useSQLiteContext();
  const isSyncing = useRef(false);

  // Create queue table on first mount
  useEffect(() => {
    db.runAsync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        attempts INTEGER NOT NULL DEFAULT 0
      )
    `).catch(console.error);
  }, [db]);

  // Queue a mutation for later sync
  const enqueue = useCallback(async (
    type: QueuedMutation['type'],
    payload: object
  ) => {
    await db.runAsync(
      'INSERT INTO offline_queue (type, payload, created_at, attempts) VALUES (?, ?, ?, 0)',
      [type, JSON.stringify(payload), Date.now()]
    );
  }, [db]);

  // Flush the queue — called when network reconnects
  const flushQueue = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      const items = await db.getAllAsync<QueuedMutation>(
        'SELECT * FROM offline_queue ORDER BY created_at ASC LIMIT 20'
      );

      if (items.length === 0) return;

      for (const item of items) {
        try {
          const payload = JSON.parse(item.payload);

          switch (item.type) {
            case 'create_expense':
              await expenseApi.create(payload);
              break;
            case 'create_invoice':
              await invoiceApi.create(payload);
              break;
            case 'delete_expense':
              await expenseApi.delete(payload.id);
              break;
          }

          // Success — remove from queue
          await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [item.id]);

        } catch (err) {
          // Increment attempt count — give up after 5 attempts
          await db.runAsync(
            'UPDATE offline_queue SET attempts = attempts + 1 WHERE id = ?',
            [item.id]
          );
          if (item.attempts >= 4) {
            // Move to dead letter — keep for audit but stop retrying
            await db.runAsync(
              'UPDATE offline_queue SET type = ? WHERE id = ?',
              [`dead_${item.type}`, item.id]
            );
          }
        }
      }

      // Invalidate all queries after flush
      queryClient.invalidateQueries();

    } finally {
      isSyncing.current = false;
    }
  }, [db]);

  // Auto-flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        flushQueue();
      }
    });
    return () => unsub();
  }, [flushQueue]);

  // Queue item count for UI indicator
  const getQueueCount = useCallback(async (): Promise<number> => {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM offline_queue WHERE type NOT LIKE "dead_%"'
    );
    return result?.count ?? 0;
  }, [db]);

  return { enqueue, flushQueue, getQueueCount };
}

// ─── Offline Banner ───────────────────────────────────────────────────────────

export function OfflineBanner() {
  const network = NetInfo.useNetInfo();

  if (network.isConnected !== false) return null;

  return (
    <View style={bannerStyles.banner}>
      <Text style={bannerStyles.text}>
        📡 Offline — Changes will sync when you reconnect
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent[200],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
  },
  text: {
    fontSize: typography.sizes.xs,
    color: colors.accent[700],
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
});

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error:    Error | null;
}

interface ErrorBoundaryProps {
  children:    React.ReactNode;
  fallback?:   React.ReactNode;
  onError?:    (error: Error, info: React.ErrorInfo) => void;
  section?:    string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
    // In production: Sentry.captureException(error, { extra: info });
    console.error(`[ErrorBoundary:${this.props.section}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <ErrorFallback
          section={this.props.section}
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({
  section, error, onReset,
}: {
  section?: string; error: Error | null; onReset: () => void;
}) {
  return (
    <View style={errStyles.container}>
      <Text style={errStyles.emoji}>⚠️</Text>
      <Text style={errStyles.title}>Something went wrong</Text>
      <Text style={errStyles.body}>
        {section ? `The ${section} section` : 'This section'} encountered an error.
        Your data is safe.
      </Text>
      {__DEV__ && error && (
        <Text style={errStyles.devError} numberOfLines={4}>
          {error.message}
        </Text>
      )}
      <Pressable onPress={onReset} style={errStyles.retryBtn}>
        <Text style={errStyles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const errStyles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, backgroundColor: colors.gray[50],
  },
  emoji:   { fontSize: 48, marginBottom: spacing[4] },
  title: {
    fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[2], textAlign: 'center',
  },
  body: {
    fontSize: typography.sizes.base, color: colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: spacing[5],
  },
  devError: {
    fontSize: typography.sizes.xs, color: colors.error,
    fontFamily: 'monospace' as any, backgroundColor: colors.red[50],
    padding: spacing[3], borderRadius: radii.sm,
    marginBottom: spacing[4], width: '100%',
  },
  retryBtn: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
    borderRadius: radii.button,
  },
  retryText: {
    color: '#fff', fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.base,
  },
});

// ─── Network Status Hook ──────────────────────────────────────────────────────

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => unsub();
  }, []);

  return { isOnline, isOffline: !isOnline };
}
