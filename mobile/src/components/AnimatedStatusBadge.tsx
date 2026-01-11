import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface StatusBadgeProps {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  size?: 'small' | 'medium' | 'large';
}

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
    };
  });

  React.useEffect(() => {
    scale.value = 1.1;
    setTimeout(() => {
      scale.value = 1;
    }, 200);
  }, [status]);

  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
        return {
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          text: 'Queued',
        };
      case 'processing':
        return {
          backgroundColor: '#DBEAFE',
          color: '#1E40AF',
          text: 'Processing',
        };
      case 'completed':
        return {
          backgroundColor: '#D1FAE5',
          color: '#065F46',
          text: 'Completed',
        };
      case 'failed':
        return {
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          text: 'Failed',
        };
      default:
        return {
          backgroundColor: '#F3F4F6',
          color: '#6B7280',
          text: 'Unknown',
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
