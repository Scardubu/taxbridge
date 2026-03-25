import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'text-sm font-semibold text-slate-800 dark:text-slate-200',
  md: 'text-base font-semibold text-slate-900 dark:text-slate-100',
  lg: 'text-lg font-semibold text-slate-900 dark:text-slate-100',
};

export function SectionHeader({
  title,
  description,
  action,
  className,
  size = 'md',
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        <h2 className={cn('tracking-[-0.02em]', sizeMap[size])}>{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
