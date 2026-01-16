import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNetwork } from '../contexts/NetworkContext';
import { useSyncContext } from '../contexts/SyncContext';

interface SyncStatusBarProps {
  pendingCount?: number;
  onSyncPress?: () => void;
}

function SyncStatusBar({ pendingCount = 0, onSyncPress }: SyncStatusBarProps) {
  const { isOnline } = useNetwork();
  const { isSyncing, lastSyncAt } = useSyncContext();
  const pulseOpacity = useSharedValue(1);
  const spinRotation = useSharedValue(0);

  useEffect(() => {
    if (isSyncing) {
      spinRotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
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
          withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
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
    if (!lastSyncAt) return 'Never synced';
    const diff = Date.now() - lastSyncAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  };

  const getStatusConfig = () => {
    if (isSyncing) {
      return {
        icon: '🔄',
        text: 'Syncing...',
        bgColor: '#DBEAFE',
        textColor: '#1E40AF',
        borderColor: '#93C5FD',
      };
    }
    if (!isOnline) {
      return {
        icon: '📵',
        text: 'Offline Mode',
        bgColor: '#FEF3C7',
        textColor: '#92400E',
        borderColor: '#FDE68A',
      };
    }
    if (pendingCount > 0) {
      return {
        icon: '⏳',
        text: `${pendingCount} pending`,
        bgColor: '#FEF3C7',
        textColor: '#92400E',
        borderColor: '#FDE68A',
      };
    }
    return {
      icon: '✅',
      text: 'All synced',
      bgColor: '#D1FAE5',
      textColor: '#065F46',
      borderColor: '#6EE7B7',
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
          <View>
            <Text style={[styles.statusText, { color: config.textColor }]}>{config.text}</Text>
            <Text style={styles.lastSync}>Last sync: {formatLastSync()}</Text>
          </View>
        </View>
        
        {pendingCount > 0 && isOnline && !isSyncing && (
          <Pressable 
            style={styles.syncButton} 
            onPress={onSyncPress}
            accessibilityRole="button"
            accessibilityLabel="Sync pending invoices"
          >
            <Text style={styles.syncButtonText}>Sync</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

export default memo(SyncStatusBar);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  lastSync: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: '#0B5FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
