import type { CSSProperties, ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  padded?: boolean;
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 16,
};

export function Card({ title, description, actions, children, style, padded = true }: CardProps) {
  return (
    <section
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-sm)',
        padding: padded ? 24 : 0,
        ...style,
      }}
    >
      {(title || description || actions) && (
        <div style={headerStyle}>
          <div>
            {title ? (
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{title}</h2>
            ) : null}
            {description ? (
              <p style={{ margin: title ? '6px 0 0' : 0, color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.5 }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
