import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function OfflineBadge({ online }: { online: boolean }) {
  const { t } = useTranslation();
  
  if (online) return null;
  
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📵</Text>
      <Text style={styles.text}>{t('network.offlineMode')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  text: { 
    color: '#B42318', 
    fontWeight: '700',
    fontSize: 12,
  },
});
