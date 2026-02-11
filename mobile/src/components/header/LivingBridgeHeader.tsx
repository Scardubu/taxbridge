import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ImageSourcePropType,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import HeaderBackground from './HeaderBackground';
import TrustBadge from './TrustBadge';
import InfoPill from './InfoPill';
import MetricChip from './MetricChip';

const defaultLogo = require('../../../assets/icon.png');

export type HeaderVariant = 'full' | 'compact' | 'onboarding';

interface LivingBridgeHeaderProps {
  /**
   * Variant determines layout density
   * - full: Complete header with all elements (home/dashboard)
   * - compact: Reduced height, fewer elements (detail screens)
   * - onboarding: Special layout with progress and skip actions
   */
  variant?: HeaderVariant;

  /**
   * Brand title (defaults to TaxBridge)
   */
  title?: string;

  /**
   * Tagline/subtitle below title
   */
  subtitle?: string;

  /**
   * Custom logo source (defaults to app icon)
   */
  logoSource?: ImageSourcePropType;

  /**
   * Show offline/online indicator badge
   */
  showNetworkStatus?: boolean;

  /**
   * Current network status
   */
  isOnline?: boolean;

  /**
   * Show progress bar (onboarding variant)
   */
  showProgress?: boolean;

  /**
   * Progress value 0-1 (onboarding variant)
   */
  progress?: number;

  /**
   * Show trust badges (NDPR, Offline, NRS)
   */
  showTrustBadges?: boolean;

  /**
   * Show info pills with educational microcopy
   */
  showInfoPills?: boolean;

  /**
   * Show metric chip (e.g., "30s AVG SETUP")
   */
  showMetricChip?: boolean;

  /**
   * Metric chip value
   */
  metricValue?: string;

  /**
   * Metric chip label
   */
  metricLabel?: string;

  /**
   * Show skip button (onboarding)
   */
  showSkip?: boolean;

  /**
   * Skip button callback
   */
  onSkip?: () => void;

  /**
   * Show save/finish later button
   */
  showSave?: boolean;

  /**
   * Save button callback
   */
  onSave?: () => void;

  /**
   * Custom children to render in header content area
   */
  children?: React.ReactNode;
}

