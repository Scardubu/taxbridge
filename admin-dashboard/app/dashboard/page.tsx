'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EnterpriseShell } from '@/components/admin-dashboard/shell/EnterpriseShell';
import {
  LayoutDashboard, BarChart2, ShieldCheck,
  FileText, Users, Smartphone, Server,
} from 'lucide-react';

const TabPanelFallback = () => (
  <div className="space-y-6 animate-fade-in" role="status" aria-label="Loading dashboard section">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      ))}
    </div>
  </div>
);

const OverviewTab = dynamic(() => import('@/components/admin-dashboard/tabs/OverviewTab').then((mod) => mod.OverviewTab), {
  loading: () => <TabPanelFallback />,
});
const AnalyticsTab = dynamic(() => import('@/components/admin-dashboard/tabs/AnalyticsTab').then((mod) => mod.AnalyticsTab), {
  loading: () => <TabPanelFallback />,
});
const ComplianceTab = dynamic(() => import('@/components/admin-dashboard/tabs/ComplianceTab').then((mod) => mod.ComplianceTab), {
  loading: () => <TabPanelFallback />,
});
const InvoicesTab = dynamic(() => import('@/components/admin-dashboard/tabs/InvoicesTab').then((mod) => mod.InvoicesTab), {
  loading: () => <TabPanelFallback />,
});
const UsersTab = dynamic(() => import('@/components/admin-dashboard/tabs/UsersTab').then((mod) => mod.UsersTab), {
  loading: () => <TabPanelFallback />,
});
const DevicesTab = dynamic(() => import('@/components/admin-dashboard/tabs/DevicesTab').then((mod) => mod.DevicesTab), {
  loading: () => <TabPanelFallback />,
});
const SystemTab = dynamic(() => import('@/components/admin-dashboard/tabs/SystemTab').then((mod) => mod.SystemTab), {
  loading: () => <TabPanelFallback />,
});

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',    icon: LayoutDashboard, shortLabel: 'Overview'   },
  { id: 'analytics',  label: 'Analytics',   icon: BarChart2,       shortLabel: 'Analytics'  },
  { id: 'compliance', label: 'Compliance',  icon: ShieldCheck,     shortLabel: 'Compliance' },
  { id: 'invoices',   label: 'Invoices',    icon: FileText,        shortLabel: 'Invoices'   },
  { id: 'users',      label: 'Businesses',  icon: Users,           shortLabel: 'Businesses' },
  { id: 'devices',    label: 'Devices',     icon: Smartphone,      shortLabel: 'Devices'    },
  { id: 'system',     label: 'System',      icon: Server,          shortLabel: 'System'     },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_COMPONENTS: Record<TabId, () => React.ReactElement> = {
  overview: () => <OverviewTab />,
  analytics: () => <AnalyticsTab />,
  compliance: () => <ComplianceTab />,
  invoices: () => <InvoicesTab />,
  users: () => <UsersTab />,
  devices: () => <DevicesTab />,
  system: () => <SystemTab />,
};

// ─── Enterprise Control Center ────────────────────────────────────────────────

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const searchTab = searchParams.get('tab') as TabId | null;
  const initialTab = useMemo<TabId>(
    () => (searchTab && TABS.some(t => t.id === searchTab) ? searchTab : 'overview'),
    [searchTab],
  );
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (activeTab !== initialTab) {
      setActiveTab(initialTab);
    }
  }, [activeTab, initialTab]);

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : '/dashboard', { scroll: false });
  };

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <EnterpriseShell>

      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              NRS Compliant
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Operator Console
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-slate-900 dark:text-slate-100 sm:text-3xl">
            TaxBridge Admin
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Enterprise Control Center — accountant-first, real-time, NRS-ready.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="tb-label">Current Workspace</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {TABS.find(tab => tab.id === activeTab)?.label ?? 'Overview'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Metrics first, then actions and exception handling.
          </p>
        </div>
      </div>

      {/* ── Tabbed Control Center ── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">

        {/* Tab bar */}
        <TabsList
          className="no-scrollbar flex h-auto w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
          aria-label="Dashboard sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              id={`dashboard-tab-${id}`}
              value={id}
              aria-label={`${label} section`}
              className="flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 sm:min-w-[100px] sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.slice(0, 3)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${activeTab}`}
          className="mt-0 focus-visible:outline-none"
        >
          <ActiveTabComponent />
        </div>
      </Tabs>
    </EnterpriseShell>
  );
}
