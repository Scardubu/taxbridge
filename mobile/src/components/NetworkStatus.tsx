import { memo, useContext, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../contexts/NetworkContext';
import { SyncContext } from '../contexts/SyncContext';
import { colors, spacing, typography, radii } from '../theme/tokens';

const NetworkStatus = memo(function NetworkStatus() {
  const { t } = useTranslation();
  const { isConnected, isOnline } = useNetwork();
  const syncCtx = useContext(SyncContext);
  const syncing = !!(syncCtx && syncCtx.isSyncing);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (syncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [syncing, pulseAnim]);

  if (isConnected && isOnline) {
    return null;
  }

  const statusText = !isConnected 
    ? t('network.noConnection') 
    : t('network.noInternet');

  return (
    <View style={[styles.container, syncing && styles.containerSyncing]}>
      {syncing && (
        <Animated.View style={[styles.syncDot, { opacity: pulseAnim }]} />
      )}
      <Text style={styles.text}>
        {statusText}
        {syncing && (
          <Text style={styles.syncText}> • {t('network.syncing')}…</Text>
        )}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.errorBg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerSyncing: {
    backgroundColor: colors.warningBg,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.warningDark,
    marginRight: spacing.xs,
  },
  text: {
    color: colors.errorDark,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold as any,
  },
  syncText: {
    color: colors.warningDark,
    fontWeight: typography.weight.medium as any,
  },
});

export default NetworkStatus;
