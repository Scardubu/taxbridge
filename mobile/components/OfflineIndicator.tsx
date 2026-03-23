import React from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { palette, radius, spacing, typography } from './design-system/tokens';

export function OfflineIndicator() {
  const netInfo = NetInfo.useNetInfo();
  const isOffline = netInfo.isConnected === false;

  if (!isOffline) return null;

  return (
    <View style={{ backgroundColor: palette.warning, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <Text style={{ ...typography.bodyBold, color: palette.gray900 }}>Offline mode active</Text>
      <Text style={{ ...typography.caption, color: palette.gray900 }}>Changes are being saved locally and will sync when connectivity returns.</Text>
    </View>
  );
}
