import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import type { LocalInvoiceRow } from '../types/invoice';
import AnimatedStatusBadge from './AnimatedStatusBadge';

export default function InvoiceCard(props: { invoice: LocalInvoiceRow; onPress?: () => void }) {
  const inv = props.invoice;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(scale.value, {
            damping: 15,
            stiffness: 300,
          }),
        },
      ],
    };
  });

  const handlePressIn = () => {
    scale.value = 0.98;
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  const isOffline = inv.synced === 0;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={props.onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{inv.customerName || 'Walk-in customer'}</Text>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
          </View>
          <AnimatedStatusBadge status={inv.status} size="small" />
        </View>
        <View style={styles.row}>
          <Text style={styles.meta}>{new Date(inv.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.amount}>₦{Number(inv.total).toFixed(2)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },
  offlineIndicator: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  meta: {
    color: '#667085',
    fontSize: 14,
  },
  amount: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
});
