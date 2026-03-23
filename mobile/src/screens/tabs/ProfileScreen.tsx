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
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import ActiveSettingsScreen from '../SettingsScreen';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCurrentUser, useAuthStore } from '../../store/authStore';
import { Card, Badge, TrustBadge, Button } from '../../design-system/components';
import { colors, typography, spacing, radii, shadows } from '../../design-system/tokens';
import { DURATION } from '../../design-system/animation';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  return <ActiveSettingsScreen />;
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
