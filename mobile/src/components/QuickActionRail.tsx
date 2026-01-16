import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  color: string;
  bgColor: string;
}

interface QuickActionRailProps {
  onCreateInvoice?: () => void;
  onScanReceipt?: () => void;
  onViewInvoices?: () => void;
  onTaxCalculator?: () => void;
}

const ACTIONS: QuickAction[] = [
  {
    id: 'create',
    icon: '📄',
    label: 'Create',
    sublabel: 'New Invoice',
    color: '#0B5FFF',
    bgColor: '#EBF4FF',
  },
  {
    id: 'scan',
    icon: '📷',
    label: 'Scan',
    sublabel: 'Receipt',
    color: '#059669',
    bgColor: '#ECFDF5',
  },
  {
    id: 'invoices',
    icon: '📋',
    label: 'View',
    sublabel: 'Invoices',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
  },
  {
    id: 'calculator',
    icon: '🧮',
    label: 'Tax',
    sublabel: 'Calculator',
    color: '#EA580C',
    bgColor: '#FFF7ED',
  },
];

function ActionButton({ action, onPress }: { action: QuickAction; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
  }));

  const handlePressIn = () => {
    scale.value = 0.95;
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  return (
    <Animated.View style={[styles.actionContainer, animatedStyle]}>
      <Pressable
        style={[styles.actionButton, { backgroundColor: action.bgColor }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${action.label} ${action.sublabel || ''}`}
      >
        <Text style={styles.actionIcon}>{action.icon}</Text>
        <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
        {action.sublabel && (
          <Text style={styles.actionSublabel}>{action.sublabel}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function QuickActionRail({
  onCreateInvoice,
  onScanReceipt,
  onViewInvoices,
  onTaxCalculator,
}: QuickActionRailProps) {
  const handleAction = useCallback((actionId: string) => {
    switch (actionId) {
      case 'create':
        onCreateInvoice?.();
        break;
      case 'scan':
        onScanReceipt?.();
        break;
      case 'invoices':
        onViewInvoices?.();
        break;
      case 'calculator':
        onTaxCalculator?.();
        break;
    }
  }, [onCreateInvoice, onScanReceipt, onViewInvoices, onTaxCalculator]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.rail}>
        {ACTIONS.map((action) => (
          <ActionButton
            key={action.id}
            action={action}
            onPress={() => handleAction(action.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default memo(QuickActionRail);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#344054',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  rail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  actionContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  actionSublabel: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
  },
});
