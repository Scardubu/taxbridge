'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAdminI18n, type AdminLanguage } from '@/lib/i18n';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Users,
  Shield,
  Smartphone,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  labelKey: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { labelKey: 'nav.invoices', href: '/dashboard/invoices', icon: FileText },
  { labelKey: 'nav.analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { labelKey: 'nav.users', href: '/dashboard/users', icon: Users },
  { labelKey: 'nav.devices', href: '/dashboard/devices', icon: Smartphone },
  { labelKey: 'nav.compliance', href: '/dashboard/compliance', icon: Shield },
  { labelKey: 'nav.system', href: '/dashboard/system', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { t, lang, setLang } = useAdminI18n();
  const [isOpen, setIsOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Prevent background scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* ── Desktop nav (md and above) ─────────────────── */}
      <nav
        className="hidden md:flex items-center space-x-1"
        aria-label={t('nav.ariaLabel')}
      >
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
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
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile hamburger button (below md) ─────────── */}
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-label={isOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Menu className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {/* ── Mobile drawer (below md) ────────────────────── */}
      {isOpen && (
        <>
          {/* Dim overlay — closes drawer on tap */}
          <div
            className="md:hidden fixed inset-0 top-16 z-40 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <div
            id="mobile-nav-menu"
            role="navigation"
            aria-label={t('nav.ariaLabel')}
            className="md:hidden fixed top-16 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-xl animate-in slide-in-from-top-2 duration-200"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
              {navigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-150',
                      isActive
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100',
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}

              {/* Language selector at bottom of drawer */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600">
                  <span>{t('header.language')}</span>
                  <select
                    id="lang-select-mobile"
                    name="lang"
                    aria-label={t('header.language')}
                    value={lang}
                    onChange={(e) => setLang(e.target.value as AdminLanguage)}
                    className="ml-auto h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="en">{t('header.language.en')}</option>
                    <option value="pidgin">{t('header.language.pidgin')}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
