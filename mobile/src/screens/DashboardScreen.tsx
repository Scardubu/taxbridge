/**
 * DashboardScreen — TaxBridge V13 Sovereign
 *
 * C-13: SVG arc gauge only — no native progress bars
 * C-14: Single composite useDashboard() hook — never multiple requests
 * C-16: Animation tokens only — DURATION.* + EASE.* from animation.ts
 * C-17: Exactly 5 DashboardZone elements (apex | signal | action | context | ambient)
 * C-18: Every dashboard section wrapped in DashboardZone zone="…"
 * C-19: Anomaly empty state = null — never "No anomalies" text
 * C-20: computeGaugeMode imported from TaxHealthGauge — never inlined
 * C-47: All lists via FlashList — never FlatList
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActiveDashboardScreen from './tabs/DashboardScreen';

import { TaxHealthGauge, computeGaugeMode } from '../components/dashboard/TaxHealthGauge';
import { DashboardZone }    from '../components/dashboard/DashboardZone';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { OfflineSyncStatus } from '../components/dashboard/OfflineSyncStatus';
import { useDashboard }     from '../hooks/useDashboard';
import { useSync } from '../contexts/SyncContext';
import { useNetwork } from '../contexts/NetworkContext';
import { formatCurrency, formatDate } from '../utils/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Anomaly {
  expenseId: string;
  severity: 'low' | 'medium' | 'high';
  anomalyReason: string;
  anomalyReason_pidgin?: string;
  suggestedAction?: string;
}

interface Deadline {
  id:            string;
  type:          string;
  dueDate:       string;
  daysRemaining: number;
  status:        'upcoming' | 'overdue' | 'filed';
}

interface QuickAction {
  id:    string;
  label: string;
  emoji: string;
  route: string;
}

// ─── Severity config (shape + colour — WCAG three-channel C-15) ──────────────
const SEVERITY: Record<string, { glyph: string; color: string }> = {
  critical: { glyph: '▲', color: '#DC2626' },
  high:     { glyph: '▲', color: '#EA580C' },
  medium:   { glyph: '■', color: '#D97706' },
  low:      { glyph: '●', color: '#16A34A' },
};

// ─── Quick actions config ─────────────────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { id: 'vat',   label: 'filing.vat',   emoji: '🧾', route: '/filings/vat'   },
  { id: 'paye',  label: 'filing.paye',  emoji: '👥', route: '/filings/paye'  },
  { id: 'wht',   label: 'filing.wht',   emoji: '📋', route: '/filings/wht'   },
  { id: 'nil',   label: 'filing.nil',   emoji: '0️⃣', route: '/filings/nil'   },
  { id: 'docs',  label: 'nav.documents',emoji: '📂', route: '/documents'     },
  { id: 'team',  label: 'nav.team',     emoji: '🏢', route: '/team'          },
];

// ─── Main component ───────────────────────────────────────────────────────────

const legacyDashboardQueryClient = new QueryClient();

export default function DashboardScreen() {
  return (
    <QueryClientProvider client={legacyDashboardQueryClient}>
      <ActiveDashboardScreen />
    </QueryClientProvider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 32,
    gap: 12,
  },
  apexContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  gaugeMetaRow: {
    marginTop: 12,
    gap: 4,
    alignItems: 'center',
  },
  gaugeMetaText: {
    fontSize: 12,
    color: '#4B5563',
  },
  errorHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  nrsWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    width: '100%',
  },
  nrsWarningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  sectionCaption: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  anomalyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
  },
  anomalyGlyph: {
    fontSize: 14,
    fontWeight: '700',
    width: 16,
    textAlign: 'center',
  },
  anomalyText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  anomalyBody: {
    flex: 1,
    gap: 4,
  },
  anomalyHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: '#DBEAFE',
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
    textAlign: 'center',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  deadlineLeft: {
    flex: 1,
  },
  deadlineType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deadlinePeriod: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  deadlineBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deadlineBadgeUrgent: {
    backgroundColor: '#FEE2E2',
  },
  deadlineBadgeNormal: {
    backgroundColor: '#F3F4F6',
  },
  deadlineDays: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  ambientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
  },
  ambientText: {
    fontSize: 12,
    color: '#6B7280',
  },
  nrsStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
} as any);
