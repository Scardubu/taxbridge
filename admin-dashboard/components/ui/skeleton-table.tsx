import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div className={cn('w-full animate-pulse', className)} role="status" aria-label="Loading table data">
      {/* Header */}
      <div className="flex gap-4 border-b border-slate-200 pb-3 mb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="h-4 rounded bg-slate-200"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="flex items-center gap-4 border-b border-slate-100 py-3"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={`cell-${rowIdx}-${colIdx}`}
              className={cn(
                'h-4 rounded bg-slate-100',
                colIdx === 0 && 'bg-slate-200'
              )}
              style={{
                width: `${Math.max(40, 100 / columns - (colIdx * 5))}%`,
              }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg border border-slate-200 bg-white p-6',
        className
      )}
      role="status"
      aria-label="Loading card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-8 w-8 rounded-lg bg-slate-100" />
      </div>
      <div className="h-8 w-24 rounded bg-slate-200 mb-2" />
      <div className="h-3 w-40 rounded bg-slate-100" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
