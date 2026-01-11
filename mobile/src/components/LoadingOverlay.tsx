import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { useLoading } from '../contexts/LoadingContext';

export default function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading();
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(isLoading ? 1 : 0, {
        damping: 20,
        stiffness: 300,
      }),
      backgroundColor: interpolateColor(
        opacity.value,
        [0, 1],
        ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)']
      ),
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isLoading ? 1 : 0.8, {
            damping: 15,
            stiffness: 300,
          }),
        },
      ],
      opacity: withSpring(isLoading ? 1 : 0, {
        damping: 20,
        stiffness: 300,
      }),
    };
  });

  if (!isLoading) return null;

  return (
    <Animated.View style={[styles.overlay, animatedStyle]}>
      <Animated.View style={[styles.content, contentStyle]}>
        <ActivityIndicator size="large" color="#0B5FFF" />
        <Text style={styles.message}>
          {loadingMessage || 'Loading...'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101828',
    textAlign: 'center',
  },
});
