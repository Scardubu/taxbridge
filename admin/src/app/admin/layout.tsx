'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Badge, CommandPalette } from '../../components/ui';

const NAV = [
  { href: '/admin/analytics', label: 'Analytics', icon: '◫' },
  { href: '/admin/audit', label: 'Audit', icon: '◌' },
  { href: '/admin/dlq', label: 'DLQ', icon: '△' },
  { href: '/admin/team', label: 'Team', icon: '◎' },
  { href: '/admin/api-health', label: 'API Health', icon: '◉' },
];

const shellCardStyle: CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
  borderRadius: 24,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pageLabel = useMemo(() => {
    const match = NAV.find((item) => pathname === item.href);
    return match?.label ?? 'Overview';
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    window.localStorage.setItem('taxbridge-admin-theme', nextTheme);
  };

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh', padding: 20, gap: 20 }}>
        <aside
        style={{
          width: 280,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          flexShrink: 0,
          position: 'sticky',
          top: 20,
          alignSelf: 'flex-start',
          minHeight: 'calc(100vh - 40px)',
          ...shellCardStyle,
        }}
        aria-label="Admin navigation"
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ color: 'var(--foreground)', fontWeight: 800, fontSize: 20, letterSpacing: -0.02 }}>TaxBridge</div>
              <div style={{ color: 'var(--muted-foreground)', fontSize: 12, marginTop: 4 }}>V13 Sovereign Admin</div>
            </div>
            <Badge tone="info">LIVE</Badge>
          </div>

          <div style={{ padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, var(--primary-soft), transparent)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.12, fontWeight: 700 }}>
              Org switcher
            </div>
            <div style={{ marginTop: 8, color: 'var(--foreground)', fontWeight: 700 }}>Acme Trading Ltd</div>
            <div style={{ marginTop: 4, color: 'var(--muted-foreground)', fontSize: 13 }}>Sovereign operations workspace</div>
          </div>
        </div>

        <nav style={{ display: 'grid', gap: 8 }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  color: active ? 'white' : 'var(--foreground-soft)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  borderRadius: 16,
                  background: active ? 'linear-gradient(135deg, var(--primary), var(--primary-strong))' : 'transparent',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <span aria-hidden="true" style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 'auto', display: 'grid', gap: 12 }}>
          <div style={{ padding: 16, borderRadius: 18, border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground-soft)' }}>Quick search</div>
            <button className="tb-button tb-button-secondary" style={{ width: '100%', marginTop: 10, justifyContent: 'space-between' }} onClick={() => setPaletteOpen(true)}>
              <span>Open command palette</span>
              <span className="tb-kbd">⌘K</span>
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            Production admin surface for audit, telemetry, queue operations, and org access control.
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header
          style={{
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            ...shellCardStyle,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.12 }}>
              Sovereign Operations
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
              {pageLabel}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              Monitor platform health, investigate failures, and manage tax operations from one surface.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="tb-button tb-button-secondary" onClick={() => setPaletteOpen(true)}>
              Search <span className="tb-kbd">⌘K</span>
            </button>
            <button className="tb-button tb-button-secondary" onClick={toggleTheme} aria-label="Toggle dark mode">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="tb-button tb-button-secondary" aria-label="Notifications">
              Notifications <Badge tone="warning">3</Badge>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 800 }}>
                TA
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Tax Admin</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>ADMIN</div>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: 4, overflowY: 'auto', animation: 'tb-fade-in 180ms ease-out' }}>
          {children}
        </main>
      </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
