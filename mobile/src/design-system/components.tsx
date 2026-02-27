/**
 * TaxBridge UI Component Library
 * Elite fintech-grade components for Nigerian SME market
 * All components: accessible, offline-safe, dark-mode ready
 */

import React, { useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  ActivityIndicator, StyleSheet, ViewStyle, TextStyle,
  TextInputProps, Platform, Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, withRepeat, Easing, runOnJS,
} from 'react-native-reanimated';
import { DURATION, EASE } from './animation';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows, animation } from './tokens';

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  disabled?:  boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?:    'light' | 'medium' | 'heavy' | 'none';
  style?:     ViewStyle;
  textStyle?: TextStyle;
  testID?:    string;
}

const BUTTON_HEIGHTS: Record<ButtonSize, number> = {
  xs: 36, sm: 44, md: 52, lg: 58,
};

const BUTTON_TEXT_SIZES: Record<ButtonSize, number> = {
  xs: 13, sm: 14, md: 15, lg: 16,
};

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: colors.primary[500], text: colors.textInverse },
  secondary: { bg: colors.primary[50],  text: colors.primary[700], border: colors.primary[200] },
  ghost:     { bg: 'transparent',        text: colors.primary[600] },
  danger:    { bg: colors.red[500],      text: colors.textInverse },
  success:   { bg: colors.success,       text: colors.textInverse },
  outline:   { bg: 'transparent',        text: colors.textSecondary, border: colors.border },
};

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, leftIcon, rightIcon,
  fullWidth = false, haptic = 'light', style, textStyle, testID,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, animation.spring.button);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.spring.button);
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || loading) return;
    if (haptic !== 'none') {
      const hapticMap = {
        light:  Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy:  Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(hapticMap[haptic]).catch(() => {});
    }
    onPress();
  }, [disabled, loading, haptic, onPress]);

  const vs = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[animatedStyle, fullWidth && { width: '100%' }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isDisabled}
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          styles.buttonBase,
          {
            height: BUTTON_HEIGHTS[size],
            backgroundColor: vs.bg,
            borderColor: vs.border ?? 'transparent',
            borderWidth: vs.border ? 1.5 : 0,
            opacity: isDisabled ? 0.5 : 1,
            paddingHorizontal: size === 'xs' ? spacing[3] : size === 'sm' ? spacing[4] : spacing[5],
          },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        {loading ? (
          <ActivityIndicator
            size="small"
            color={vs.text}
            testID={`${testID}-loader`}
          />
        ) : (
          <Text
            style={[
              styles.buttonText,
              {
                color: vs.text,
                fontSize: BUTTON_TEXT_SIZES[size],
                fontWeight: typography.weights.semibold,
              },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}

        {rightIcon && !loading && <View style={styles.iconRight}>{rightIcon}</View>}
      </Pressable>
    </Animated.View>
  );
}

// ─── NairaInput ───────────────────────────────────────────────────────────────
// Financial-grade currency input with ₦ prefix, auto-formatting, validation

interface NairaInputProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?:       string;
  value:        number | undefined;
  onChangeText: (raw: number, formatted: string) => void;
  error?:       string;
  hint?:        string;
  required?:    boolean;
  maxAmount?:   number;
  testID?:      string;
}

