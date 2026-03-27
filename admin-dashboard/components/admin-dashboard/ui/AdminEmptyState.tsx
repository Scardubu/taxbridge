'use client';

import * as React from 'react';
import { SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function AdminEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: AdminEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/70',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
        {icon ?? <SearchX className="h-5 w-5" aria-hidden="true" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100">{title}</p>
        <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
