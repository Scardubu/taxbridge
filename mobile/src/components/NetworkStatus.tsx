import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../contexts/NetworkContext';
import { useContext, useRef, useEffect } from 'react';
import { SyncContext } from '../contexts/SyncContext';

export default function NetworkStatus() {
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
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerSyncing: {
    backgroundColor: '#FEF3C7',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
    marginRight: 8,
  },
  text: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  syncText: {
    color: '#92400E',
    fontWeight: '500',
  },
});
