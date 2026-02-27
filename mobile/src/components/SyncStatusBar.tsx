import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DURATION, EASE } from '../design-system/animation';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface SyncStatusBarProps {
  pendingCount?: number;
  onSyncPress?: () => void;
}

function SyncStatusBar({ pendingCount = 0, onSyncPress }: SyncStatusBarProps) {
  const { t } = useTranslation();
  const { isOnline } = useNetwork();
  const { syncState, lastSyncAt, lastError, progress, conflictCount } = useSyncContext();
  const pulseOpacity = useSharedValue(1);
  const spinRotation = useSharedValue(0);

  const isSyncing = syncState !== 'idle' && syncState !== 'error' && syncState !== 'success';

  useEffect(() => {
    if (isSyncing) {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: DURATION.skeleton, easing: EASE.shimmer }),
        -1,
        false
      );
    } else {
      spinRotation.value = 0;
    }
  }, [isSyncing]);

  useEffect(() => {
    if (pendingCount > 0 && isOnline && !isSyncing) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: DURATION.slow, easing: EASE.enter }),
          withTiming(1,   { duration: DURATION.slow, easing: EASE.exit  })
        ),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [pendingCount, isOnline, isSyncing]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));

  const formatLastSync = () => {
    if (!lastSyncAt) return t('sync.neverSynced');
    const diff = Date.now() - lastSyncAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return t('sync.justNow');
    if (minutes < 60) return t('sync.minutesAgo', { count: minutes });
    if (hours < 24) return t('sync.hoursAgo', { count: hours });
    return new Date(lastSyncAt).toLocaleDateString();
  };

  const getStatusConfig = () => {
    // Error state
    if (syncState === 'error' && lastError) {
      return {
        icon: '❌',
        text: lastError.message,
        subtext: lastError.retryable ? t('sync.error.retryable') : t('sync.error.notRetryable'),
        bgColor: colors.errorBg,
        textColor: colors.errorDark,
        borderColor: colors.errorBorder,
      };
    }

    // Conflict state
    if (syncState === 'resolving' || conflictCount > 0) {
      return {
        icon: '⚠️',
        text: t('sync.state.resolving'),
        subtext: t('sync.conflictsBody', { count: conflictCount }),
        bgColor: colors.warningBg,
        textColor: colors.warningDark,
        borderColor: colors.warningBorder,
      };
    }

    // Active sync states with progress
    if (syncState === 'connecting') {
      return {
        icon: '🔌',
        text: t('sync.state.connecting'),
        bgColor: colors.infoBg,
        textColor: colors.infoDark,
        borderColor: colors.infoBorder,
      };
    }

    if (syncState === 'pushing' && progress) {
      return {
        icon: '⬆️',
        text: t('sync.state.pushing'),
        subtext: t('sync.progress.of', { current: progress.current, total: progress.total }),
        bgColor: colors.infoBg,
        textColor: colors.infoDark,
        borderColor: colors.infoBorder,
      };
    }

    if (syncState === 'pulling' && progress) {
      return {
        icon: '⬇️',
        text: t('sync.state.pulling'),
        subtext: t('sync.progress.of', { current: progress.current, total: progress.total }),
        bgColor: colors.infoBg,
        textColor: colors.infoDark,
        borderColor: colors.infoBorder,
      };
    }

    // Success state (brief)
    if (syncState === 'success') {
      return {
        icon: '✅',
        text: t('sync.state.success'),
        bgColor: colors.successBg,
        textColor: colors.successDark,
        borderColor: colors.successBorder,
      };
    }

    // Offline
    if (!isOnline) {
      return {
        icon: '📵',
        text: t('common.offlineMode'),
        bgColor: colors.warningBg,
        textColor: colors.warningDark,
        borderColor: colors.warningBorder,
      };
    }

    // Pending changes
    if (pendingCount > 0) {
      return {
        icon: '⏳',
        text: t('sync.pendingCount', { count: pendingCount }),
        bgColor: colors.warningBg,
        textColor: colors.warningDark,
        borderColor: colors.warningBorder,
      };
    }
    return {
      icon: '✅',
      text: t('home.allSynced'),
      bgColor: colors.successBg,
      textColor: colors.successDark,
      borderColor: colors.successBorder,
    };
  };

  const config = getStatusConfig();

  return (
    <Animated.View style={[styles.container, pulseStyle]}>
      <View style={[styles.statusBar, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
        <View style={styles.leftSection}>
          {isSyncing ? (
            <Animated.Text style={[styles.icon, spinStyle]}>{config.icon}</Animated.Text>
          ) : (
            <Text style={styles.icon}>{config.icon}</Text>
          )}
          <View style={styles.textSection}>
            <Text style={[styles.statusText, { color: config.textColor }]}>{config.text}</Text>
            {config.subtext && (
              <Text style={[styles.subtextStyle, { color: config.textColor }]}>{config.subtext}</Text>
            )}
            {syncState === 'idle' && (
              <Text style={styles.lastSync}>{t('sync.lastSync')}: {formatLastSync()}</Text>
            )}
          </View>
        </View>
        
        {pendingCount > 0 && isOnline && !isSyncing && (
          <Pressable 
            style={styles.syncButton} 
            onPress={onSyncPress}
            accessibilityRole="button"
            accessibilityLabel={t('common.syncPending')}
          >
            <Text style={styles.syncButtonText}>{t('invoices.sync')}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default memo(SyncStatusBar);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radii.md + 2,
    borderWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  textSection: {
    flex: 1,
  },
  icon: {
    fontSize: 18,
  },
  statusText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  subtextStyle: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2,
  },
  lastSync: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  syncButtonText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weight.bold,
    fontSize: 13,
  },
});
