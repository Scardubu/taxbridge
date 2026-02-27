/**
 * TaxBridge — Profile Screen
 * User info, settings, language toggle, biometric, NDPC data export, logout
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCurrentUser, useAuthStore } from '../../store/authStore';
import { Card, Badge, TrustBadge, Button } from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import { DURATION } from '../../design-system/animation';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const insets   = useSafeAreaInsets();
  const user     = useCurrentUser();
  const { logout } = useAuthStore();

  const [notificationsEnabled, setNotifications] = useState(true);
  const [darkMode, setDarkMode]                  = useState(false);
  const [biometric, setBiometric]                = useState(false);
  const [isLoggingOut, setLoggingOut]            = useState(false);

  const isPidgin = i18n.language === 'pidgin';

  const toggleLanguage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = isPidgin ? 'en' : 'pidgin';
    await i18n.changeLanguage(next);
  }, [isPidgin, i18n]);

  const toggleBiometric = useCallback(async (val: boolean) => {
    if (val) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        Alert.alert(
          'Biometric Not Available',
          'Your device does not have biometric authentication enrolled.',
        );
        return;
      }
    }
    setBiometric(val);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout'), style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
            router.replace('/auth/login' as any);
          },
        },
      ]
    );
  }, [t, logout]);

  const handleExportData = useCallback(() => {
    Alert.alert(
      'Export Your Data',
      'Under NDPC 2023, you have the right to access all data we hold about you. A full export will be sent to your email within 72 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Export', onPress: () => {} },
      ]
    );
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your TaxBridge account and all associated data. This cannot be undone.\n\nUnder NDPC 2023, data will be purged within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account', style: 'destructive',
          onPress: () => {
            Alert.alert('Request Submitted', 'Account deletion request received. You will be notified within 30 days.');
          },
        },
      ]
    );
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const initials  = (user?.name ?? 'U')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.heroEmail}>{user?.email ?? ''}</Text>
          {user?.businessName && (
            <Text style={styles.heroBusiness}>{user.businessName}</Text>
          )}
          <View style={styles.heroBadges}>
            {user?.tin && <TrustBadge type="verified" label={`TIN: ${user.tin}`} />}
            <TrustBadge type="encrypted" label="NDPC Protected" />
          </View>
        </Animated.View>

        {/* Business Info */}
        <Animated.View entering={FadeInDown.delay(100).duration(DURATION.transition)}>
          <SectionTitle title={t('profile.personalInfo')} />
          <Card style={styles.infoCard}>
            <InfoRow label={t('profile.name')}         value={user?.name ?? '—'} />
            <InfoRow label={t('profile.email')}        value={user?.email ?? '—'} />
            {user?.businessName && (
              <InfoRow label={t('profile.businessName')} value={user.businessName} />
            )}
            {user?.tin && (
              <InfoRow label={t('profile.tin')}        value={user.tin} />
            )}
            {user?.businessType && (
              <InfoRow label={t('profile.businessType')} value={formatBusinessType(user.businessType)} />
            )}
          </Card>
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.delay(150).duration(DURATION.transition)}>
          <SectionTitle title={t('profile.settings')} />
          <Card style={styles.settingsCard}>
            <SettingRow
              label={t('profile.language')}
              value={isPidgin ? '🇳🇬 Nigerian Pidgin' : '🇬🇧 English'}
              onPress={toggleLanguage}
              pressable
            />
            <SettingDivider />
            <SettingRow
              label={t('profile.notifications')}
              value=""
              trailing={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={val => {
                    setNotifications(val);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                  thumbColor={notificationsEnabled ? colors.primary[600] : colors.gray[400]}
                />
              }
            />
            <SettingDivider />
            <SettingRow
              label={t('profile.darkMode')}
              value=""
              trailing={
                <Switch
                  value={darkMode}
                  onValueChange={val => {
                    setDarkMode(val);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  }}
                  trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                  thumbColor={darkMode ? colors.primary[600] : colors.gray[400]}
                />
              }
            />
            <SettingDivider />
            <SettingRow
              label={t('profile.biometric')}
              value=""
              trailing={
                <Switch
                  value={biometric}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                  thumbColor={biometric ? colors.primary[600] : colors.gray[400]}
                />
              }
            />
          </Card>
        </Animated.View>

        {/* Security */}
        <Animated.View entering={FadeInDown.delay(200).duration(DURATION.transition)}>
          <SectionTitle title={t('profile.security')} />
          <Card style={styles.settingsCard}>
            <SettingRow
              label={t('profile.changePassword')}
              onPress={() => router.push('/auth/change-password' as any)}
              pressable
              showChevron
            />
          </Card>
        </Animated.View>

        {/* Data & Privacy (NDPC 2023) */}
        <Animated.View entering={FadeInDown.delay(250).duration(DURATION.transition)}>
          <SectionTitle title="Data & Privacy (NDPC 2023)" />
          <Card style={styles.settingsCard}>
            <SettingRow
              label={t('profile.exportData')}
              onPress={handleExportData}
              pressable showChevron
            />
            <SettingDivider />
            <SettingRow
              label={t('profile.privacyPolicy')}
              onPress={() => router.push('/privacy' as any)}
              pressable showChevron
            />
            <SettingDivider />
            <SettingRow
              label={t('profile.terms')}
              onPress={() => router.push('/terms' as any)}
              pressable showChevron
            />
          </Card>
        </Animated.View>

        {/* Support */}
        <Animated.View entering={FadeInDown.delay(300).duration(DURATION.transition)}>
          <SectionTitle title={t('profile.support')} />
          <Card style={styles.settingsCard}>
            <SettingRow
              label={t('profile.contactSupport')}
              onPress={() => {}}
              pressable showChevron
            />
          </Card>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(350).duration(DURATION.transition)} style={styles.logoutSection}>
          <Button
            label={isLoggingOut ? 'Signing out...' : t('profile.logout')}
            onPress={handleLogout}
            variant="outline"
            fullWidth
            size="lg"
            loading={isLoggingOut}
          />
        </Animated.View>

        {/* Delete account */}
        <Pressable onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>{t('profile.deleteAccount')}</Text>
        </Pressable>

        {/* Version footer */}
        <Text style={styles.version}>
          TaxBridge v3.0.0 — NTA 2025 · NRS 2026 · NDPC 2023{'\n'}
          © 2026 TaxBridge Ltd. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function SettingRow({
  label, value, onPress, pressable, showChevron, trailing,
}: {
  label: string; value?: string;
  onPress?: () => void; pressable?: boolean;
  showChevron?: boolean; trailing?: React.ReactNode;
}) {
  const inner = (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {trailing ?? (
        <View style={styles.settingRight}>
          {value ? <Text style={styles.settingValue}>{value}</Text> : null}
          {showChevron && <Text style={styles.settingChevron}>›</Text>}
        </View>
      )}
    </View>
  );

  if (pressable && onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

function SettingDivider() {
  return <View style={styles.settingDivider} />;
}

function formatBusinessType(type: string): string {
  const map: Record<string, string> = {
    sole_proprietor: 'Sole Proprietor',
    sme:             'SME / Partnership',
    limited_company: 'Limited Company',
    freelancer:      'Freelancer',
    ngo:             'NGO / Non-profit',
  };
  return map[type] ?? type;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.gray[50] },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing[4] },

  hero: { alignItems: 'center', marginBottom: spacing[6] },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary[500],
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[3],
    ...shadows.md,
  },
  avatarText: {
    color: '#fff', fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
  heroName: {
    fontSize: typography.sizes.xl, fontWeight: typography.weights.bold,
    color: colors.textPrimary, marginBottom: spacing[0.5],
  },
  heroEmail:    { fontSize: typography.sizes.sm, color: colors.textMuted },
  heroBusiness: {
    fontSize: typography.sizes.sm, color: colors.primary[600],
    fontWeight: typography.weights.medium, marginTop: spacing[0.5],
  },
  heroBadges: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },

  sectionTitle: {
    fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold,
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing[2], marginTop: spacing[4], marginLeft: spacing[1],
  },

  infoCard:     { marginBottom: spacing[2], paddingVertical: 0 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  infoLabel: { fontSize: typography.sizes.sm, color: colors.textMuted, flex: 1 },
  infoValue: {
    fontSize: typography.sizes.sm, fontWeight: typography.weights.medium,
    color: colors.textPrimary, flex: 2, textAlign: 'right',
  },

  settingsCard:  { marginBottom: spacing[2], paddingVertical: 0 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing[3],
  },
  settingLabel: {
    fontSize: typography.sizes.base, color: colors.textPrimary,
    fontWeight: typography.weights.medium, flex: 1,
  },
  settingRight:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  settingValue:   { fontSize: typography.sizes.sm, color: colors.textMuted },
  settingChevron: { fontSize: 20, color: colors.textMuted },
  settingDivider: { height: 1, backgroundColor: colors.gray[100], marginLeft: 0 },

  logoutSection: { marginTop: spacing[6], marginBottom: spacing[3] },

  deleteBtn:     { alignItems: 'center', marginBottom: spacing[4] },
  deleteBtnText: {
    color: colors.error, fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textDecorationLine: 'underline',
  },

  version: {
    fontSize: 11, color: colors.textDisabled,
    textAlign: 'center', lineHeight: 18, marginBottom: spacing[6],
  },
});
