import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '../../theme/tokens';

const APP_ICON = require('../../../assets/icon.png');
const WELCOME_ANIMATION = require('../../../assets/animations/welcome.json');

interface WelcomeStepProps {
  onNext: () => void;
}

const BENEFITS = [
  {
    icon: 'cloud-offline-outline' as keyof typeof Ionicons.glyphMap,
    key: 'benefit1',
  },
  {
    icon: 'camera-outline' as keyof typeof Ionicons.glyphMap,
    key: 'benefit2',
  },
  {
    icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
    key: 'benefit3',
  },
];

/**
 * WelcomeStep Component
 * 
 * First onboarding step: Welcome & value proposition
 * - Clear brand identity
 * - Immediate value clarity
 * - Trust signals
 * - Quick start CTA
 */
export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  const { t } = useTranslation();
  const [pressing, setPressing] = React.useState(false);

  const handlePress = React.useCallback(() => {
    if (pressing) return;
    setPressing(true);

    // Safety timeout: reset pressing after 5s to prevent permanently disabled button
    const safetyTimer = setTimeout(() => setPressing(false), 5000);

    try {
      const result: unknown = onNext();
      // If onNext returns a promise, catch any async errors
      if (result && typeof (result as Record<string, unknown>).catch === 'function') {
        (result as Promise<unknown>).catch((err: unknown) => {
          if (__DEV__) console.error('WelcomeStep onNext error:', err);
        }).finally(() => {
          clearTimeout(safetyTimer);
          setPressing(false);
        });
      } else {
        clearTimeout(safetyTimer);
        setPressing(false);
      }
    } catch (err) {
      if (__DEV__) console.error('WelcomeStep onNext sync error:', err);
      clearTimeout(safetyTimer);
      setPressing(false);
    }
  }, [onNext, pressing]);

  return (
    <View style={styles.container}>
      {/* App Animation + Logo */}
      <Animated.View 
        style={styles.logoContainer}
        entering={FadeInDown.delay(100).springify()}
      >
        <LottieView
          source={WELCOME_ANIMATION}
          autoPlay
          loop={false}
          style={styles.lottieAnimation}
          speed={1.2}
        />
        <Image source={APP_ICON} style={styles.logoOverlay} />
      </Animated.View>

      {/* Welcome Text */}
      <Animated.View
        style={styles.textContainer}
        entering={FadeInDown.delay(200).springify()}
      >
        <Text style={styles.title}>{t('onboarding.welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.welcome.subtitle')}</Text>
      </Animated.View>

      {/* Benefits List */}
      <Animated.View
        style={styles.benefitsContainer}
        entering={FadeInDown.delay(300).springify()}
      >
        {BENEFITS.map((benefit, index) => (
          <View key={benefit.key} style={styles.benefitRow}>
            <View style={styles.benefitIconContainer}>
              <Ionicons name={benefit.icon} size={24} color={colors.primary} />
            </View>
            <Text style={styles.benefitText}>
              {t(`onboarding.welcome.${benefit.key}`)}
            </Text>
          </View>
        ))}
      </Animated.View>

      {/* Trust Badges */}
      <Animated.View
        style={styles.trustContainer}
        entering={FadeInDown.delay(400).springify()}
      >
        <View style={styles.trustBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
          <Text style={styles.trustText}>{t('onboarding.welcome.ndpcCompliant')}</Text>
        </View>
        <View style={styles.trustBadge}>
          <Ionicons name="document-text" size={16} color={colors.success} />
          <Text style={styles.trustText}>{t('onboarding.welcome.firsApproved')}</Text>
        </View>
      </Animated.View>

      {/* CTA Button */}
      <Animated.View
        style={styles.ctaContainer}
        entering={FadeInDown.delay(500).springify()}
      >
        <TouchableOpacity
          style={[styles.ctaButton, pressing && styles.ctaButtonDisabled]}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={pressing}
          accessibilityLabel={t('onboarding.welcome.letsStart')}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{t('onboarding.welcome.letsStart')}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>

        <Text style={styles.estimateText}>
          {t('onboarding.welcome.timeEstimate')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    position: 'relative',
    height: 140,
    justifyContent: 'center',
  },
  lottieAnimation: {
    width: 140,
    height: 140,
    position: 'absolute',
  },
  logoOverlay: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.size.lg,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: spacing.md,
  },
  benefitsContainer: {
    marginBottom: spacing.xxl,
    gap: spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: colors.primaryBgSubtle,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successBgSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  trustText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.success,
  },
  ctaContainer: {
    marginTop: 'auto',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 4,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textOnPrimary,
  },
  estimateText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
