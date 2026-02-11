'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}

const trendColors = {
  up: 'text-tb-success',
  down: 'text-tb-error',
  neutral: 'text-slate-500',
};

const trendIcons = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Card className={cn('hover:shadow-tb-md transition-shadow', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          {title}
        </CardTitle>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary-light">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trendColors[trend.direction]
                )}
              >
                {trendIcons[trend.direction]}
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-slate-500">{subtitle}</span>
            )}
            {trend && !subtitle && (
              <span className="text-xs text-slate-500">{trend.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
