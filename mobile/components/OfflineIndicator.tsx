import { View, Text, Pressable } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { offlineQueue } from '../services/offlineQueue';
import { Colors, Typography, Spacing, Radii } from './design-system/tokens';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(true);
  const [queueDepth, setQueueDepth] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncMessage = isOnline
    ? t('offline.syncing', { count: queueDepth })
    : t('offline.queued', { count: queueDepth });

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const refresh = () => {
      void offlineQueue.getPendingCount().then(setQueueDepth);
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await offlineQueue.flush();
      setQueueDepth(0);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && queueDepth === 0) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={syncMessage}
      style={{
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.md,
        backgroundColor: isOnline ? Colors.status.successBg : Colors.status.warningBg,
        borderColor: isOnline ? Colors.status.successBorder : Colors.status.warningBorder,
        borderWidth: 1,
        borderRadius: Radii.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
      }}
    >
      <Text style={{ fontSize: 16 }}>{isOnline ? '\uD83D\uDD04' : '\uD83D\uDCE1'}</Text>
      <Text
        style={{
          flex: 1,
          ...Typography.caption,
          color: isOnline ? Colors.status.successText : Colors.status.warningText,
        }}
      >
        {syncMessage}
      </Text>
      {isOnline && queueDepth > 0 ? (
        <Pressable
          onPress={() => void handleSync()}
          disabled={isSyncing}
          accessibilityRole="button"
          accessibilityLabel={t('offline.syncNow')}
          style={{
            backgroundColor: Colors.brand.primary,
            borderRadius: Radii.sm,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
          }}
        >
          <Text style={{ color: Colors.ui.white, ...Typography.micro }}>
            {isSyncing ? t('offline.syncingNow') : t('offline.syncNow')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
