'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AdminLanguage = 'en' | 'pidgin';

type Messages = Record<string, string>;

type I18nContextValue = {
  lang: AdminLanguage;
  setLang: (lang: AdminLanguage) => void;
  t: (key: string, vars?: Record<string, string | number | undefined>) => string;
};

const STORAGE_KEY = 'tb_admin_lang';

const messages: Record<AdminLanguage, Messages> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Invoices',
    'nav.analytics': 'Analytics',
    'nav.users': 'Users',
    'nav.compliance': 'Compliance',
    'nav.system': 'System',

    // Header
    'header.adminConsole': 'Admin Console',
    'header.timeZone': 'WAT',
    'header.language': 'Language',
    'header.language.en': 'English',
    'header.language.pidgin': 'Nigerian Pidgin',

    // Status banner
    'status.checking': 'Checking system health…',
    'status.unavailable': 'Health check unavailable',
    'status.healthy': 'All systems operational',
    'status.degraded': 'Performance degraded',
    'status.error': 'Service disruption',
    'status.unknown': 'System status unknown',
    'status.lastChecked': 'Last checked {time}',

    'integrations.digitax': 'DigiTax',
    'integrations.remita': 'Remita',
    'integrations.mockSuffix': ' [mock]',

    // Footer
    'footer.copyright': '© 2026 TaxBridge Nigeria. NRS 2026 compliant.',

    // Common
    'common.refresh': 'Refresh',
    'common.loading': 'Loading…',
    'common.unexpectedError': 'An unexpected error occurred.',
    'common.notAvailable': 'Not available',
    'common.pending': 'Pending',
    'common.na': 'N/A',

    // Dashboard page
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'TaxBridge system overview & real-time analytics',
    'dashboard.autoRefresh.paused': 'Auto-refresh paused',
    'dashboard.autoRefresh.active': 'Auto-refreshing every 30s',
    'dashboard.complianceBadge': 'NRS 2026 compliant',
    'dashboard.limited.title': 'Limited functionality',
    'dashboard.limited.body': 'Admin analytics is currently unavailable for this environment. Showing limited dashboard placeholders.',
    'dashboard.unavailable.title': 'Dashboard unavailable',
    'dashboard.unavailable.body': 'Failed to load dashboard data.',
    'dashboard.unavailable.adminDisabled': 'Admin analytics is disabled for this environment. Please contact the system administrator.',
    'dashboard.unavailable.forbidden': 'You do not have access to admin analytics in this environment.',
    'dashboard.unavailable.unauthorized': 'Admin authentication is required to view this dashboard.',

    // Dashboard metric cards
    'dashboard.metric.totalUsers': 'Total users',
    'dashboard.metric.totalInvoices': 'Total invoices',
    'dashboard.metric.totalPayments': 'Total payments',
    'dashboard.metric.complianceRate': 'Compliance rate',
    'dashboard.metric.updated': 'Updated {time}',
    'dashboard.metric.justNow': 'just now',
    'dashboard.metric.trendUnavailable': 'Trend unavailable',
    'dashboard.metric.complianceUnavailable': 'Compliance rate unavailable',

    // Dashboard sections
    'dashboard.section.integrationHealth': 'Integration health',
    'dashboard.integration.duplo.title': 'Duplo/DigiTax API',
    'dashboard.integration.duplo.desc': 'E-invoicing & NRS submission',
    'dashboard.integration.remita.title': 'Remita payment gateway',
    'dashboard.integration.remita.desc': 'Payment processing & RRR generation',
    'dashboard.section.launch.subtitle': 'Financial guardrails tracked in real time (NRR, GRR, MRR, churn)',
    'dashboard.launch.targetNrr': 'Target NRR ≥ 110%',
    'dashboard.launch.targetGrr': 'GRR ≥ 95%',
    'dashboard.launch.unavailable.title': 'Launch readiness',
    'dashboard.launch.unavailable.body': 'Launch metrics are currently unavailable.',

    'dashboard.section.metrics.duplo.title': 'Duplo e-invoicing metrics',
    'dashboard.section.metrics.duplo.desc': 'Success rate and latency over time',
    'dashboard.section.metrics.remita.title': 'Remita payment transactions',
    'dashboard.section.metrics.remita.desc': 'Daily transaction breakdown',
    'dashboard.section.activity.title': 'Recent system activity',
    'dashboard.section.activity.subtitle': 'Operational status',
    'dashboard.section.activity.unavailable': 'Activity feed is not available for this environment.',

    'dashboard.section.charts.title': 'Analytics & trends',

    'dashboard.risk.title': 'Risk & alerts',
    'dashboard.risk.subtitle': 'Backed by alerting + payment signals',
    'dashboard.risk.badge.open': '{count} open',
    'dashboard.risk.badge.stable': 'Stable',
    'dashboard.risk.unavailable': 'Launch metrics are temporarily unavailable. {message}',
    'dashboard.risk.retry': 'Please retry shortly.',
    'dashboard.risk.none': 'No anomalies detected. Guardrails holding steady as of {time}.',
    'dashboard.risk.lastCheck': 'Last check {time}',
    'dashboard.risk.now': 'now',
    'dashboard.risk.moments': 'moments ago',
    'dashboard.stats.blockedFallback': 'Admin analytics is disabled or requires authentication.',

    'severity.critical': 'Critical',
    'severity.high': 'High',
    'severity.warning': 'Warning',
    'severity.info': 'Info',

    // Launch metrics
    'launch.title': 'Launch readiness',
    'launch.loading': 'Loading latest retention and MRR data…',
    'launch.realtime': 'Realtime',
    'launch.window': 'Monitoring guardrails for {window}',
    'launch.tile.nrr': 'Net revenue retention',
    'launch.tile.grr': 'Gross revenue retention',
    'launch.tile.mrr': 'Monthly recurring revenue',
    'launch.tile.paid': 'Paid accounts',
    'launch.badge.healthy': 'Healthy',
    'launch.badge.watch': 'Monitor',
    'launch.badge.risk': 'Risk',
    'launch.delta.vsGoal': '{delta} vs 106% goal',
    'launch.delta.vsGuardrail': '{delta} vs guardrail',
    'launch.delta.vsLastMonth': '{delta} vs last month',
    'launch.drivers.title': 'Revenue drivers',
    'launch.drivers.expansion': 'Expansion',
    'launch.drivers.new': 'New MRR',
    'launch.drivers.contraction': 'Contraction',
    'launch.drivers.churn': 'Churn',

    'launch.comparison.title': 'Window comparison',
    'launch.comparison.currentWindow': 'Current window',
    'launch.comparison.previousMrr': 'Previous MRR',
    'launch.comparison.previousPaid': 'Previous paid accounts',
    'launch.comparison.lastRefresh': 'Last refresh',

    // Analytics page
    'analytics.title': 'Analytics dashboard',
    'analytics.subtitle': 'Comprehensive insights into TaxBridge operations and compliance',
    'analytics.dateRange.label': 'Select date range',
    'analytics.dateRange.7d': 'Last 7 days',
    'analytics.dateRange.30d': 'Last 30 days',
    'analytics.dateRange.90d': 'Last 90 days',
    'analytics.exportCsv': 'Export CSV',
    'analytics.error.title': 'Failed to load analytics',
    'analytics.overview.totalUsers': 'Total Users',
    'analytics.overview.totalInvoices': 'Total Invoices',
    'analytics.overview.totalPayments': 'Total Payments',
    'analytics.overview.complianceRate': 'Compliance Rate',
    'analytics.overview.monthlyGrowth': 'Monthly Growth',
    'analytics.overview.nrsCompliant': 'NRS compliant submissions',
    'analytics.overview.viaRemita': 'Via Remita integration',
    'analytics.overview.nrs2026': 'NRS 2026 compliance',
    'analytics.overview.userAcquisition': 'User acquisition',
    'analytics.overview.fromLastMonth': '+{percent}% from last month',
    'analytics.tabs.integrations': 'Integrations',
    'analytics.tabs.compliance': 'Compliance',
    'analytics.tabs.trends': 'Trends',
    'analytics.duplo.metrics': 'DigiTax E-Invoicing Metrics',
    'analytics.duplo.errorBreakdown': 'DigiTax Error Breakdown',
    'analytics.duplo.submissions': 'DigiTax Daily Submissions',
    'analytics.remita.transactions': 'Remita Transaction Trend',
    'analytics.remita.breakdown': 'Payment Breakdown',
    'analytics.remita.volume': 'Daily Volume',
    'analytics.compliance.exemptions': 'Tax Exemption Utilization',
    'analytics.compliance.withholding': 'Withholding Tax Tracking',
    'analytics.compliance.nrsTrend': 'NRS Compliance Trend',
    'analytics.chart.successRate': 'Success Rate %',
    'analytics.chart.latency': 'Latency (ms)',
    'analytics.chart.successful': 'Successful',
    'analytics.chart.failed': 'Failed',
    'analytics.chart.pending': 'Pending',
    'analytics.chart.compliant': 'Compliant',
    'analytics.chart.nonCompliant': 'Non-Compliant',
    'analytics.chart.wthAmount': 'WHT Amount',
    'analytics.chart.invoiceCount': 'Invoice Count',

    // Invoices page
    'invoices.title': 'Invoice management',
    'invoices.subtitle': 'Manage and monitor NRS e-invoice submissions',
    'invoices.error.title': 'Failed to load invoices',
    'invoices.notice.resubmitted.title': 'Resubmitted',
    'invoices.notice.resubmitted.body': 'Invoice was queued for re-submission to DigiTax.',
    'invoices.notice.resubmitFailed.title': 'Resubmit failed',
    'invoices.stats.total': 'Total invoices',
    'invoices.stats.stamped': 'Stamped',
    'invoices.stats.processing': 'Processing',
    'invoices.stats.failed': 'Failed',
    'invoices.table.title': 'Recent invoices',
    'invoices.table.id': 'ID',
    'invoices.table.customer': 'Customer',
    'invoices.table.user': 'User',
    'invoices.table.status': 'Status',
    'invoices.table.total': 'Total',
    'invoices.table.nrsReference': 'NRS reference',
    'invoices.table.created': 'Created',
    'invoices.table.actions': 'Actions',
    'invoices.actions.viewDetails': 'View details',
    'invoices.actions.resubmit': 'Resubmit to DigiTax',
    'invoices.actions.resubmitting': 'Resubmitting…',
    'invoices.dialog.title': 'Invoice details',
    'invoices.dialog.basic': 'Basic information',
    'invoices.dialog.customer': 'Customer',
    'invoices.dialog.status': 'Status',
    'invoices.dialog.subtotal': 'Subtotal',
    'invoices.dialog.vat': 'VAT',

    // Users page
    'users.title': 'User management',
    'users.subtitle': 'Monitor and manage TaxBridge users',
    'users.limited.title': 'Limited functionality',
    'users.limited.disabled': 'User management is disabled for this environment.',
    'users.error.fetch': 'Failed to fetch users: {message}',
    'users.filters.searchPlaceholder': 'Search users…',
    'users.filters.status.all': 'All',
    'users.filters.status.active': 'Active',
    'users.filters.status.pending': 'Pending',
    'users.filters.status.suspended': 'Suspended',
    'users.list.title': 'Users ({count})',
    'users.empty': 'No users found matching your criteria.',

    // Compliance page
    'compliance.title': 'Compliance dashboard',
    'compliance.subtitle': 'Monitor NRS compliance and invoice validation',
    'compliance.refresh': 'Refresh',
    'compliance.limited.title': 'Limited functionality',
    'compliance.limited.disabled': 'Compliance monitoring is disabled for this environment.',
    'compliance.error.fetch': 'Failed to fetch compliance data: {message}',

    // System page
    'system.title': 'System status',
    'system.subtitle': 'Monitor infrastructure health and integrations',
    'system.autoRefresh.on': 'Auto-refresh ON',
    'system.autoRefresh.off': 'Auto-refresh OFF',
  },
  pidgin: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoices': 'Invoices',
    'nav.analytics': 'Analytics',
    'nav.users': 'Users',
    'nav.compliance': 'Compliance',
    'nav.system': 'System',

    // Header
    'header.adminConsole': 'Admin Console',
    'header.timeZone': 'WAT',
    'header.language': 'Language',
    'header.language.en': 'English',
    'header.language.pidgin': 'Naija Pidgin',

    // Status banner
    'status.checking': 'We dey check system health…',
    'status.unavailable': 'Health check no dey available',
    'status.healthy': 'All system dey okay',
    'status.degraded': 'Performance don slow',
    'status.error': 'Service get wahala',
    'status.unknown': 'System status no clear',
    'status.lastChecked': 'Last check {time}',

    'integrations.digitax': 'DigiTax',
    'integrations.remita': 'Remita',
    'integrations.mockSuffix': ' [mock]',

    // Footer
    'footer.copyright': '© 2026 TaxBridge Nigeria. NRS 2026 compliant.',

    // Common
    'common.refresh': 'Refresh',
    'common.loading': 'Loading…',
    'common.unexpectedError': 'Something no go well.',
    'common.notAvailable': 'No dey',
    'common.pending': 'Pending',
    'common.na': 'N/A',

    // Dashboard page
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'TaxBridge overview & live analytics',
    'dashboard.autoRefresh.paused': 'Auto-refresh don pause',
    'dashboard.autoRefresh.active': 'Auto-refresh every 30s',
    'dashboard.complianceBadge': 'NRS 2026 compliant',
    'dashboard.limited.title': 'Limited work',
    'dashboard.limited.body': 'Admin analytics no dey available for this environment. We show small placeholder info.',
    'dashboard.unavailable.title': 'Dashboard no dey',
    'dashboard.unavailable.body': 'We no fit load dashboard data.',
    'dashboard.unavailable.adminDisabled': 'Admin analytics no dey enabled for this environment. Abeg contact admin.',
    'dashboard.unavailable.forbidden': 'You no get access to admin analytics for this environment.',
    'dashboard.unavailable.unauthorized': 'Admin authentication dey needed to view this dashboard.',

    // Dashboard metric cards
    'dashboard.metric.totalUsers': 'Total users',
    'dashboard.metric.totalInvoices': 'Total invoices',
    'dashboard.metric.totalPayments': 'Total payments',
    'dashboard.metric.complianceRate': 'Compliance rate',
    'dashboard.metric.updated': 'Updated {time}',
    'dashboard.metric.justNow': 'just now',
    'dashboard.metric.trendUnavailable': 'Trend no dey',
    'dashboard.metric.complianceUnavailable': 'Compliance rate no dey',

    // Dashboard sections
    'dashboard.section.integrationHealth': 'Integration health',
    'dashboard.integration.duplo.title': 'Duplo/DigiTax API',
    'dashboard.integration.duplo.desc': 'E-invoicing & NRS submission',
    'dashboard.integration.remita.title': 'Remita payment gateway',
    'dashboard.integration.remita.desc': 'Payment processing & RRR generation',
    'dashboard.section.launch.subtitle': 'Financial guardrails we dey track live (NRR, GRR, MRR, churn)',
    'dashboard.launch.targetNrr': 'Target NRR ≥ 110%',
    'dashboard.launch.targetGrr': 'GRR ≥ 95%',
    'dashboard.launch.unavailable.title': 'Launch readiness',
    'dashboard.launch.unavailable.body': 'Launch metrics no dey available now.',

    'dashboard.section.metrics.duplo.title': 'Duplo e-invoicing metrics',
    'dashboard.section.metrics.duplo.desc': 'Success rate and latency over time',
    'dashboard.section.metrics.remita.title': 'Remita payment transactions',
    'dashboard.section.metrics.remita.desc': 'Daily transaction breakdown',
    'dashboard.section.activity.title': 'Recent system activity',
    'dashboard.section.activity.subtitle': 'Operational status',
    'dashboard.section.activity.unavailable': 'Activity feed no dey available for this environment.',

    'dashboard.section.charts.title': 'Analytics & trends',

    'dashboard.risk.title': 'Risk & alerts',
    'dashboard.risk.subtitle': 'Alerting + payment signals dey back am',
    'dashboard.risk.badge.open': '{count} open',
    'dashboard.risk.badge.stable': 'Stable',
    'dashboard.risk.unavailable': 'Launch metrics no dey available small time. {message}',
    'dashboard.risk.retry': 'Abeg try again small.',
    'dashboard.risk.none': 'No anomaly. Guardrails still dey hold as of {time}.',
    'dashboard.risk.lastCheck': 'Last check {time}',
    'dashboard.risk.now': 'now',
    'dashboard.risk.moments': 'just now',
    'dashboard.stats.blockedFallback': 'Admin analytics no dey enabled or authentication dey needed.',

    'severity.critical': 'Critical',
    'severity.high': 'High',
    'severity.warning': 'Warning',
    'severity.info': 'Info',

    // Launch metrics
    'launch.title': 'Launch readiness',
    'launch.loading': 'We dey load retention and MRR data…',
    'launch.realtime': 'Realtime',
    'launch.window': 'We dey monitor guardrails for {window}',
    'launch.tile.nrr': 'Net revenue retention',
    'launch.tile.grr': 'Gross revenue retention',
    'launch.tile.mrr': 'Monthly recurring revenue',
    'launch.tile.paid': 'Paid accounts',
    'launch.badge.healthy': 'Okay',
    'launch.badge.watch': 'Monitor',
    'launch.badge.risk': 'Risk',
    'launch.delta.vsGoal': '{delta} vs 106% goal',
    'launch.delta.vsGuardrail': '{delta} vs guardrail',
    'launch.delta.vsLastMonth': '{delta} vs last month',
    'launch.drivers.title': 'Revenue drivers',
    'launch.drivers.expansion': 'Expansion',
    'launch.drivers.new': 'New MRR',
    'launch.drivers.contraction': 'Contraction',
    'launch.drivers.churn': 'Churn',

    'launch.comparison.title': 'Window comparison',
    'launch.comparison.currentWindow': 'Current window',
    'launch.comparison.previousMrr': 'Previous MRR',
    'launch.comparison.previousPaid': 'Previous paid accounts',
    'launch.comparison.lastRefresh': 'Last refresh',

    // Analytics page
    'analytics.title': 'Analytics dashboard',
    'analytics.subtitle': 'Full insight for TaxBridge work and compliance',
    'analytics.dateRange.label': 'Select date range',
    'analytics.dateRange.7d': 'Last 7 days',
    'analytics.dateRange.30d': 'Last 30 days',
    'analytics.dateRange.90d': 'Last 90 days',
    'analytics.exportCsv': 'Export CSV',
    'analytics.error.title': 'Analytics no load',
    'analytics.overview.totalUsers': 'Total Users',
    'analytics.overview.totalInvoices': 'Total Invoices',
    'analytics.overview.totalPayments': 'Total Payments',
    'analytics.overview.complianceRate': 'Compliance Rate',
    'analytics.overview.monthlyGrowth': 'Monthly Growth',
    'analytics.overview.nrsCompliant': 'NRS compliant submissions',
    'analytics.overview.viaRemita': 'Via Remita integration',
    'analytics.overview.nrs2026': 'NRS 2026 compliance',
    'analytics.overview.userAcquisition': 'User acquisition',
    'analytics.overview.fromLastMonth': '+{percent}% from last month',
    'analytics.tabs.integrations': 'Integrations',
    'analytics.tabs.compliance': 'Compliance',
    'analytics.tabs.trends': 'Trends',
    'analytics.duplo.metrics': 'DigiTax E-Invoicing Metrics',
    'analytics.duplo.errorBreakdown': 'DigiTax Error Breakdown',
    'analytics.duplo.submissions': 'DigiTax Daily Submissions',
    'analytics.remita.transactions': 'Remita Transaction Trend',
    'analytics.remita.breakdown': 'Payment Breakdown',
    'analytics.remita.volume': 'Daily Volume',
    'analytics.compliance.exemptions': 'Tax Exemption Utilization',
    'analytics.compliance.withholding': 'Withholding Tax Tracking',
    'analytics.compliance.nrsTrend': 'NRS Compliance Trend',
    'analytics.chart.successRate': 'Success Rate %',
    'analytics.chart.latency': 'Latency (ms)',
    'analytics.chart.successful': 'Successful',
    'analytics.chart.failed': 'Failed',
    'analytics.chart.pending': 'Pending',
    'analytics.chart.compliant': 'Compliant',
    'analytics.chart.nonCompliant': 'Non-Compliant',
    'analytics.chart.wthAmount': 'WHT Amount',
    'analytics.chart.invoiceCount': 'Invoice Count',

    // Invoices page
    'invoices.title': 'Invoice management',
    'invoices.subtitle': 'Manage and monitor NRS e-invoice submissions',
    'invoices.error.title': 'Invoices no load',
    'invoices.notice.resubmitted.title': 'Resubmitted',
    'invoices.notice.resubmitted.body': 'We queue invoice make e resubmit to DigiTax.',
    'invoices.notice.resubmitFailed.title': 'Resubmit no work',
    'invoices.stats.total': 'Total invoices',
    'invoices.stats.stamped': 'Stamped',
    'invoices.stats.processing': 'Processing',
    'invoices.stats.failed': 'Failed',
    'invoices.table.title': 'Recent invoices',
    'invoices.table.id': 'ID',
    'invoices.table.customer': 'Customer',
    'invoices.table.user': 'User',
    'invoices.table.status': 'Status',
    'invoices.table.total': 'Total',
    'invoices.table.nrsReference': 'NRS reference',
    'invoices.table.created': 'Created',
    'invoices.table.actions': 'Actions',
    'invoices.actions.viewDetails': 'View details',
    'invoices.actions.resubmit': 'Resubmit to DigiTax',
    'invoices.actions.resubmitting': 'Resubmitting…',
    'invoices.dialog.title': 'Invoice details',
    'invoices.dialog.basic': 'Basic information',
    'invoices.dialog.customer': 'Customer',
    'invoices.dialog.status': 'Status',
    'invoices.dialog.subtotal': 'Subtotal',
    'invoices.dialog.vat': 'VAT',

    // Users page
    'users.title': 'User management',
    'users.subtitle': 'Monitor and manage TaxBridge users',
    'users.limited.title': 'Limited work',
    'users.limited.disabled': 'User management no dey enabled for this environment.',
    'users.error.fetch': 'We no fit fetch users: {message}',
    'users.filters.searchPlaceholder': 'Search users…',
    'users.filters.status.all': 'All',
    'users.filters.status.active': 'Active',
    'users.filters.status.pending': 'Pending',
    'users.filters.status.suspended': 'Suspended',
    'users.list.title': 'Users ({count})',
    'users.empty': 'No user match your search.',

    // Compliance page
    'compliance.title': 'Compliance dashboard',
    'compliance.subtitle': 'Monitor NRS compliance and invoice validation',
    'compliance.refresh': 'Refresh',
    'compliance.limited.title': 'Limited work',
    'compliance.limited.disabled': 'Compliance monitoring no dey enabled for this environment.',
    'compliance.error.fetch': 'We no fit fetch compliance data: {message}',

    // System page
    'system.title': 'System status',
    'system.subtitle': 'Monitor infrastructure health and integrations',
    'system.autoRefresh.on': 'Auto-refresh ON',
    'system.autoRefresh.off': 'Auto-refresh OFF',
  },
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(template: string, vars?: Record<string, string | number | undefined>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? '' : String(value);
  });
}

function normalizeLanguage(value: unknown): AdminLanguage {
  if (value === 'en' || value === 'pidgin') return value;
  return 'en';
}

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AdminLanguage>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? normalizeLanguage(stored) : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((next: AdminLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback<I18nContextValue['t']>((key, vars) => {
    const value = messages[lang][key] ?? messages.en[key] ?? key;
    return interpolate(value, vars);
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAdminI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useAdminI18n must be used within AdminI18nProvider');
  }
  return ctx;
}
