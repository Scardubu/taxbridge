import React, { memo, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing, typography } from '../theme/tokens';

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
  showScanAction?: boolean;
}

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
  showScanAction = true,
}: QuickActionRailProps) {
  const { t } = useTranslation();

  const actions: QuickAction[] = useMemo(() => {
    const baseActions: QuickAction[] = [
      {
        id: 'create',
        icon: '📄',
        label: t('quickActions.create'),
        sublabel: t('quickActions.createSublabel'),
        color: colors.primary,
        bgColor: colors.primaryLight,
      },
      {
        id: 'scan',
        icon: '📷',
        label: t('quickActions.scan'),
        sublabel: t('quickActions.scanSublabel'),
        color: colors.actionGreen,
        bgColor: colors.actionGreenBg,
      },
      {
        id: 'invoices',
        icon: '📋',
        label: t('quickActions.invoices'),
        sublabel: t('quickActions.invoicesSublabel'),
        color: colors.actionPurple,
        bgColor: colors.actionPurpleBg,
      },
      {
        id: 'calculator',
        icon: '🧮',
        label: t('quickActions.tax'),
        sublabel: t('quickActions.taxSublabel'),
        color: colors.actionOrange,
        bgColor: colors.actionOrangeBg,
      },
    ];

    if (!showScanAction) {
      return baseActions.filter((action) => action.id !== 'scan');
    }

    return baseActions;
  }, [showScanAction, t]);

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
      <Text style={styles.sectionTitle}>{t('quickActions.title')}</Text>
      <View style={styles.rail}>
        {actions.map((action) => (
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
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  actionContainer: {
    flex: 1,
    paddingHorizontal: spacing.xs,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.borderTransparent,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: typography.weight.extrabold,
  },
  actionSublabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
