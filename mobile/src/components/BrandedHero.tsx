import React, { memo } from 'react';
import { View, Text, StyleSheet, Image, ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const defaultLogo = require('../../assets/icon.png');

interface BrandedHeroProps {
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  progress?: number;
  showOfflineIndicator?: boolean;
  isOnline?: boolean;
  variant?: 'onboarding' | 'home' | 'compact';
  logoSource?: ImageSourcePropType;
}

function BrandedHero({
  title = 'TaxBridge',
  subtitle = 'Simplify Your Taxes, Bridge Your Future',
  showProgress = false,
  progress = 0,
  showOfflineIndicator = true,
  isOnline = true,
  variant = 'onboarding',
  logoSource = defaultLogo,
}: BrandedHeroProps) {
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    // Subtle pulse animation for the logo
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${progress * 100}%`, { damping: 15, stiffness: 100 }),
  }));

  const isCompact = variant === 'compact';

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      {/* Gradient Background (simulated with layered views) */}
      <View style={styles.gradientLayer1} />
      <View style={styles.gradientLayer2} />
      
      {/* Content */}
      <View style={styles.content}>
        {/* Offline/Online Indicator */}
        {showOfflineIndicator && (
          <View style={[styles.networkBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
            <Text style={styles.networkDot}>{isOnline ? '●' : '○'}</Text>
            <Text style={[styles.networkText, !isOnline && styles.offlineText]}>
              {isOnline ? 'Sync Ready' : 'Offline Mode'}
            </Text>
          </View>
        )}

        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.logoCircle}>
            <Image
              source={logoSource}
              style={styles.logoImage}
              resizeMode="contain"
              accessible
              accessibilityRole="image"
              accessibilityLabel="TaxBridge logo"
            />
          </View>
        </Animated.View>

        {/* Brand Title */}
        <Text style={[styles.title, isCompact && styles.titleCompact]}>{title}</Text>
        
        {/* Tagline */}
        {!isCompact && <Text style={styles.subtitle}>{subtitle}</Text>}

        {/* Progress Ring/Bar */}
        {showProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}% Complete</Text>
          </View>
        )}

        {/* Trust Badges */}
        {!isCompact && (
          <View style={styles.trustBadges}>
            <View style={styles.badge}>
              <Text style={styles.badgeIcon}>🔒</Text>
              <Text style={styles.badgeText}>NDPR Safe</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeIcon}>✓</Text>
              <Text style={styles.badgeText}>NRS Ready</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeIcon}>📵</Text>
              <Text style={styles.badgeText}>Works Offline</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default memo(BrandedHero);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    minHeight: 220,
  },
  containerCompact: {
    minHeight: 120,
    marginBottom: 16,
  },
  gradientLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#052B52',
  },
  gradientLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B5FFF',
    opacity: 0.7,
    transform: [{ translateY: 40 }],
  },
  content: {
    padding: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  onlineBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  offlineBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  networkDot: {
    fontSize: 10,
    color: '#10B981',
  },
  networkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  offlineText: {
    color: '#FBBF24',
  },
  logoContainer: {
    marginBottom: 12,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  titleCompact: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  progressTrack: {
    width: '80%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    fontWeight: '600',
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
});
