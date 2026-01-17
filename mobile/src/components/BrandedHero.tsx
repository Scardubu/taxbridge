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
import { colors, radii, spacing, typography } from '../theme/tokens';

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
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    minHeight: 220,
  },
  containerCompact: {
    minHeight: 120,
    marginBottom: spacing.lg,
  },
  gradientLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryDeep,
  },
  gradientLayer2: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    opacity: 0.7,
    transform: [{ translateY: 40 }],
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
    zIndex: 1,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: 20,
    marginBottom: spacing.md,
    gap: 6,
  },
  onlineBadge: {
    backgroundColor: colors.overlaySuccess,
  },
  offlineBadge: {
    backgroundColor: colors.overlayWarning,
  },
  networkDot: {
    fontSize: 10,
    color: colors.success,
  },
  networkText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.success,
  },
  offlineText: {
    color: colors.warning,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.overlayLightBorder,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textOnPrimary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  titleCompact: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textOnPrimaryMuted,
    textAlign: 'center',
    marginTop: spacing.sm - 2,
    fontWeight: typography.weight.medium,
    fontStyle: 'italic',
  },
  progressContainer: {
    width: '100%',
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  progressTrack: {
    width: '80%',
    height: 6,
    backgroundColor: colors.overlayLightStrong,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: typography.size.xs,
    color: colors.textOnPrimarySubtle,
    marginTop: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.overlayLightSubtle,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.md,
    gap: 4,
  },
  badgeIcon: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    color: colors.textOnPrimary,
    fontWeight: typography.weight.semibold,
  },
});
