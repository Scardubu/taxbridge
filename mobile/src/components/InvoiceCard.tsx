import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import type { LocalInvoiceRow } from '../types/invoice';
import AnimatedStatusBadge from './AnimatedStatusBadge';
import { colors, radii, spacing, typography, shadows } from '../theme/tokens';

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
    backgroundColor: colors.surface,
    borderRadius: radii.md + 2,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  offlineIndicator: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
  },
  offlineText: {
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.warningDark,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  amount: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
  },
});
