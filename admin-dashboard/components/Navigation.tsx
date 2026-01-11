'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings, 
  Users,
  Shield,
  type LucideIcon
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    icon: FileText,
    badge: 23,  // Pending invoices
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
  },
  {
    name: 'Users',
    href: '/dashboard/users',
    icon: Users,
  },
  {
    name: 'Compliance',
    href: '/dashboard/compliance',
    icon: Shield,
  },
  {
    name: 'System',
    href: '/dashboard/system',
    icon: Settings,
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center space-x-1">
      {navigation.map((item) => {
        const isActive = pathname === item.href || 
          (item.href !== '/dashboard' && pathname?.startsWith(item.href));
        
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.name}</span>
            {item.badge && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold',
                isActive 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-200 text-slate-700'
              )}>
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
