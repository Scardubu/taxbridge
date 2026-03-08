/**
 * DocumentVaultScreen — TaxBridge V13 Sovereign
 *
 * Secure document storage viewer with:
 *   - R2 signed URL download via backend proxy
 *   - AES-256-GCM encryption indicator per document
 *   - Audit trail on every download
 *   - FlashList for performance (C-47)
 *   - WCAG 2.2 AA compliant
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { apiClient } from '../../services/apiClient';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../design-system/tokens';

interface VaultDocument {
  id:          string;
  name:        string;
  type:        'TAX_RETURN' | 'RECEIPT' | 'INVOICE' | 'CAC' | 'TIN' | 'OTHER';
  size:        number;
  encrypted:   boolean;
  uploadedAt:  string;
  uploadedBy:  string;
}

const TYPE_LABELS: Record<string, string> = {
  TAX_RETURN: 'Tax Return',
  RECEIPT:    'Receipt',
  INVOICE:    'Invoice',
  CAC:        'CAC Certificate',
  TIN:        'TIN Certificate',
  OTHER:      'Document',
};

const TYPE_ICONS: Record<string, string> = {
  TAX_RETURN: '📄',
  RECEIPT:    '🧾',
  INVOICE:    '📑',
  CAC:        '🏢',
  TIN:        '🔢',
  OTHER:      '📋',
};

const TYPE_SCALE = TYPOGRAPHY.sizes;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function DocumentVaultScreen() {
  const { t }        = useTranslation();
  const { colors }   = useTheme();

  const [documents,  setDocuments]  = useState<VaultDocument[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchDocuments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get('/documents/vault');
      setDocuments(res.data?.documents ?? []);
    } catch {
      setError(t('vault.fetchError', 'Could not load documents.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const handleDownload = useCallback(async (doc: VaultDocument) => {
    Haptics.selectionAsync();
    try {
      const res = await apiClient.post(`/documents/${doc.id}/download`);
      const signedUrl = res.data?.url;
      if (!signedUrl) throw new Error('No URL returned');

      await Linking.openURL(signedUrl);

      AccessibilityInfo.announceForAccessibility(
        t('vault.downloading', `Downloading ${doc.name}`),
      );
    } catch {
      Alert.alert(
        t('vault.downloadErrorTitle', 'Download Failed'),
        t('vault.downloadErrorBody', 'Could not generate download link. Try again.'),
      );
    }
  }, [t]);

  const renderItem = useCallback(({ item }: { item: VaultDocument }) => (
    <Pressable
      onPress={() => handleDownload(item)}
      style={({ pressed }) => [
        s.docCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${TYPE_LABELS[item.type] ?? 'Document'}, ${formatFileSize(item.size)}`}
    >
      <Text style={s.docIcon}>{TYPE_ICONS[item.type] ?? '📋'}</Text>
      <View style={s.docInfo}>
        <Text style={[s.docName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[s.docMeta, { color: colors.textSecondary }]}>
          {TYPE_LABELS[item.type] ?? 'Document'} · {formatFileSize(item.size)} · {formatDate(item.uploadedAt)}
        </Text>
      </View>
      {item.encrypted && (
        <View
          style={s.encBadge}
          accessibilityLabel={t('vault.encrypted', 'AES-256-GCM encrypted')}
        >
          <Text style={s.encBadgeText}>🔒</Text>
        </View>
      )}
    </Pressable>
  ), [colors, handleDownload, t]);

  return (
    <View style={[s.root, { backgroundColor: colors.surface }]}>
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <Text style={[s.title, { color: colors.textPrimary }]}>
          {t('vault.title', 'Document Vault')}
        </Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          {t('vault.subtitle', 'All documents encrypted with AES-256-GCM at rest.')}
        </Text>
      </Animated.View>

      {loading ? (
        <View style={s.loadingState}>
          <ActivityIndicator color={COLORS.primary[500]} size="large" />
        </View>
      ) : error ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>⚠️</Text>
          <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
            {t('vault.fetchErrorTitle', 'Could not load documents')}
          </Text>
          <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <Pressable
            onPress={() => fetchDocuments()}
            style={({ pressed }) => [s.retryButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.retryButtonText}>{t('common.tryAgain', 'Try Again')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={documents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchDocuments(true)} />
          }
          ListEmptyComponent={() => (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>📂</Text>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>
                {t('vault.emptyTitle', 'No Documents Yet')}
              </Text>
              <Text style={[s.emptyBody, { color: colors.textSecondary }]}>
                {t('vault.emptyBody', 'Filed tax returns and uploaded documents will appear here.')}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1 },
  header:   { padding: SPACING[24], paddingBottom: SPACING[16] },
  title:    { fontSize: TYPE_SCALE['2xl'], fontWeight: '700', marginBottom: SPACING[4] },
  subtitle: { fontSize: TYPE_SCALE.sm, lineHeight: 20 },

  list: { paddingHorizontal: SPACING[16], paddingBottom: SPACING[32] },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: SPACING[32] },

  docCard: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       SPACING[16],
    borderRadius:  RADIUS.md,
    borderWidth:   1,
    marginBottom:  SPACING[8],
    gap:           SPACING[12],
  },
  docIcon: { fontSize: TYPE_SCALE.xl },
  docInfo: { flex: 1 },
  docName: { fontSize: TYPE_SCALE.base, fontWeight: '600', marginBottom: SPACING[2] },
  docMeta: { fontSize: TYPE_SCALE.xs },

  encBadge:     { paddingHorizontal: SPACING[6], paddingVertical: SPACING[2], borderRadius: RADIUS.sm, backgroundColor: '#D1FAE5' },
  encBadgeText: { fontSize: TYPE_SCALE.xs },

  emptyState: { alignItems: 'center', paddingVertical: SPACING[12] * 4 },
  emptyIcon:  { fontSize: 48, marginBottom: SPACING[16] },
  emptyTitle: { fontSize: TYPE_SCALE.lg, fontWeight: '600', marginBottom: SPACING[8] },
  emptyBody:  { fontSize: TYPE_SCALE.sm, textAlign: 'center', paddingHorizontal: SPACING[32], lineHeight: 20 },
  retryButton: {
    marginTop: SPACING[16],
    backgroundColor: COLORS.primary[500],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING[16],
    paddingVertical: SPACING[10],
  },
  retryButtonText: { color: '#fff', fontSize: TYPE_SCALE.sm, fontWeight: '600' },
});
