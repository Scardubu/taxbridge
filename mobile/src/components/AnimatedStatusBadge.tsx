import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface StatusBadgeProps {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'stamped';
  size?: 'small' | 'medium' | 'large';
}

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
    };
  });

  React.useEffect(() => {
    scale.value = 1.1;
    const timer = setTimeout(() => {
      scale.value = 1;
    }, 200);
    
    return () => clearTimeout(timer);
  }, [status, scale]);

  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
        return {
          backgroundColor: colors.warningBg,
          color: colors.warningDark,
          text: t('common.queued'),
        };
      case 'processing':
        return {
          backgroundColor: colors.infoBg,
          color: colors.infoDark,
          text: t('common.processing'),
        };
      case 'completed':
        return {
          backgroundColor: colors.successBg,
          color: colors.successDark,
          text: t('common.completed'),
        };
      case 'failed':
        return {
          backgroundColor: colors.errorBg,
          color: colors.errorDark,
          text: t('common.failed'),
        };
      case 'stamped':
        return {
          backgroundColor: colors.successBg,
          color: colors.successDark,
          text: t('common.stamped'),
        };
      default:
        return {
          backgroundColor: colors.neutralBg,
          color: colors.neutralDark,
          text: t('common.unknown'),
        };
    }
  };

  const config = getStatusConfig();
  const sizeConfig = {
    small: { paddingVertical: 4, paddingHorizontal: 8, fontSize: 10 },
    medium: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 12 },
    large: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 },
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
          ...sizeConfig[size],
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: sizeConfig[size].fontSize,
          },
        ]}
      >
        {config.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
});
