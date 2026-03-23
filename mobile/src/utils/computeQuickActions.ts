/**
 * TaxBridge — computeQuickActions
 * P1-E — Context-driven quick actions ordering
 *
 * Constraints:
 *   C-09  Tax logic / ordering only in packages/contracts or utils — never inline
 *   C-06  All label keys map to i18n (en + pidgin)
 *   NRS threshold ₦200,000 per C-10 (used in pendingNrs urgency)
 *
 * Usage:
 *   const actions = computeQuickActions(data);
 *   actions.map(a => <QuickAction key={a.id} {...a} />)
 */

import type { DashboardComposite } from '@api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickActionDef {
  /** Stable identifier for key prop and deduplication */
  id: string;
  /** Emoji glyph rendered in the action button */
  emoji: string;
  /** i18n key — must exist in both en.json + pidgin.json under `dashboard.*` */
  labelKey: string;
  /** Navigation route passed to router.push */
  route: string;
  /**
   * Accent color identifier.
   * Starts with '#' → literal hex.
   * Otherwise → key of ColorTokens (resolved by caller via `colors[accentColorKey]`).
   */
  accentColorKey: string;
  /** When true, render with "!" badge to communicate urgency to the user */
  urgent: boolean;
}

// ─── Base action catalog ──────────────────────────────────────────────────────

const BASE_ACTIONS: Omit<QuickActionDef, 'urgent'>[] = [
  { id: 'new-invoice',     emoji: '🧾', labelKey: 'dashboard.newInvoice',    route: 'Create',     accentColorKey: 'primary'            },
  { id: 'scan-receipt',    emoji: '📷', labelKey: 'dashboard.scanReceipt',   route: 'Create',     accentColorKey: 'actionOrangeAccent' },
  { id: 'tax-calculator',  emoji: '🧮', labelKey: 'dashboard.taxCalculator', route: 'TaxGuide',   accentColorKey: 'info'               },
  { id: 'pay-tax',         emoji: '💳', labelKey: 'dashboard.payTax',        route: 'Payment',    accentColorKey: 'primaryDark'        },
  { id: 'expenses',        emoji: '📊', labelKey: 'dashboard.expenses',      route: 'Invoices',   accentColorKey: 'error'              },
  { id: 'learn',           emoji: '🎓', labelKey: 'dashboard.learn',         route: 'TaxGuide',   accentColorKey: '#8B5CF6'            },
];

// ─── computeQuickActions ──────────────────────────────────────────────────────

/**
 * Returns up to 6 quick actions, sorted by contextual urgency.
 *
 * Urgency rules (evaluated in priority order):
 *  1. pendingNrs > 0          → new-invoice first (NRS overdue)
 *  2. vatLiability > 0        → pay-tax second
 *  3. overdue deadline exists → tax-calculator third
 *  4. nextDeadline ≤ 7 days   → tax-calculator promoted
 *  5. recentAnomalies > 0     → scan-receipt promoted (review expenses)
 */
export function computeQuickActions(
  data: DashboardComposite | undefined,
): QuickActionDef[] {
  const stats     = data?.stats;
  const deadlines = data?.upcomingDeadlines ?? [];

  // ── Derive urgency signals ────────────────────────────────────────────────
  const hasPendingNrs  = (stats?.pendingNrs   ?? 0) > 0;
  const hasVatLiab     = (stats?.vatLiability ?? 0) > 0;
  const hasOverdue     = deadlines.some((d) => d.status === 'overdue');
  const hasUrgentDeadline = !hasOverdue
    && ((stats?.nextDeadline?.daysRemaining ?? Infinity) <= 7
    ||  deadlines.some((d) => d.daysRemaining <= 7 && d.status !== 'overdue'));
  const hasAnomalies   = (stats?.recentAnomalies ?? 0) > 0;

  // ── Assignment of urgency and priority score ──────────────────────────────
  const priorities: Record<string, number> = {
    'new-invoice':    hasPendingNrs                       ? 100 : 50,
    'pay-tax':        hasVatLiab                          ? 95  : 40,
    'tax-calculator': (hasOverdue || hasUrgentDeadline)   ? 90  : 35,
    'scan-receipt':   hasAnomalies                        ? 70  : 45,
    'expenses':       30,
    'learn':          10,
  };

  const urgent: Record<string, boolean> = {
    'new-invoice':    hasPendingNrs,
    'pay-tax':        hasVatLiab,
    'tax-calculator': hasOverdue || hasUrgentDeadline,
    'scan-receipt':   hasAnomalies,
    'expenses':       false,
    'learn':          false,
  };

  // ── Sort by priority (desc) and attach urgent flag ────────────────────────
  return [...BASE_ACTIONS]
    .sort((a, b) => (priorities[b.id] ?? 0) - (priorities[a.id] ?? 0))
    .map((action) => ({ ...action, urgent: urgent[action.id] ?? false }))
    .slice(0, 6);
}
