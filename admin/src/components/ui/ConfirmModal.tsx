'use client';

import type { ReactNode } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: 'min(100%, 520px)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: 24,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h2 id="confirm-modal-title" style={{ margin: 0, color: 'var(--foreground)', fontSize: 20 }}>{title}</h2>
        <p style={{ margin: '10px 0 0', color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.6 }}>{body}</p>
        {children ? <div style={{ marginTop: 16 }}>{children}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
          <button className="tb-button tb-button-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button
            className={tone === 'danger' ? 'tb-button tb-button-danger' : 'tb-button'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
