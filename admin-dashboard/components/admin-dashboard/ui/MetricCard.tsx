'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Icon slot — pass a 20×20 SVG or Lucide icon */
  icon?: React.ReactNode;
  /** Colour swatch applied to the icon container */
  iconVariant?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate';
  trend?: {
    value: number;
    direction: TrendDirection;
    label?: string;
  };
  loading?: boolean;
  className?: string;
  /** data-currency attr so tabular-nums font feature activates */
  currency?: boolean;
}

const iconVariantMap: Record<NonNullable<MetricCardProps['iconVariant']>, string> = {
  blue:    'bg-blue-50   border-blue-100   text-blue-600   dark:bg-blue-950  dark:border-blue-900  dark:text-blue-400',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-400',
  violet:  'bg-violet-50 border-violet-100 text-violet-600 dark:bg-violet-950 dark:border-violet-900 dark:text-violet-400',
  amber:   'bg-amber-50  border-amber-100  text-amber-600  dark:bg-amber-950  dark:border-amber-900  dark:text-amber-400',
  rose:    'bg-rose-50   border-rose-100   text-rose-600   dark:bg-rose-950   dark:border-rose-900   dark:text-rose-400',
  slate:   'bg-slate-100 border-slate-200  text-slate-600  dark:bg-slate-800  dark:border-slate-700  dark:text-slate-400',
};

const trendColorMap: Record<TrendDirection, string> = {
  up:      'text-emerald-600 dark:text-emerald-400',
  down:    'text-rose-600    dark:text-rose-400',
  neutral: 'text-slate-500   dark:text-slate-400',
};

const trendArrow: Record<TrendDirection, string> = {
  up: '↑', down: '↓', neutral: '→',
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  iconVariant = 'slate',
  trend,
  loading = false,
  className,
  currency = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'tb-surface tb-surface-hover card-lift group relative flex flex-col gap-3 p-5',
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="tb-label">{label}</p>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              iconVariantMap[iconVariant],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ) : (
        <p
          className="tb-value"
          data-numeric="true"
          {...(currency ? { 'data-currency': 'true' } : {})}
        >
          {value}
        </p>
      )}

      {/* Trend + hint row */}
      {(trend || hint) && (
        <div className="flex items-center gap-2">
          {trend && !loading && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                trend.direction === 'up'      && 'bg-emerald-50 dark:bg-emerald-950',
                trend.direction === 'down'    && 'bg-rose-50    dark:bg-rose-950',
                trend.direction === 'neutral' && 'bg-slate-100  dark:bg-slate-800',
                trendColorMap[trend.direction],
              )}
            >
              <span aria-hidden="true">{trendArrow[trend.direction]}</span>
              {Math.abs(trend.value)}%
            </span>
          )}
          {hint && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{hint}</p>
          )}
          {trend?.label && !hint && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{trend.label}</p>
          )}
        </div>
      )}
    </div>
  );
}
