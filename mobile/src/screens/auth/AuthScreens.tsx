/**
 * TaxBridge Auth Screens — Login + Register
 * Elite fintech auth: trust signals, field validation, animated feedback
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet, Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import {
  Button, TextInputField, DividerWithLabel,
} from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';

// ─── Simple validators ────────────────────────────────────────────────────────

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address';
}
function validatePassword(v: string) {
  return v.length >= 8 ? null : 'Password must be at least 8 characters';
}
function validateName(v: string) {
  return v.trim().length >= 2 ? null : 'Enter your full name';
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

export function LoginScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { login, status, error, clearError } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched]   = useState({ email: false, password: false });
  const [showPass, setShowPass] = useState(false);

  const emailError    = touched.email    ? validateEmail(email)       : null;
  const passwordError = touched.password ? validatePassword(password)  : null;
  const isValid       = !emailError && !passwordError && email && password;
  const isLoading     = status === 'loading';

  const handleLogin = useCallback(async () => {
    setTouched({ email: true, password: true });
    if (!isValid) return;
    clearError();
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch {
      // Error displayed via store.error
    }
  }, [isValid, email, password, login, clearError]);

  return (
    <KeyboardAvoidingView
      style={styles.kbRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Brand */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>🌉</Text>
          </View>
          <Text style={styles.appName}>TaxBridge</Text>
          <Text style={styles.appTagline}>{t('auth.tagline')}</Text>
        </Animated.View>

        {/* Trust Signals */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.trustRow}>
          <TrustPill emoji="🔒" label={t('auth.trust.encrypted')} />
          <TrustPill emoji="🇳🇬" label="NTA 2025" />
          <TrustPill emoji="✅" label="NRS 2026" />
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.cardSubtitle}>{t('auth.loginToAccount')}</Text>

          {/* Server error */}
          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {error}</Text>
            </Animated.View>
          )}

          <TextInputField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            error={emailError ?? undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@business.ng"
            required
            testID="login-email"
          />

          <TextInputField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            onBlur={() => setTouched(t => ({ ...t, password: true }))}
            error={passwordError ?? undefined}
            secureTextEntry={!showPass}
            autoComplete="current-password"
            textContentType="password"
            placeholder="••••••••"
            required
            testID="login-password"
          />

          <Pressable
            onPress={() => setShowPass(v => !v)}
            style={styles.showPass}
            accessibilityRole="button"
            accessibilityLabel={showPass ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            <Text style={styles.showPassText}>
              {showPass ? t('auth.hidePassword') : t('auth.showPassword')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/auth/forgot-password')}
            style={styles.forgotLink}
            accessibilityRole="link"
          >
            <Text style={styles.forgotLinkText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <Button
            label={isLoading ? t('common.loading') : t('auth.login')}
            onPress={handleLogin}
            loading={isLoading}
            disabled={!isValid || isLoading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[2] }}
            testID="login-submit"
          />

          <DividerWithLabel label={t('common.or')} />

          <Pressable
            onPress={() => router.push('/auth/register')}
            style={styles.switchLink}
            accessibilityRole="link"
          >
            <Text style={styles.switchLinkText}>
              {t('auth.noAccount')}{' '}
              <Text style={styles.switchLinkHighlight}>{t('auth.createAccount')}</Text>
            </Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.ndpcNotice')}</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Register Screen ──────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'sme',             label: 'SME / Partnership' },
  { value: 'limited_company', label: 'Limited Company' },
  { value: 'freelancer',      label: 'Freelancer' },
  { value: 'ngo',             label: 'NGO / Non-profit' },
];

export function RegisterScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { register, status, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    businessName: '', businessType: '', tin: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPass, setShowPass] = useState(false);

  const set = (k: string) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    clearError();
  };
  const touch = (k: string) => () => setTouched(t => ({ ...t, [k]: true }));

  const errors = {
    name:     touched.name     ? validateName(form.name)         : null,
    email:    touched.email    ? validateEmail(form.email)        : null,
    password: touched.password ? validatePassword(form.password)  : null,
  };

  const isValid = !Object.values(errors).some(Boolean) &&
    form.name && form.email && form.password;
  const isLoading = status === 'loading';

  const handleRegister = useCallback(async () => {
    setTouched({ name: true, email: true, password: true });
    if (!isValid) return;
    clearError();
    try {
      await register({
        name:         form.name.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
        businessName: form.businessName.trim() || undefined,
        businessType: form.businessType || undefined,
        tin:          form.tin.trim() || undefined,
      });
      router.replace('/(tabs)');
    } catch {}
  }, [isValid, form, register, clearError]);

  return (
    <KeyboardAvoidingView
      style={styles.kbRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>🌉</Text>
          </View>
          <Text style={styles.appName}>TaxBridge</Text>
          <Text style={styles.appTagline}>{t('auth.joinNigeria')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('auth.createAccount')}</Text>
          <Text style={styles.cardSubtitle}>{t('auth.startCompliance')}</Text>

          {error && (
            <Animated.View entering={FadeIn} style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {error}</Text>
            </Animated.View>
          )}

          <TextInputField
            label={t('auth.fullName')}
            value={form.name}
            onChangeText={set('name')}
            onBlur={touch('name')}
            error={errors.name ?? undefined}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder={t('auth.namePlaceholder')}
            required
          />

          <TextInputField
            label={t('auth.email')}
            value={form.email}
            onChangeText={set('email')}
            onBlur={touch('email')}
            error={errors.email ?? undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@business.ng"
            required
          />

          <TextInputField
            label={t('auth.password')}
            value={form.password}
            onChangeText={set('password')}
            onBlur={touch('password')}
            error={errors.password ?? undefined}
            secureTextEntry={!showPass}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="••••••••"
            required
          />

          <Pressable
            onPress={() => setShowPass(v => !v)}
            style={styles.showPass}
            accessibilityRole="button"
          >
            <Text style={styles.showPassText}>
              {showPass ? t('auth.hidePassword') : t('auth.showPassword')}
            </Text>
          </Pressable>

          <DividerWithLabel label={t('auth.businessOptional')} />

          <TextInputField
            label={t('auth.businessName')}
            value={form.businessName}
            onChangeText={set('businessName')}
            placeholder={t('auth.businessNamePlaceholder')}
          />

          <TextInputField
            label={`${t('auth.tin')} (${t('common.optional')})`}
            value={form.tin}
            onChangeText={set('tin')}
            keyboardType="numeric"
            placeholder="1234567890"
            hint={t('auth.tinHint')}
          />

          {/* Business type selector */}
          <Text style={styles.bTypeLabel}>{t('auth.businessType')}</Text>
          <View style={styles.bTypeRow}>
            {BUSINESS_TYPES.map(type => (
              <Pressable
                key={type.value}
                onPress={() => set('businessType')(type.value)}
                style={[
                  styles.bTypeChip,
                  form.businessType === type.value && styles.bTypeChipSelected,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: form.businessType === type.value }}
              >
                <Text style={[
                  styles.bTypeChipText,
                  form.businessType === type.value && styles.bTypeChipTextSelected,
                ]}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Button
            label={isLoading ? t('common.loading') : t('auth.createAccount')}
            onPress={handleRegister}
            loading={isLoading}
            disabled={!isValid || isLoading}
            fullWidth
            size="lg"
            style={{ marginTop: spacing[4] }}
          />

          <Pressable
            onPress={() => router.back()}
            style={styles.switchLink}
            accessibilityRole="link"
          >
            <Text style={styles.switchLinkText}>
              {t('auth.haveAccount')}{' '}
              <Text style={styles.switchLinkHighlight}>{t('auth.login')}</Text>
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300)} style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.termsNotice')}</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Shared Sub-components ────────────────────────────────────────────────────

function TrustPill({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.trustPill}>
      <Text style={styles.trustPillEmoji}>{emoji}</Text>
      <Text style={styles.trustPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kbRoot:    { flex: 1, backgroundColor: colors.gray[50] },
  scroll:    { flexGrow: 1, paddingHorizontal: spacing.screenPadding },

  brand:     { alignItems: 'center', marginBottom: spacing[6] },
  logoMark: {
    width: 72, height: 72, borderRadius: radii.xl,
    backgroundColor: colors.primary[500],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[3],
    ...shadows.md,
  },
  logoEmoji:   { fontSize: 36 },
  appName: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing[1],
    textAlign: 'center',
  },

  trustRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: spacing[2], marginBottom: spacing[5],
  },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary[50],
    borderRadius: radii.full,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
  },
  trustPillEmoji: { fontSize: 13 },
  trustPillLabel: {
    fontSize: 12, fontWeight: typography.weights.semibold,
    color: colors.primary[700],
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.modal,
    padding: spacing[5],
    ...shadows.lg,
    marginBottom: spacing[5],
  },
  cardTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing[5],
  },

  errorBanner: {
    backgroundColor: colors.red[50],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.red[500],
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  errorBannerText: {
    color: colors.red[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },

  showPass: { alignSelf: 'flex-end', marginTop: -spacing[2], marginBottom: spacing[1] },
  showPassText: {
    fontSize: typography.sizes.xs,
    color: colors.primary[600],
    fontWeight: typography.weights.medium,
  },

  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing[4] },
  forgotLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary[600],
    fontWeight: typography.weights.medium,
  },

  switchLink: { alignItems: 'center', marginTop: spacing[4] },
  switchLinkText: { fontSize: typography.sizes.sm, color: colors.textMuted },
  switchLinkHighlight: { color: colors.primary[600], fontWeight: typography.weights.semibold },

  bTypeLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing[2],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  bTypeChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  bTypeChipSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  bTypeChipText: { fontSize: typography.sizes.sm, color: colors.textMuted },
  bTypeChipTextSelected: { color: colors.primary[700], fontWeight: typography.weights.medium },

  footer: { alignItems: 'center', paddingHorizontal: spacing[4] },
  footerText: {
    fontSize: 11, color: colors.textDisabled,
    textAlign: 'center', lineHeight: 16,
  },
});
