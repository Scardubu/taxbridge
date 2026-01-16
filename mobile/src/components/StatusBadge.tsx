import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceStatus } from '../types/invoice';

export default function StatusBadge(props: { status: InvoiceStatus }) {
  const color =
    props.status === 'stamped'
      ? '#0E7A3E'
      : props.status === 'processing'
        ? '#9A6700'
        : props.status === 'failed'
          ? '#B42318'
          : '#344054';

  const bg =
    props.status === 'stamped'
      ? '#E6F4EA'
      : props.status === 'processing'
        ? '#FFF7DB'
        : props.status === 'failed'
          ? '#FEE4E2'
          : '#EEF2F6';

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{props.status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1
  },
  text: {
    fontSize: 12,
    fontWeight: '700'
  }
});
