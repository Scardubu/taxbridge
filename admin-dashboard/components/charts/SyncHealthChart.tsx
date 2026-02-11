'use client';

import React, { useMemo, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface SyncHealthDataPoint {
  hour: string;
  successful: number;
  failed: number;
  avgLatencyMs: number;
}

interface SyncHealthChartProps {
  data: SyncHealthDataPoint[];
}

const getBarColor = (successRate: number): string => {
  if (successRate >= 99) return '#10B981';
  if (successRate >= 95) return '#FBBF24';
  return '#DC2626';
};

export const SyncHealthChart = memo<SyncHealthChartProps>(function SyncHealthChart({ data }) {
  const isEmpty = useMemo(() => !data || data.length === 0, [data]);

  const enrichedData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => {
      const total = d.successful + d.failed;
      const successRate = total > 0 ? (d.successful / total) * 100 : 100;
      return { ...d, successRate, total };
    });
  }, [data]);

  if (isEmpty) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60">
        <p className="text-sm text-slate-500">No sync health data available yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={enrichedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          }}
          formatter={((value: number, name: string) => {
            if (name === 'Success Rate') return [`${value.toFixed(1)}%`, name];
            return [value, name];
          }) as any}
        />
        <Bar dataKey="successRate" name="Success Rate" radius={[4, 4, 0, 0]}>
          {enrichedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.successRate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

SyncHealthChart.displayName = 'SyncHealthChart';
