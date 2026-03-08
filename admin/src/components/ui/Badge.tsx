import type { CSSProperties, ReactNode } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
};

const tones: Record<BadgeTone, CSSProperties> = {
  neutral: { background: 'var(--surface-muted)', color: 'var(--foreground-soft)', border: '1px solid var(--border)' },
  success: { background: 'rgba(34,197,94,0.12)', color: '#15803d', border: '1px solid rgba(34,197,94,0.24)' },
  warning: { background: 'rgba(245,158,11,0.14)', color: '#b45309', border: '1px solid rgba(245,158,11,0.24)' },
  danger: { background: 'rgba(239,68,68,0.12)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.22)' },
  info: { background: 'rgba(59,130,246,0.12)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.24)' },
};

export function Badge({ children, tone = 'neutral', style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
