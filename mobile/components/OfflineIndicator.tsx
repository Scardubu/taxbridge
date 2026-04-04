import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { palette, radius, spacing, typography } from './design-system/tokens';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const netInfo = NetInfo.useNetInfo();
  const isOffline = netInfo.isConnected === false;

  if (!isOffline) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t('offline.title')}
      style={{
        backgroundColor: palette.amber50,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: palette.warning + '40',
      }}
    >
      <Ionicons name="cloud-offline" size={18} color={palette.amber600} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyBold, color: palette.gray900 }}>{t('offline.title')}</Text>
        <Text style={{ ...typography.caption, color: palette.gray600 }}>{t('offline.body')}</Text>
      </View>
    </View>
  );
}