function LivingBridgeHeader({
  variant = 'full',
  title,
  subtitle,
  logoSource = defaultLogo,
  showNetworkStatus = true,
  isOnline = true,
  showProgress = false,
  progress = 0,
  showTrustBadges = true,
  showInfoPills = false,
  showMetricChip = false,
  metricValue = '30s',
  metricLabel = 'AVG SETUP',
  showSkip = false,
  onSkip,
  showSave = false,
  onSave,
  children,
}: LivingBridgeHeaderProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isCompact = variant === 'compact';
  const isOnboarding = variant === 'onboarding';
  const isFull = variant === 'full';

  // Logo pulse animation
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (!isCompact) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [isCompact]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Progress bar animation — animate a number, map to string in style
  const progressShared = useSharedValue(Math.min(Math.max(progress, 0), 1) * 100);

  React.useEffect(() => {
    progressShared.value = withSpring(Math.min(Math.max(progress, 0), 1) * 100, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress]);

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressShared.value}%`,
  }));

  const displayTitle = title ?? t('common.taxbridgeName');
  const displaySubtitle = subtitle ?? t('common.taxbridgeSlogan');

  // Optimized heights: onboarding is more compact (110px) to reduce distraction
  const headerHeight = isCompact ? 80 : isOnboarding ? 110 : 220;
  const showBgArc = !isCompact && !isOnboarding; // Hide arc in onboarding for cleaner look

  return (
    <View style={[styles.container, { minHeight: headerHeight }]}>
      {/* SVG Background with Living Bridge arcs */}
      <HeaderBackground
        height={headerHeight}
        showGrid={!isCompact}
        showArc={showBgArc}
      />

      {/* Main Content */}
      <Animated.View
        style={styles.content}
        entering={FadeIn.duration(400)}
      >
        {/* Top Row: Network Status + Actions */}
        <View style={styles.topRow}>
          {/* Network Status Badge */}
          {showNetworkStatus && (
            <View
              style={[
                styles.networkBadge,
                isOnline ? styles.networkOnline : styles.networkOffline,
              ]}
              accessibilityRole="text"
              accessibilityLabel={isOnline ? t('common.syncReady') : t('common.offlineMode')}
            >
              <Text style={styles.networkDot}>{isOnline ? '●' : '○'}</Text>
              <Text
                style={[
                  styles.networkText,
                  isOnline ? styles.networkTextOnline : styles.networkTextOffline,
                ]}
              >
                {isOnline ? t('common.syncReady') : t('common.offlineMode')}
              </Text>
            </View>
          )}

          {/* Action Buttons (Skip/Save) */}
          <View style={styles.actions}>
            {showSave && onSave && (
              <TouchableOpacity
                onPress={onSave}
                style={styles.saveButton}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.finishLater')}
              >
                <Text style={styles.saveText}>💾 {t('onboarding.save')}</Text>
              </TouchableOpacity>
            )}

            {showSkip && onSkip && (
              <TouchableOpacity
                onPress={onSkip}
                style={styles.skipButton}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.skip')}
              >
                <Text style={styles.skipText}>{t('onboarding.skip')} →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Brand Section: Logo + Title */}
        <View style={[styles.brandSection, (isCompact || isOnboarding) && styles.brandSectionCompact]}>
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <View style={[styles.logoCircle, (isCompact || isOnboarding) && styles.logoCircleCompact]}>
              <Image
                source={logoSource}
                style={[styles.logoImage, (isCompact || isOnboarding) && styles.logoImageCompact]}
                resizeMode="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('common.taxbridgeLogo')}
              />
            </View>
          </Animated.View>

          <View style={styles.brandText}>
            <Text style={[styles.title, (isCompact || isOnboarding) && styles.titleCompact]}>
              {displayTitle}
            </Text>
            <Text style={[styles.subtitle, (isCompact || isOnboarding) && styles.subtitleCompact]}>{displaySubtitle}</Text>
          </View>

          {/* Metric Chip (right side) */}
          {showMetricChip && !isCompact && (
            <MetricChip
              value={metricValue}
              label={metricLabel}
              tone="indigo"
            />
          )}
        </View>

        {/* Progress Bar (onboarding) */}
        {showProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress * 100)}% {t('common.complete')}
            </Text>
          </View>
        )}

        {/* Trust Badges Row */}
        {showTrustBadges && !isCompact && (
          <View style={styles.badgesRow}>
            <TrustBadge
              label={t('onboarding.metaEnglishPidgin')}
              icon="🌍"
              tone="green"
              compact
            />
            <TrustBadge
              label={t('onboarding.metaOfflineSync')}
              icon="🔄"
              tone="blue"
              compact
            />
            <TrustBadge
              label={t('onboarding.metaNdprSecure')}
              icon="🔒"
              tone="indigo"
              compact
            />
          </View>
        )}

        {/* Info Pills Row (educational microcopy) */}
        {showInfoPills && isFull && (
          <View style={styles.pillsRow}>
            <InfoPill
              icon="📄"
              title={t('common.builtForSMEs')}
              subtitle={t('common.onboardingDesc')}
              compact={width < 400}
            />
            <InfoPill
              icon="🔁"
              title={t('common.autoSync')}
              subtitle={t('common.localFirst')}
              compact={width < 400}
            />
          </View>
        )}

        {/* Custom children slot */}
        {children}
      </Animated.View>
    </View>
  );
}

export default memo(LivingBridgeHeader);

const isWeb = Platform.OS === 'web';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
    ...(isWeb
      ? { boxShadow: '0 6px 18px rgba(9, 30, 66, 0.06)' }
      : {
          shadowColor: colors.shadowHeader,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          elevation: 4,
        }),
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    zIndex: 1,
  },

  // Top Row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  // Network Badge
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    gap: 6,
  },
  networkOnline: {
    backgroundColor: colors.overlaySuccess,
  },
  networkOffline: {
    backgroundColor: colors.overlayWarning,
  },
  networkDot: {
    fontSize: 10,
  },
  networkText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  networkTextOnline: {
    color: colors.success,
  },
  networkTextOffline: {
    color: colors.warningDark,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  saveText: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  skipText: {
    fontSize: typography.size.xs + 1,
    fontWeight: typography.weight.semibold,
    color: colors.warningDark,
  },

  // Brand Section
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  brandSectionCompact: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  logoContainer: {},
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryBorder,
  },
  logoCircleCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logoImageCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  brandText: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.black,
    color: colors.brandNavy900,
    letterSpacing: 0.5,
  },
  titleCompact: {
    fontSize: typography.size.lg,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: typography.weight.medium,
  },
  subtitleCompact: {
    fontSize: typography.size.xs,
    marginTop: 1,
  },

  // Progress
  progressContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  progressTrack: {
    width: '80%',
    height: 6,
    backgroundColor: colors.borderSubtle,
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
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontWeight: typography.weight.semibold,
  },

  // Badges Row
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  // Pills Row
  pillsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
