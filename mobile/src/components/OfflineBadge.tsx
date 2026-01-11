import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function OfflineBadge({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FEE4E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FECACA',
    zIndex: 20,
    pointerEvents: 'none',
  },
  text: { color: '#B42318', fontWeight: '700' }
});
