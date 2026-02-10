'use client';

import React, { useMemo, memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface PaymentChartDataPoint {
  date: string;
  successful: number;
  failed: number;
  pending: number;
  volume: number;
}

interface PaymentChartProps {
  data: PaymentChartDataPoint[];
}

const COLORS = {
  successful: '#10B981',
  failed: '#DC2626',
  pending: '#FBBF24',
};

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₦${(value / 1_000).toFixed(0)}K`;
  return `₦${value}`;
};

export const PaymentChart = memo<PaymentChartProps>(function PaymentChart({ data }) {
  const isEmpty = useMemo(() => !data || data.length === 0, [data]);

  if (isEmpty) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60">
        <p className="text-sm text-slate-500">No payment data available yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorSuccessful" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.successful} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS.successful} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.pending} stopOpacity={0.2} />
            <stop offset="95%" stopColor={COLORS.pending} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          }}
          formatter={((value: number, name: string) => [
            formatCurrency(value),
            name.charAt(0).toUpperCase() + name.slice(1),
          ]) as any}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Area
          type="monotone"
          dataKey="successful"
          name="Successful"
          stroke={COLORS.successful}
          fill="url(#colorSuccessful)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="failed"
          name="Failed"
          stroke={COLORS.failed}
          fill="url(#colorFailed)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="pending"
          name="Pending"
          stroke={COLORS.pending}
          fill="url(#colorPending)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

PaymentChart.displayName = 'PaymentChart';
