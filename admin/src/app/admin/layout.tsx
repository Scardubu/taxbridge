import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'TaxBridge Admin' };

const NAV = [
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/audit',     label: 'Audit Log'  },
  { href: '/admin/dlq',       label: 'DLQ'        },
  { href: '/admin/team',      label: 'Team'       },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          backgroundColor: '#1E3A5F',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flexShrink: 0,
        }}
        aria-label="Admin navigation"
      >
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #2D4F7A' }}>
          <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 18 }}>
            TaxBridge
          </span>
          <span style={{ color: '#93C5FD', fontSize: 11, display: 'block', marginTop: 2 }}>
            Admin Panel
          </span>
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '10px 20px',
              color: '#CBD5E1',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              margin: '0 8px',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
