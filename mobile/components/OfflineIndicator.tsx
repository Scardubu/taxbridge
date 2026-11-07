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
  const [deadLetterCount, setDeadLetterCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const isPipelineDisabled = process.env.EXPO_PUBLIC_SYNC_PIPELINE_ENABLED === 'false';

  const needsAttention = isPipelineDisabled || deadLetterCount > 0 || !isOnline;

  const syncMessage = isPipelineDisabled
    ? t('offline.pipelineDisabled', { defaultValue: 'Saved on this device — submission pipeline is offline' })
    : deadLetterCount > 0
    ? t('offline.attentionRequired', { count: deadLetterCount, defaultValue: `${deadLetterCount} operation(s) require attention` })
    : isOnline
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
      void Promise.all([
        offlineQueue.getPendingCount(),
        typeof (offlineQueue as any).getDeadLetterCount === 'function' ? (offlineQueue as any).getDeadLetterCount() : Promise.resolve(0),
      ]).then(([pending, dead]) => {
        setQueueDepth(pending);
        setDeadLetterCount(dead);
      }).catch(() => undefined);
    };
    refresh();
    if (!isOnline || queueDepth > 0) {
      const interval = setInterval(refresh, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOnline, queueDepth > 0]);

  const handleSync = async () => {
    if (isPipelineDisabled) return;
    setIsSyncing(true);
    try {
      await offlineQueue.flush();
    } finally {
      const [pending, dead] = await Promise.all([
        offlineQueue.getPendingCount(),
        typeof (offlineQueue as any).getDeadLetterCount === 'function'
          ? (offlineQueue as any).getDeadLetterCount()
          : Promise.resolve(0),
      ]);
      setQueueDepth(pending);
      setDeadLetterCount(dead);
      setIsSyncing(false);
    }
  };

  if (isOnline && queueDepth === 0 && deadLetterCount === 0) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={syncMessage}
      style={{
        marginHorizontal: Spacing.xxl,
        marginTop: Spacing.md,
        backgroundColor: needsAttention ? Colors.status.warningBg : Colors.status.successBg,
        borderColor: needsAttention ? Colors.status.warningBorder : Colors.status.successBorder,
        borderWidth: 1,
        borderRadius: Radii.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
      }}
    >
      <Text style={{ fontSize: 16 }}>{isPipelineDisabled ? '\uD83D\uDCBE' : isOnline ? '\uD83D\uDD04' : '\uD83D\uDCE1'}</Text>
      <Text
        style={{
          flex: 1,
          ...Typography.caption,
          color: needsAttention ? Colors.status.warningText : Colors.status.successText,
        }}
      >
        {syncMessage}
      </Text>
      {isOnline && queueDepth > 0 && !isPipelineDisabled ? (
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
            minHeight: 48,
            justifyContent: 'center',
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
