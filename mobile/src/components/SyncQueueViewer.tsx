/**
 * SyncQueueViewer Component
 * 
 * Phase 7: User Flow Optimizations
 * 
 * Modal/sheet component that displays pending sync items with:
 * - Visual status indicators (pending, syncing, failed, success)
 * - Optimistic UI with rollback capability
 * - Manual retry actions
 * - Conflict resolution preview
 * 
 * Features:
 * - Real-time sync progress
 * - Haptic feedback on state changes
 * - Accessibility support
 * - Offline indicator
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import { useSync } from '../contexts/SyncContext';
import { trackEvent } from '../services/analytics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

type SyncItemStatus = 'pending' | 'syncing' | 'success' | 'error' | 'conflict';

interface SyncQueueItem {
  id: string;
  type: 'invoice' | 'customer' | 'receipt' | 'payment';
  action: 'create' | 'update' | 'delete';
  title: string;
  subtitle: string;
  status: SyncItemStatus;
  errorMessage?: string;
  timestamp: Date;
  retryCount?: number;
}

interface SyncQueueViewerProps {
  visible: boolean;
  onClose: () => void;
  items?: SyncQueueItem[];
  onRetryItem?: (itemId: string) => void;
  onRetryAll?: () => void;
  onResolveConflict?: (itemId: string) => void;
  onDiscardItem?: (itemId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<SyncItemStatus, { icon: string; color: string; bgColor: string; label: string }> = {
  pending: {
    icon: '⏳',
    color: colors.warning,
    bgColor: colors.warningBgLight,
    label: 'syncQueue.status.pending',
  },
  syncing: {
    icon: '🔄',
    color: colors.info,
    bgColor: colors.surfaceMuted,
    label: 'syncQueue.status.syncing',
  },
  success: {
    icon: '✓',
    color: colors.success,
    bgColor: colors.primaryLight,
    label: 'syncQueue.status.success',
  },
  error: {
    icon: '⚠',
    color: colors.error,
    bgColor: colors.errorLight,
    label: 'syncQueue.status.failed',
  },
  conflict: {
    icon: '⚡',
    color: colors.actionOrange,
    bgColor: colors.actionOrangeBg,
    label: 'syncQueue.status.conflict',
  },
};

const TYPE_ICONS: Record<SyncQueueItem['type'], string> = {
  invoice: '📄',
  customer: '👤',
  receipt: '🧾',
  payment: '💳',
};

// ============================================================================
// Mock data for demonstration
// ============================================================================

const MOCK_QUEUE_ITEMS: SyncQueueItem[] = [
  {
    id: 'sync-1',
    type: 'invoice',
    action: 'create',
    title: 'Invoice INV-2024-042',
    subtitle: 'Chukwu Enterprises • ₦125,000',
    status: 'pending',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'sync-2',
    type: 'customer',
    action: 'update',
    title: 'Customer Update',
    subtitle: 'Adamu Trading Co.',
    status: 'syncing',
    timestamp: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: 'sync-3',
    type: 'receipt',
    action: 'create',
    title: 'Receipt Scan',
    subtitle: 'Office supplies • ₦15,500',
    status: 'error',
    errorMessage: 'Network timeout. Please retry.',
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    retryCount: 2,
  },
];

// ============================================================================
// Sub-components
// ============================================================================

interface SyncProgressBarProps {
  progress: number;
  isActive: boolean;
}

const SyncProgressBar = memo(({ progress, isActive }: SyncProgressBarProps) => {
  const animatedWidth = useSharedValue(0);
  const pulseOpacity = useSharedValue(1);

  React.useEffect(() => {
    animatedWidth.value = withSpring(progress, { damping: 15, stiffness: 100 });
    if (isActive) {
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0.6, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(1);
    }
  }, [progress, isActive]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, progressStyle]} />
      </View>
      <Text style={styles.progressText}>{Math.round(progress)}%</Text>
    </View>
  );
});

SyncProgressBar.displayName = 'SyncProgressBar';

interface QueueItemProps {
  item: SyncQueueItem;
  onRetry: () => void;
  onResolve?: () => void;
  onDiscard: () => void;
}

const QueueItem = memo(({ item, onRetry, onResolve, onDiscard }: QueueItemProps) => {
  const { t } = useTranslation();
  const statusConfig = STATUS_CONFIG[item.status];
  const typeIcon = TYPE_ICONS[item.type];
  
  const rotateAnimation = useSharedValue(0);
  
  React.useEffect(() => {
    if (item.status === 'syncing') {
      rotateAnimation.value = withRepeat(withTiming(360, { duration: 1500 }), -1, false);
    } else {
      rotateAnimation.value = withTiming(0);
    }
  }, [item.status]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnimation.value}deg` }],
  }));

  const formatTime = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t('syncQueue.timeAgo.now');
    if (minutes < 60) return t('syncQueue.timeAgo.minutes', { count: minutes });
    return t('syncQueue.timeAgo.hours', { count: Math.floor(minutes / 60) });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.queueItem, { borderLeftColor: statusConfig.color }]}
    >
      {/* Icon and Content */}
      <View style={styles.queueItemMain}>
        <View style={[styles.typeIconContainer, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={styles.typeIcon}>{typeIcon}</Text>
        </View>
        
        <View style={styles.queueItemContent}>
          <View style={styles.queueItemHeader}>
            <Text style={styles.queueItemTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Animated.Text style={[styles.statusIcon, item.status === 'syncing' && spinStyle]}>
                {statusConfig.icon}
              </Animated.Text>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {t(statusConfig.label)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.queueItemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          
          <View style={styles.queueItemMeta}>
            <Text style={styles.queueItemAction}>
              {t(`syncQueue.action.${item.action}`)}
            </Text>
            <Text style={styles.queueItemTime}>{formatTime(item.timestamp)}</Text>
          </View>
          
          {item.errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{item.errorMessage}</Text>
              {item.retryCount && item.retryCount > 0 && (
                <Text style={styles.retryCountText}>
                  {t('syncQueue.retryCount', { count: item.retryCount })}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      {(item.status === 'error' || item.status === 'conflict') && (
        <View style={styles.queueItemActions}>
          {item.status === 'conflict' && onResolve && (
            <Pressable
              style={[styles.actionButton, styles.resolveButton]}
              onPress={onResolve}
              accessibilityRole="button"
              accessibilityLabel={t('syncQueue.actions.resolve')}
            >
              <Text style={styles.resolveButtonText}>{t('syncQueue.actions.resolve')}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.actionButton, styles.retryButton]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('syncQueue.actions.retry')}
          >
            <Text style={styles.retryButtonText}>{t('syncQueue.actions.retry')}</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.discardButton]}
            onPress={onDiscard}
            accessibilityRole="button"
            accessibilityLabel={t('syncQueue.actions.discard')}
          >
            <Text style={styles.discardButtonText}>{t('syncQueue.actions.discard')}</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

QueueItem.displayName = 'QueueItem';

// ============================================================================
// Main Component
// ============================================================================

function SyncQueueViewer({
  visible,
  onClose,
  items = MOCK_QUEUE_ITEMS,
  onRetryItem,
  onRetryAll,
  onResolveConflict,
  onDiscardItem,
}: SyncQueueViewerProps) {
  const { t } = useTranslation();
  const { syncState, progress, conflictCount, retrySync } = useSync();
  const progressPercent = progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  
  const handleRetryItem = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackEvent('sync', 'retry_item', itemId);
    onRetryItem?.(itemId);
  }, [onRetryItem]);

  const handleRetryAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    trackEvent('sync', 'retry_all', undefined, undefined, { itemCount: items.filter(i => i.status === 'error').length });
    onRetryAll?.() || retrySync();
  }, [items, onRetryAll, retrySync]);

  const handleResolveConflict = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    trackEvent('sync', 'resolve_conflict', itemId);
    onResolveConflict?.(itemId);
  }, [onResolveConflict]);

  const handleDiscardItem = useCallback((itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    trackEvent('sync', 'discard_item', itemId);
    onDiscardItem?.(itemId);
  }, [onDiscardItem]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  // Statistics
  const stats = useMemo(() => ({
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    syncing: items.filter(i => i.status === 'syncing').length,
    success: items.filter(i => i.status === 'success').length,
    failed: items.filter(i => i.status === 'error').length,
    conflicts: items.filter(i => i.status === 'conflict').length,
  }), [items]);

  const isSyncing = syncState === 'pushing' || syncState === 'pulling' || syncState === 'connecting';
  const hasFailures = stats.failed > 0 || stats.conflicts > 0;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.overlayBackground} onPress={handleClose} />
        
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown.springify().damping(18)}
          style={styles.sheet}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.headerTitle}>{t('syncQueue.title')}</Text>
                <Text style={styles.headerSubtitle}>
                  {t('syncQueue.subtitle', { count: stats.total })}
                </Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Progress Bar */}
          {isSyncing && (
            <View style={styles.progressSection}>
              <SyncProgressBar progress={progressPercent} isActive={isSyncing} />
            </View>
          )}

          {/* Stats Summary */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>{t('syncQueue.stats.pending')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.info }]}>{stats.syncing}</Text>
              <Text style={styles.statLabel}>{t('syncQueue.stats.syncing')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.success}</Text>
              <Text style={styles.statLabel}>{t('syncQueue.stats.done')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.error }]}>{stats.failed}</Text>
              <Text style={styles.statLabel}>{t('syncQueue.stats.failed')}</Text>
            </View>
          </View>

          {/* Queue List */}
          <ScrollView
            style={styles.queueList}
            contentContainerStyle={styles.queueListContent}
            showsVerticalScrollIndicator={false}
          >
            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>✓</Text>
                <Text style={styles.emptyTitle}>{t('syncQueue.empty.title')}</Text>
                <Text style={styles.emptySubtitle}>{t('syncQueue.empty.subtitle')}</Text>
              </View>
            ) : (
              items.map(item => (
                <QueueItem
                  key={item.id}
                  item={item}
                  onRetry={() => handleRetryItem(item.id)}
                  onResolve={item.status === 'conflict' ? () => handleResolveConflict(item.id) : undefined}
                  onDiscard={() => handleDiscardItem(item.id)}
                />
              ))
            )}
          </ScrollView>

          {/* Footer Actions */}
          {hasFailures && (
            <View style={styles.footer}>
              <Pressable
                style={styles.retryAllButton}
                onPress={handleRetryAll}
                accessibilityRole="button"
                accessibilityLabel={t('syncQueue.actions.retryAll')}
              >
                <Text style={styles.retryAllIcon}>🔄</Text>
                <Text style={styles.retryAllText}>{t('syncQueue.actions.retryAll')}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceOverlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...shadows.xl,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  headerContent: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutralLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  progressSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutralLight,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    ...typography.caption,
    color: colors.textMuted,
    minWidth: 36,
    textAlign: 'right',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceMuted,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  queueList: {
    flex: 1,
  },
  queueListContent: {
    paddingVertical: spacing.md,
  },
  queueItem: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  queueItemMain: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 20,
  },
  queueItemContent: {
    flex: 1,
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  queueItemTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  queueItemSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  queueItemMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  queueItemAction: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  queueItemTime: {
    ...typography.caption,
    color: colors.textMuted,
  },
  errorContainer: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radii.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
  },
  retryCountText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  queueItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  retryButton: {
    backgroundColor: colors.primaryLight,
  },
  retryButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  resolveButton: {
    backgroundColor: colors.actionOrangeBg,
  },
  resolveButtonText: {
    ...typography.caption,
    color: colors.actionOrange,
    fontWeight: '600',
  },
  discardButton: {
    backgroundColor: colors.errorLight,
  },
  discardButtonText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.success,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surfaceMuted,
  },
  retryAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  retryAllIcon: {
    fontSize: 16,
  },
  retryAllText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
  },
});

export default memo(SyncQueueViewer);
