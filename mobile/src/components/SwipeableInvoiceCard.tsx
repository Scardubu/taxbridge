import React, { memo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { LocalInvoiceRow } from '../types/invoice';
import AnimatedStatusBadge from './AnimatedStatusBadge';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

interface SwipeableInvoiceCardProps {
  invoice: LocalInvoiceRow;
  onPress?: () => void;
  onRetry?: (id: string) => void;
  onShare?: (invoice: LocalInvoiceRow) => void;
  onDelete?: (id: string) => void;
  showSyncProgress?: boolean;
}

function SwipeableInvoiceCard({
  invoice,
  onPress,
  onRetry,
  onShare,
  onDelete,
  showSyncProgress = true,
}: SwipeableInvoiceCardProps) {
  const inv = invoice;
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const isSwipeOpen = useRef(false);

  const isOffline = inv.synced === 0;
  const isFailed = inv.status === 'failed';
  const canRetry = isFailed && isOffline;
  const canDelete = inv.synced === 1; // Only allow deleting synced invoices

  const resetPosition = useCallback(() => {
    translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
    isSwipeOpen.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    resetPosition();
    onRetry?.(inv.id);
  }, [inv.id, onRetry, resetPosition]);

  const handleShare = useCallback(() => {
    resetPosition();
    onShare?.(inv);
  }, [inv, onShare, resetPosition]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Invoice',
      'This invoice has been synced. Are you sure you want to delete the local copy?',
      [
        { text: 'Cancel', style: 'cancel', onPress: resetPosition },
        { text: 'Delete', style: 'destructive', onPress: () => {
          resetPosition();
          onDelete?.(inv.id);
        }},
      ]
    );
  }, [inv.id, onDelete, resetPosition]);

  // Simplified press handling without swipe gestures for now
  // Full gesture handling would require react-native-gesture-handler setup
  const handlePressIn = () => {
    scale.value = 0.98;
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) },
    ],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 20 ? withTiming(1) : withTiming(0),
    transform: [{ scale: translateX.value > SWIPE_THRESHOLD ? 1.1 : 1 }],
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? withTiming(1) : withTiming(0),
    transform: [{ scale: translateX.value < -SWIPE_THRESHOLD ? 1.1 : 1 }],
  }));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-NG', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      {/* Background Actions */}
      <View style={styles.actionsContainer}>
        {/* Left Action - Retry/Share */}
        <Animated.View style={[styles.leftAction, leftActionStyle]}>
          <Pressable 
            style={[styles.actionButton, styles.shareAction]}
            onPress={canRetry ? handleRetry : handleShare}
          >
            <Text style={styles.actionIcon}>{canRetry ? '🔄' : '📤'}</Text>
            <Text style={styles.actionText}>{canRetry ? 'Retry' : 'Share'}</Text>
          </Pressable>
        </Animated.View>

        {/* Right Action - Delete */}
        <Animated.View style={[styles.rightAction, rightActionStyle]}>
          {canDelete && (
            <Pressable 
              style={[styles.actionButton, styles.deleteAction]}
              onPress={handleDelete}
            >
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={styles.actionText}>Delete</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>

      {/* Card */}
      <Animated.View style={[styles.card, cardAnimatedStyle]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.cardInner}
        >
          {/* Header Row */}
          <View style={styles.row}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {inv.customerName || 'Walk-in Customer'}
              </Text>
              <Text style={styles.invoiceId}>#{inv.id.slice(-8).toUpperCase()}</Text>
            </View>
            <AnimatedStatusBadge status={inv.status} size="small" />
          </View>

          {/* Sync Progress Indicator */}
          {showSyncProgress && isOffline && (
            <View style={styles.syncIndicator}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>
                {isFailed ? 'Sync failed - tap to retry' : 'Pending sync'}
              </Text>
            </View>
          )}

          {/* Footer Row */}
          <View style={styles.row}>
            <View style={styles.metaContainer}>
              <Text style={styles.date}>{formatDate(inv.createdAt)}</Text>
              {inv.items && (
                <Text style={styles.itemCount}>
                  {JSON.parse(inv.items).length} item{JSON.parse(inv.items).length > 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Text style={styles.amount}>{formatCurrency(Number(inv.total))}</Text>
          </View>

          {/* Swipe Hint */}
          <View style={styles.swipeHint}>
            <Text style={styles.swipeHintText}>← Swipe for actions →</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default memo(SwipeableInvoiceCard);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    position: 'relative',
  },
  actionsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  leftAction: {
    width: MAX_SWIPE,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.successDark,
    borderTopLeftRadius: radii.lg,
    borderBottomLeftRadius: radii.lg,
  },
  rightAction: {
    width: MAX_SWIPE,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  shareAction: {},
  deleteAction: {},
  actionIcon: {
    fontSize: typography.size.xl,
    marginBottom: spacing.xs,
  },
  actionText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.sm,
  },
  cardInner: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  invoiceId: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBgLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.sm,
    marginVertical: spacing.sm + 2,
    gap: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.warning,
  },
  syncText: {
    fontSize: typography.size.xs,
    color: colors.warningDark,
    fontWeight: typography.weight.medium,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  date: {
    fontSize: 13,
    color: colors.textMuted,
  },
  itemCount: {
    fontSize: typography.size.xs,
    color: colors.textMuted,
    backgroundColor: colors.surfaceSlate,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  amount: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
  },
  swipeHint: {
    alignItems: 'center',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSlate,
  },
  swipeHintText: {
    fontSize: 11,
    color: colors.disabled,
    fontWeight: typography.weight.medium,
  },
});
