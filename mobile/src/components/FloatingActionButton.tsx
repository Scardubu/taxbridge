/**
 * FloatingActionButton Component
 * 
 * Phase 7: User Flow Optimizations
 * 
 * A floating action button with expandable menu for quick actions.
 * Provides 1-2 tap access to common tasks like invoice creation.
 * 
 * Features:
 * - Animated expand/collapse
 * - Haptic feedback
 * - Accessibility support
 * - Configurable actions
 */

import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography, shadows } from '../theme/tokens';
import { trackNavigation } from '../services/analytics';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

interface FABAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}

interface FloatingActionButtonProps {
  onCreateInvoice: () => void;
  onScanReceipt?: () => void;
  onViewInvoices?: () => void;
  onTaxCalculator?: () => void;
  showScanAction?: boolean;
  position?: 'bottom-right' | 'bottom-center';
}

// ============================================================================
// Constants
// ============================================================================

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 200,
  mass: 0.8,
};

const FAB_SIZE = 56;
const MINI_FAB_SIZE = 48;
const ACTION_SPACING = 12;

// ============================================================================
// Sub-components
// ============================================================================

interface ActionButtonProps {
  action: FABAction;
  index: number;
  expanded: boolean;
  onPress: () => void;
}

const ActionButton = memo(({ action, index, expanded, onPress }: ActionButtonProps) => {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const offset = (index + 1) * (MINI_FAB_SIZE + ACTION_SPACING);
    translateY.value = withSpring(expanded ? -offset : 0, SPRING_CONFIG);
    scale.value = withSpring(expanded ? 1 : 0, SPRING_CONFIG);
    opacity.value = withTiming(expanded ? 1 : 0, { duration: 200 });
  }, [expanded, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={[styles.actionButtonContainer, animatedStyle]}>
      <View style={styles.actionLabelContainer}>
        <Text style={styles.actionLabel}>{action.label}</Text>
      </View>
      <Pressable
        style={[styles.miniButton, { backgroundColor: action.bgColor }]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
      >
        <Text style={styles.miniIcon}>{action.icon}</Text>
      </Pressable>
    </Animated.View>
  );
});

ActionButton.displayName = 'ActionButton';

// ============================================================================
// Main Component
// ============================================================================

function FloatingActionButton({
  onCreateInvoice,
  onScanReceipt,
  onViewInvoices,
  onTaxCalculator,
  showScanAction = true,
  position = 'bottom-right',
}: FloatingActionButtonProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  // Build actions array
  const actions: FABAction[] = React.useMemo(() => {
    const baseActions: FABAction[] = [
      {
        id: 'create',
        icon: '📄',
        label: t('fab.createInvoice'),
        color: colors.primary,
        bgColor: colors.primaryLight,
        onPress: onCreateInvoice,
      },
    ];

    if (showScanAction && onScanReceipt) {
      baseActions.push({
        id: 'scan',
        icon: '📷',
        label: t('fab.scanReceipt'),
        color: colors.actionGreen,
        bgColor: colors.actionGreenBg,
        onPress: onScanReceipt,
      });
    }

    if (onViewInvoices) {
      baseActions.push({
        id: 'invoices',
        icon: '📋',
        label: t('fab.viewInvoices'),
        color: colors.actionPurple,
        bgColor: colors.actionPurpleBg,
        onPress: onViewInvoices,
      });
    }

    if (onTaxCalculator) {
      baseActions.push({
        id: 'tax',
        icon: '🧮',
        label: t('fab.taxCalculator'),
        color: colors.actionOrange,
        bgColor: colors.actionOrangeBg,
        onPress: onTaxCalculator,
      });
    }

    return baseActions;
  }, [t, showScanAction, onCreateInvoice, onScanReceipt, onViewInvoices, onTaxCalculator]);

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpanded(prev => {
      const newValue = !prev;
      rotation.value = withSpring(newValue ? 45 : 0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(newValue ? 1 : 0, { duration: 200 });
      return newValue;
    });
  }, []);

  const handleActionPress = useCallback((action: FABAction) => {
    trackNavigation('fab', action.id, 'fab');
    setExpanded(false);
    rotation.value = withSpring(0, SPRING_CONFIG);
    backdropOpacity.value = withTiming(0, { duration: 200 });
    action.onPress();
  }, []);

  const closeMenu = useCallback(() => {
    if (expanded) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setExpanded(false);
      rotation.value = withSpring(0, SPRING_CONFIG);
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [expanded]);

  // If only one action, don't show menu - just trigger action directly
  const handleMainPress = useCallback(() => {
    if (actions.length === 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      trackNavigation('fab', actions[0].id, 'fab');
      actions[0].onPress();
    } else {
      toggleExpanded();
    }
  }, [actions, toggleExpanded]);

  const mainButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  const containerStyle = position === 'bottom-center' 
    ? styles.containerCenter 
    : styles.containerRight;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPressable} onPress={closeMenu} />
      </Animated.View>

      {/* FAB Container */}
      <View style={[styles.container, containerStyle]}>
        {/* Action Buttons */}
        {actions.length > 1 && actions.map((action, index) => (
          <ActionButton
            key={action.id}
            action={action}
            index={index}
            expanded={expanded}
            onPress={() => handleActionPress(action)}
          />
        ))}

        {/* Main FAB */}
        <Pressable
          style={styles.mainButton}
          onPress={handleMainPress}
          accessibilityRole="button"
          accessibilityLabel={actions.length === 1 ? actions[0].label : expanded ? t('common.close') : t('quickActions.title')}
          accessibilityState={{ expanded }}
          accessibilityHint={actions.length > 1 ? 'Double tap to expand quick actions' : undefined}
        >
          <Animated.Text style={[styles.mainIcon, mainButtonStyle]}>
            {actions.length === 1 ? '📄' : '+'}
          </Animated.Text>
        </Pressable>
      </View>
    </>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 998,
  },
  backdropPressable: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    bottom: 90, // Above tab bar
    zIndex: 999,
    alignItems: 'center',
  },
  containerRight: {
    right: spacing.lg,
  },
  containerCenter: {
    left: (width - FAB_SIZE) / 2,
  },
  mainButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  mainIcon: {
    fontSize: 24,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  actionButtonContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionLabelContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    ...shadows.sm,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  miniButton: {
    width: MINI_FAB_SIZE,
    height: MINI_FAB_SIZE,
    borderRadius: MINI_FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  miniIcon: {
    fontSize: 20,
  },
});

export default memo(FloatingActionButton);
