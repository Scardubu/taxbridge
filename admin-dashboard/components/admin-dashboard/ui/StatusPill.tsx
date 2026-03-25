'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusVariant =
  | 'healthy' | 'degraded' | 'error' | 'unknown'
  | 'active'  | 'pending'  | 'paid'  | 'overdue' | 'cancelled' | 'draft' | 'sent'
  | 'success' | 'warning'  | 'info';

interface StatusPillProps {
  status: StatusVariant;
  label?: string;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<StatusVariant, { label: string; classes: string; dotColor: string }> = {
  healthy:   { label: 'Healthy',   classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', dotColor: 'bg-emerald-500' },
  active:    { label: 'Active',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', dotColor: 'bg-emerald-500' },
  paid:      { label: 'Paid',      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', dotColor: 'bg-emerald-500' },
  success:   { label: 'Success',   classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', dotColor: 'bg-emerald-500' },
  sent:      { label: 'Sent',      classes: 'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950   dark:text-blue-300   dark:border-blue-800',   dotColor: 'bg-blue-500'   },
  info:      { label: 'Info',      classes: 'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-950   dark:text-blue-300   dark:border-blue-800',   dotColor: 'bg-blue-500'   },
  degraded:  { label: 'Degraded',  classes: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950  dark:text-amber-300  dark:border-amber-800',  dotColor: 'bg-amber-400'  },
  pending:   { label: 'Pending',   classes: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950  dark:text-amber-300  dark:border-amber-800',  dotColor: 'bg-amber-400'  },
  warning:   { label: 'Warning',   classes: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-950  dark:text-amber-300  dark:border-amber-800',  dotColor: 'bg-amber-400'  },
  draft:     { label: 'Draft',     classes: 'bg-slate-100 text-slate-600  border-slate-200  dark:bg-slate-800  dark:text-slate-300  dark:border-slate-700',  dotColor: 'bg-slate-400'  },
  unknown:   { label: 'Unknown',   classes: 'bg-slate-100 text-slate-600  border-slate-200  dark:bg-slate-800  dark:text-slate-300  dark:border-slate-700',  dotColor: 'bg-slate-400'  },
  error:     { label: 'Error',     classes: 'bg-rose-50   text-rose-700   border-rose-200   dark:bg-rose-950   dark:text-rose-300   dark:border-rose-800',   dotColor: 'bg-rose-500'   },
  overdue:   { label: 'Overdue',   classes: 'bg-rose-50   text-rose-700   border-rose-200   dark:bg-rose-950   dark:text-rose-300   dark:border-rose-800',   dotColor: 'bg-rose-500'   },
  cancelled: { label: 'Cancelled', classes: 'bg-rose-50   text-rose-700   border-rose-200   dark:bg-rose-950   dark:text-rose-300   dark:border-rose-800',   dotColor: 'bg-rose-500'   },
};

export function StatusPill({
  status,
  label,
  dot = true,
  pulse = false,
  className,
  size = 'sm',
}: StatusPillProps) {
  const config = statusConfig[status] ?? statusConfig.unknown;
  const displayLabel = label ?? config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        config.classes,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                config.dotColor,
              )}
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', config.dotColor)} />
        </span>
      )}
      {displayLabel}
    </span>
  );
}
