import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        borderRadius: 18,
        background: 'var(--surface-muted)',
        border: '1px dashed var(--border-strong)',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>{icon ?? '◌'}</div>
        <h3 style={{ margin: 0, fontSize: 18, color: 'var(--foreground)' }}>{title}</h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{body}</p>
        {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
      </div>
    </div>
  );
}
