import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { useContext } from 'react';
import { SyncContext } from '../contexts/SyncContext';

export default function NetworkStatus() {
  const { isConnected, isOnline } = useNetwork();
  const syncCtx = useContext(SyncContext);
  const syncing = !!(syncCtx && syncCtx.isSyncing);

  if (isConnected && isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {!isConnected ? 'No connection' : 'No internet'}{syncing ? ' — Syncing…' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
  },
});
