'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EnterpriseShell } from '@/components/admin-dashboard/shell/EnterpriseShell';
import { OverviewTab }   from '@/components/admin-dashboard/tabs/OverviewTab';
import { AnalyticsTab }  from '@/components/admin-dashboard/tabs/AnalyticsTab';
import { ComplianceTab } from '@/components/admin-dashboard/tabs/ComplianceTab';
import { InvoicesTab }   from '@/components/admin-dashboard/tabs/InvoicesTab';
import { UsersTab }      from '@/components/admin-dashboard/tabs/UsersTab';
import { DevicesTab }    from '@/components/admin-dashboard/tabs/DevicesTab';
import { SystemTab }     from '@/components/admin-dashboard/tabs/SystemTab';
import {
  LayoutDashboard, BarChart2, ShieldCheck,
  FileText, Users, Smartphone, Server,
} from 'lucide-react';

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

// ─── Enterprise Control Center ────────────────────────────────────────────────

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const initialTab = (searchParams.get('tab') as TabId | null) ?? 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some(t => t.id === initialTab) ? initialTab : 'overview',
  );

  const handleTabChange = (value: string) => {
    const tab = value as TabId;
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

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
              value={id}
              className="flex min-w-[80px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 sm:min-w-[100px] sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.slice(0, 3)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab panels */}
        <TabsContent value="overview"   className="mt-0 focus-visible:outline-none"><OverviewTab   /></TabsContent>
        <TabsContent value="analytics"  className="mt-0 focus-visible:outline-none"><AnalyticsTab  /></TabsContent>
        <TabsContent value="compliance" className="mt-0 focus-visible:outline-none"><ComplianceTab /></TabsContent>
        <TabsContent value="invoices"   className="mt-0 focus-visible:outline-none"><InvoicesTab   /></TabsContent>
        <TabsContent value="users"      className="mt-0 focus-visible:outline-none"><UsersTab      /></TabsContent>
        <TabsContent value="devices"    className="mt-0 focus-visible:outline-none"><DevicesTab    /></TabsContent>
        <TabsContent value="system"     className="mt-0 focus-visible:outline-none"><SystemTab     /></TabsContent>
      </Tabs>
    </EnterpriseShell>
  );
}
