/**
 * TeamManagementScreen — TaxBridge V13 Sovereign
 *
 * Role assignment with:
 *   - Last-OWNER guard: cannot demote/remove sole OWNER
 *   - role_version increment on role change (backend-enforced)
 *   - ROLE_HIERARCHY from @taxbridge/contracts
 *   - FlashList (C-47)
 *   - WCAG 2.2 AA
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { apiClient } from '../../services/apiClient';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../design-system/tokens';
import { ROLE_HIERARCHY, hasMinRole } from '@taxbridge/contracts';
import { SectionState } from '../../components/shared/SectionState';

type Role = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'EMPLOYEE' | 'VIEWER';

interface TeamMember {
  id:        string;
  userId:    string;
  name:      string;
  email:     string;
  role:      Role;
  joinedAt:  string;
  isActive:  boolean;
}

const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'ACCOUNTANT', 'EMPLOYEE', 'VIEWER'];

const ROLE_COLORS: Record<Role, string> = {
  OWNER:      '#059669',
  ADMIN:      '#2563EB',
  ACCOUNTANT: '#7C3AED',
  EMPLOYEE:   '#6B7280',
  VIEWER:     '#9CA3AF',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function TeamManagementScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();

  const [members,    setMembers]    = useState<TeamMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [updating,   setUpdating]   = useState<string | null>(null);

  const ownerCount = useMemo(() => members.filter(m => m.role === 'OWNER').length, [members]);

  const fetchMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get('/team/members');
      setMembers(res.data?.members ?? []);
    } catch {
      setError(t('team.fetchError', 'Could not load team members.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleRoleChange = useCallback(async (member: TeamMember, newRole: Role) => {
    if (member.role === 'OWNER' && ownerCount <= 1) {
      Alert.alert(
        t('team.lastOwnerTitle', 'Cannot Change Role'),
        t('team.lastOwnerBody', 'This is the only OWNER. Transfer ownership first before changing this role.'),
      );
      return;
    }

    setUpdating(member.id);
    try {
      await apiClient.patch(`/team/members/${member.id}/role`, { role: newRole });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(
        t('team.roleUpdated', `${member.name} is now ${newRole}`),
      );
      await fetchMembers();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('team.roleErrorTitle', 'Role Update Failed'),
        err?.response?.data?.message ?? t('team.roleErrorBody', 'Could not update role. Try again.'),
      );
    } finally {
      setUpdating(null);
    }
  }, [ownerCount, t, fetchMembers]);

  const showRolePicker = useCallback((member: TeamMember) => {
    if (member.role === 'OWNER' && ownerCount <= 1) {
      Alert.alert(
        t('team.lastOwnerTitle', 'Cannot Change Role'),
        t('team.lastOwnerBody', 'This is the only OWNER. Transfer ownership first.'),
      );
      return;
    }

    const options = ASSIGNABLE_ROLES.filter(r => r !== member.role).map(r => ({
      text: r,
      onPress: () => handleRoleChange(member, r),
    }));
    options.push({ text: t('common.cancel', 'Cancel'), onPress: () => {} });

    Alert.alert(
      t('team.changeRole', `Change role for ${member.name}`),
      t('team.currentRole', `Current role: ${member.role}`),
      options,
    );
  }, [ownerCount, t, handleRoleChange]);

  const handleRemoveMember = useCallback((member: TeamMember) => {
    if (member.role === 'OWNER' && ownerCount <= 1) {
      Alert.alert(
        t('team.lastOwnerTitle', 'Cannot Remove'),
        t('team.lastOwnerRemoveBody', 'Cannot remove the only OWNER from the team.'),
      );
      return;
    }

    Alert.alert(
      t('team.removeTitle', 'Remove Team Member'),
      t('team.removeBody', `Are you sure you want to remove ${member.name}?`),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            setUpdating(member.id);
            try {
              await apiClient.delete(`/team/members/${member.id}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await fetchMembers();
            } catch {
              Alert.alert(t('team.removeError', 'Could not remove member.'));
            } finally {
              setUpdating(null);
            }
          },
        },
      ],
    );
  }, [ownerCount, t, fetchMembers]);

  const renderItem = useCallback(({ item }: { item: TeamMember }) => {
    const isUpdating = updating === item.id;
    const roleColor = ROLE_COLORS[item.role] ?? COLORS.primary;

    return (
      <Animated.View entering={FadeInDown.duration(200)}>
        <View
          style={[s.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <View style={s.memberInfo}>
            <View style={[s.avatar, { backgroundColor: roleColor + '20' }]}>
              <Text style={[s.avatarText, { color: roleColor }]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.memberDetails}>
              <Text style={[s.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[s.memberEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
              <Text style={[s.memberJoined, { color: colors.textMuted }]}>
                {t('team.joined', 'Joined')} {formatDate(item.joinedAt)}
              </Text>
            </View>
          </View>

          <View style={s.memberActions}>
            <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
              <Text style={[s.roleText, { color: roleColor }]}>{item.role}</Text>
            </View>
            <View style={s.actionRow}>
              <Pressable
                onPress={() => showRolePicker(item)}
                disabled={isUpdating}
                style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel={t('team.changeRoleLabel', `Change role for ${item.name}`)}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={[s.actionText, { color: COLORS.primary }]}>
                      {t('team.editRole', 'Edit')}
                    </Text>
                }
              </Pressable>
              {item.role !== 'OWNER' && (
                <Pressable
                  onPress={() => handleRemoveMember(item)}
                  disabled={isUpdating}
                  style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('team.removeLabel', `Remove ${item.name}`)}
                >
                  <Text style={[s.actionText, { color: COLORS.danger }]}>
                    {t('team.remove', 'Remove')}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }, [colors, updating, showRolePicker, handleRemoveMember, t]);

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Text style={[s.title, { color: colors.textPrimary }]}>
          {t('team.title', 'Team Management')}
        </Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          {t('team.subtitle', `${members.length} members · Role changes take effect immediately`)}
        </Text>
      </Animated.View>

      <SectionState
        loading={loading}
        error={error ? new Error(error) : null}
        empty={members.length === 0 ? undefined : null}
        onRetry={() => fetchMembers()}
      >
        <FlashList
          data={members}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={120}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchMembers(true)} />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
                {t('team.emptyTitle', 'No Team Members')}
              </Text>
              <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
                {t('team.emptyBody', 'Invite team members to collaborate on filings.')}
              </Text>
            </View>
          }
        />
      </SectionState>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  header:   { padding: SPACING[24], paddingBottom: SPACING[16] },
  title:    { fontSize: TYPOGRAPHY['2xl'], fontWeight: '700', marginBottom: SPACING[4] },
  subtitle: { fontSize: TYPOGRAPHY.sm, lineHeight: 20 },

  list: { paddingHorizontal: SPACING[16], paddingBottom: SPACING[32] },

  memberCard: {
    borderRadius:  RADIUS.lg,
    borderWidth:   1,
    padding:       SPACING[16],
    marginBottom:  SPACING[12],
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING[12],
    marginBottom:  SPACING[12],
  },
  avatar: {
    width:          44,
    height:         44,
    borderRadius:   22,
    justifyContent: 'center',
    alignItems:     'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.lg, fontWeight: '700' },
  memberDetails: { flex: 1 },
  memberName:    { fontSize: TYPOGRAPHY.base, fontWeight: '600', marginBottom: 2 },
  memberEmail:   { fontSize: TYPOGRAPHY.xs, marginBottom: 2 },
  memberJoined:  { fontSize: TYPOGRAPHY.xs },

  memberActions: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  roleBadge: {
    paddingHorizontal: SPACING[10],
    paddingVertical:   SPACING[4],
    borderRadius:      RADIUS.full,
  },
  roleText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  actionRow: { flexDirection: 'row', gap: SPACING[12] },
  actionBtn: {
    paddingVertical:   SPACING[6],
    paddingHorizontal: SPACING[12],
    minWidth:  44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems:     'center',
  },
  actionText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: SPACING[48] },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING[16] },
  emptyTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '600', marginBottom: SPACING[8] },
  emptyBody:  { fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingHorizontal: SPACING[32], lineHeight: 20 },
});
