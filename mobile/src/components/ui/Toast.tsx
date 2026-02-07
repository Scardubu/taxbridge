import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from '../../utils/safeHaptics';
import { colors, spacing, radii, typography } from '../../theme/tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  type: ToastType;
  message: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  duration?: number;
  haptic?: 'success' | 'error' | 'warning';
}

interface ToastProps extends ToastConfig {
  onDismiss: () => void;
}

const TOAST_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
};

/**
 * Toast Component
 * 
 * Unified toast notification system:
 * - Consistent design across success/error/warning/info
 * - Haptic feedback on display
 * - Optional action button
 * - Auto-dismiss with configurable duration
 */
export const Toast: React.FC<ToastProps> = ({
  type,
  message,
  action,
  duration = 3000,
  haptic,
  onDismiss,
}) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Trigger haptic feedback
    if (haptic && Platform.OS !== 'web') {
      const hapticType = {
        success: Haptics.NotificationFeedbackType.Success,
        error: Haptics.NotificationFeedbackType.Error,
        warning: Haptics.NotificationFeedbackType.Warning,
      }[haptic];
      
      if (hapticType) {
        Haptics.notificationAsync(hapticType);
      }
    }

    // Animate in
    translateY.value = withSpring(0, { damping: 15 });
    opacity.value = withTiming(1, { duration: 200 });

    // Auto-dismiss
    if (duration > 0) {
      dismissTimeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  const handleDismiss = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)();
      }
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const iconColor = TOAST_COLORS[type];
  const icon = TOAST_ICONS[type];

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.content}>
        <Ionicons name={icon} size={24} color={iconColor} />
        
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>

        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              action.onPress();
              handleDismiss();
            }}
          >
            <Text style={[styles.actionText, { color: iconColor }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  closeButton: {
    padding: spacing.xs,
  },
});

// Toast Manager (singleton)
let toastQueue: ToastConfig[] = [];
let currentToast: ToastConfig | null = null;
let toastComponentRef: ((config: ToastConfig | null) => void) | null = null;

export const ToastManager = {
  show: (config: ToastConfig) => {
    if (currentToast) {
      toastQueue.push(config);
    } else {
      currentToast = config;
      if (toastComponentRef) {
        toastComponentRef(config);
      }
    }
  },
  
  dismiss: () => {
    currentToast = null;
    if (toastQueue.length > 0) {
      const nextToast = toastQueue.shift()!;
      ToastManager.show(nextToast);
    } else if (toastComponentRef) {
      toastComponentRef(null);
    }
  },
  
  _setRef: (ref: (config: ToastConfig | null) => void) => {
    toastComponentRef = ref;
  },
};

// Convenience functions
export const showToast = (config: ToastConfig) => ToastManager.show(config);
export const dismissToast = () => ToastManager.dismiss();