export function NairaInput({
  label, value, onChangeText, error, hint, required,
  maxAmount, testID, ...props
}: NairaInputProps) {
  const isFocused = useSharedValue(0);

  const borderAnimStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(
      error
        ? colors.error
        : isFocused.value === 1
          ? colors.primary[500]
          : colors.border,
      { duration: DURATION.instant }
    ),
    borderWidth: withTiming(
      isFocused.value === 1 ? 2 : 1.5,
      { duration: DURATION.instant }
    ),
  }));

  const formattedDisplay = value !== undefined && value > 0
    ? value.toLocaleString('en-NG', { maximumFractionDigits: 2 })
    : '';

  const handleChange = (text: string) => {
    // Strip everything non-numeric except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    // Handle multiple decimal points
    const parts = cleaned.split('.');
    const normalised = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('')}`
      : cleaned;

    const raw = parseFloat(normalised) || 0;

    if (maxAmount && raw > maxAmount) return;

    const formatted = raw > 0
      ? raw.toLocaleString('en-NG', { maximumFractionDigits: 2 })
      : '';

    onChangeText(raw, formatted);
  };

  return (
    <View style={inputStyles.wrapper} testID={testID}>
      {label && (
        <Text style={inputStyles.label}>
          {label}
          {required && <Text style={inputStyles.required}> *</Text>}
        </Text>
      )}

      <Animated.View style={[inputStyles.inputContainer, borderAnimStyle]}>
        <Text style={inputStyles.prefix}>₦</Text>
        <TextInput
          value={formattedDisplay}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          onFocus={() => { isFocused.value = 1; }}
          onBlur={() => { isFocused.value = 0; }}
          style={[inputStyles.input, inputStyles.monoFont]}
          placeholderTextColor={colors.textDisabled}
          accessible
          accessibilityLabel={label ?? 'Amount input'}
          accessibilityHint={`Enter amount in Naira${maxAmount ? `, maximum ₦${maxAmount.toLocaleString('en-NG')}` : ''}`}
          {...props}
        />
      </Animated.View>

      {error ? (
        <Text style={inputStyles.error} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? (
        <Text style={inputStyles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── TextInputField ───────────────────────────────────────────────────────────

interface TextInputFieldProps extends TextInputProps {
  label?:    string;
  error?:    string;
  hint?:     string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  testID?:   string;
}

export function TextInputField({
  label, error, hint, required, leftIcon, testID, ...props
}: TextInputFieldProps) {
  const isFocused = useSharedValue(0);

  const borderAnimStyle = useAnimatedStyle(() => ({
    borderColor: withTiming(
      error ? colors.error : isFocused.value ? colors.primary[500] : colors.border,
      { duration: DURATION.instant }
    ),
    borderWidth: withTiming(isFocused.value ? 2 : 1.5, { duration: DURATION.instant }),
  }));

  return (
    <View style={inputStyles.wrapper} testID={testID}>
      {label && (
        <Text style={inputStyles.label}>
          {label}
          {required && <Text style={inputStyles.required}> *</Text>}
        </Text>
      )}

      <Animated.View style={[inputStyles.inputContainer, borderAnimStyle]}>
        {leftIcon && <View style={inputStyles.leftIcon}>{leftIcon}</View>}
        <TextInput
          onFocus={() => { isFocused.value = 1; }}
          onBlur={() => { isFocused.value = 0; }}
          style={[inputStyles.input, leftIcon ? inputStyles.inputWithIcon : undefined]}
          placeholderTextColor={colors.textDisabled}
          accessible
          accessibilityLabel={label}
          {...props}
        />
      </Animated.View>

      {error ? (
        <Text style={inputStyles.error}>{error}</Text>
      ) : hint ? (
        <Text style={inputStyles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children:   React.ReactNode;
  variant?:   'default' | 'elevated' | 'outlined' | 'success' | 'warning' | 'error';
  padding?:   number;
  style?:     ViewStyle | (ViewStyle | false | undefined)[];
  onPress?:   () => void;
  testID?:    string;
}

const CARD_VARIANTS: Record<string, { bg: string; border?: string; shadow?: object }> = {
  default:  { bg: colors.surface, shadow: shadows.sm },
  elevated: { bg: colors.surface, shadow: shadows.md },
  outlined: { bg: colors.surface, border: colors.border },
  success:  { bg: colors.primary[50], border: colors.primary[200], shadow: shadows.xs },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', shadow: shadows.xs },
  error:    { bg: colors.red[50], border: colors.red[500], shadow: shadows.xs },
};

export function Card({ children, variant = 'default', padding = spacing.md, style, onPress, testID }: CardProps) {
  const cv = CARD_VARIANTS[variant];
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (onPress) {
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.98, animation.spring.card); }}
          onPressOut={() => { scale.value = withSpring(1, animation.spring.card); }}
          onPress={onPress}
          testID={testID}
          accessible
          accessibilityRole="button"
          style={[
            styles.card,
            { backgroundColor: cv.bg, padding, borderColor: cv.border, borderWidth: cv.border ? 1.5 : 0 },
            cv.shadow,
            style,
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cv.bg, padding, borderColor: cv.border, borderWidth: cv.border ? 1.5 : 0 },
        cv.shadow,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

interface BadgeProps {
  label:     string;
  variant?:  BadgeVariant;
  size?:     'sm' | 'md';
  dot?:      boolean;
  testID?:   string;
}

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: colors.primary[50],  text: colors.primary[700], dot: colors.primary[500] },
  warning: { bg: '#FFFBEB',           text: '#92400E',           dot: colors.accent[500] },
  error:   { bg: colors.red[50],      text: colors.red[700],     dot: colors.red[500] },
  info:    { bg: '#EFF6FF',           text: '#1D4ED8',           dot: '#3B82F6' },
  neutral: { bg: colors.gray[100],    text: colors.gray[600],    dot: colors.gray[400] },
  primary: { bg: colors.primary[100], text: colors.primary[800], dot: colors.primary[600] },
};

export function Badge({ label, variant = 'neutral', size = 'md', dot = false, testID }: BadgeProps) {
  const bc = BADGE_COLORS[variant];
  return (
    <View
      style={[
        badgeStyles.base,
        { backgroundColor: bc.bg, paddingHorizontal: size === 'sm' ? 6 : 10 },
      ]}
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {dot && <View style={[badgeStyles.dot, { backgroundColor: bc.dot }]} />}
      <Text style={[
        badgeStyles.text,
        { color: bc.text, fontSize: size === 'sm' ? 11 : 12 },
      ]}>
        {label}
      </Text>
    </View>
  );
}

// ─── SkeletonLoader ───────────────────────────────────────────────────────────

interface SkeletonProps {
  width?:  number | `${number}%`;
  height?: number;
  radius?: number;
  style?:  ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: animation.duration.skeleton, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.5, 0.9]),
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.gray[200] },
        animStyle,
        style,
      ]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

export function SkeletonCard() {
  return (
    <Card>
      <Skeleton height={12} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={28} width="80%" style={{ marginBottom: 4 }} />
      <Skeleton height={12} width="40%" />
    </Card>
  );
}

// ─── TrustBadge ───────────────────────────────────────────────────────────────
// Nigerian fintech trust signals — NRS stamp, verified, encrypted

interface TrustBadgeProps {
  type:    'nrs_stamped' | 'verified' | 'encrypted' | 'pending' | 'overdue';
  label?:  string;
  compact?: boolean;
}

const TRUST_CONFIGS = {
  nrs_stamped: { emoji: '✅', label: 'NRS Stamped', bg: colors.primary[50],  text: colors.primary[700] },
  verified:    { emoji: '🔒', label: 'Verified',    bg: '#EFF6FF',           text: '#1D4ED8' },
  encrypted:   { emoji: '🔐', label: 'Encrypted',   bg: '#EFF6FF',           text: '#1D4ED8' },
  pending:     { emoji: '⏳', label: 'Pending NRS', bg: '#FFFBEB',           text: '#92400E' },
  overdue:     { emoji: '⚠️', label: 'Overdue',     bg: colors.red[50],      text: colors.red[700] },
};

export function TrustBadge({ type, label, compact = false }: TrustBadgeProps) {
  const cfg = TRUST_CONFIGS[type];
  return (
    <View style={[trustStyles.badge, { backgroundColor: cfg.bg }]}>
      {!compact && <Text style={trustStyles.emoji}>{cfg.emoji}</Text>}
      <Text style={[trustStyles.label, { color: cfg.text }]}>
        {label ?? cfg.label}
      </Text>
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  emoji:      string;
  title:      string;
  body:       string;
  action?:    { label: string; onPress: () => void };
  testID?:    string;
}

export function EmptyState({ emoji, title, body, action, testID }: EmptyStateProps) {
  return (
    <View style={emptyStyles.container} testID={testID}>
      <Text style={emptyStyles.emoji}>{emoji}</Text>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.body}>{body}</Text>
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          size="md"
          style={{ marginTop: spacing[4] }}
        />
      )}
    </View>
  );
}

// ─── DividerWithLabel ─────────────────────────────────────────────────────────

export function DividerWithLabel({ label }: { label: string }) {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.label}>{label}</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value:   number;  // 0–1
  color?:  string;
  height?: number;
  style?:  ViewStyle;
  animated?: boolean;
}

export function ProgressBar({
  value, color = colors.primary[500], height = 6, style, animated = true,
}: ProgressBarProps) {
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = animated
      ? withTiming(Math.min(1, Math.max(0, value)), { duration: DURATION.deliberate })
      : Math.min(1, Math.max(0, value));
  }, [value, animated]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      style={[{ height, backgroundColor: colors.gray[200], borderRadius: height }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View
        style={[
          { height, backgroundColor: color, borderRadius: height },
          barStyle,
        ]}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    paddingHorizontal: spacing[5],
    overflow: 'hidden',
  },
  fullWidth: { width: '100%' },
  buttonText: {
    letterSpacing: typography.letterSpacing.wide,
  },
  iconLeft:  { marginRight: spacing[2] },
  iconRight: { marginLeft: spacing[2] },
  card: {
    borderRadius: radii.card,
    overflow: 'hidden',
  },
});

const inputStyles = StyleSheet.create({
  wrapper:   { marginBottom: spacing[4] },
  label: {
    fontSize:     typography.sizes.sm,
    fontWeight:   typography.weights.medium,
    color:        colors.textSecondary,
    marginBottom: spacing[1.5],
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
  required:  { color: colors.error },
  inputContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   radii.input,
    backgroundColor: colors.gray[50],
    minHeight:      spacing.inputHeight,
    paddingHorizontal: spacing[3],
  },
  prefix: {
    fontSize:   typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color:      colors.naira,
    marginRight: spacing[2],
  },
  input: {
    flex:      1,
    fontSize:  typography.sizes.md,
    color:     colors.textPrimary,
    paddingVertical: Platform.select({ ios: 14, android: 12, default: 12 }),
  },
  monoFont: {
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }),
  },
  inputWithIcon: { paddingLeft: spacing[2] },
  leftIcon:      { marginRight: spacing[2] },
  error: {
    fontSize:  typography.sizes.xs,
    color:     colors.error,
    marginTop: spacing[1],
  },
  hint: {
    fontSize:  typography.sizes.xs,
    color:     colors.textMuted,
    marginTop: spacing[1],
  },
});

const badgeStyles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    paddingVertical: 3,
    borderRadius:   radii.badge,
  },
  dot: {
    width: 6, height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontWeight:    typography.weights.semibold,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase' as const,
  },
});

const trustStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: spacing[2.5],
    paddingVertical:   3,
    borderRadius:  radii.badge,
    alignSelf:     'flex-start',
  },
  emoji: { fontSize: 12, marginRight: 4 },
  label: {
    fontSize:   11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  emoji: { fontSize: 52, marginBottom: spacing[4] },
  title: {
    fontSize:     typography.sizes.xl,
    fontWeight:   typography.weights.bold,
    color:        colors.textPrimary,
    textAlign:    'center',
    marginBottom: spacing[2],
  },
  body: {
    fontSize:  typography.sizes.base,
    color:     colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
  },
});

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    marginVertical: spacing[4],
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  label: {
    fontSize:   typography.sizes.xs,
    color:      colors.textMuted,
    marginHorizontal: spacing[3],
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wider,
  },
});
