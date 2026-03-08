'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const COMMANDS = [
  { href: '/admin/analytics', label: 'Open Analytics', keywords: 'analytics revenue charts' },
  { href: '/admin/audit', label: 'Open Audit Log', keywords: 'audit timeline export' },
  { href: '/admin/dlq', label: 'Open Dead Letter Queue', keywords: 'dlq queue failed jobs' },
  { href: '/admin/team', label: 'Open Team Management', keywords: 'team members roles' },
  { href: '/admin/api-health', label: 'Open API Health', keywords: 'health metrics circuit' },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMANDS;
    return COMMANDS.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(normalized));
  }, [query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'grid',
        placeItems: 'start center',
        paddingTop: '10vh',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(100%, 640px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search admin pages…"
            aria-label="Search admin pages"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 16,
            }}
          />
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
          {results.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 16,
                color: 'var(--foreground)',
                textDecoration: 'none',
              }}
            >
              <span>{item.label}</span>
              <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>↵</span>
            </Link>
          ))}
          {results.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-foreground)' }}>No matching command</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
