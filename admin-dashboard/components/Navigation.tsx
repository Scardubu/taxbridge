'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAdminI18n } from '@/lib/i18n';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings, 
  Users,
  Shield,
  Smartphone,
  type LucideIcon
} from 'lucide-react';

interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'nav.invoices',
    href: '/dashboard/invoices',
    icon: FileText,
  },
  {
    labelKey: 'nav.analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    labelKey: 'nav.users',
    href: '/dashboard/users',
    icon: Users,
  },
  {
    labelKey: 'nav.devices',
    href: '/dashboard/devices',
    icon: Smartphone,
  },
  {
    labelKey: 'nav.compliance',
    href: '/dashboard/compliance',
    icon: Shield,
  },
  {
    labelKey: 'nav.system',
    href: '/dashboard/system',
    icon: Settings,
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { t } = useAdminI18n();

  return (
    <nav className="hidden md:flex items-center space-x-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href || 
          (item.href !== '/dashboard' && pathname?.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
