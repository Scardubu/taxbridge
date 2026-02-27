'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { useAdminI18n } from '@/lib/i18n';
import { chartColors } from '@/lib/colors';
import { safeDate } from '@/lib/utils';

interface DuploHealthData {
  timestamp: string;
  successRate: number;
  latency: number;
  submissions: number;
}

interface DuploHealthChartProps {
  data: DuploHealthData[];
}

export function DuploHealthChart({ data }: DuploHealthChartProps) {
  const { t } = useAdminI18n();
  const labels: Record<string, string> = {
    successRate: t('analytics.chart.successRate'),
    latency: t('analytics.chart.latency'),
  };

  const tooltipFormatter = (value: ValueType, name: NameType): [number | string, string] => {
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    const displayValue =
      typeof normalizedValue === 'number' || typeof normalizedValue === 'string'
        ? normalizedValue
        : 0;
    const normalizedName = typeof name === 'string' ? name : String(name ?? '');
    const label = labels[normalizedName] || normalizedName;
    return [displayValue, label];
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="timestamp" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => safeDate(value, { timeStyle: 'short' })}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(value) => (value ? safeDate(value) : '')}
          formatter={tooltipFormatter}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="successRate"
          stroke={chartColors.success}
          strokeWidth={2}
          name={labels.successRate}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="latency"
          stroke={chartColors.info}
          strokeWidth={2}
          name={labels.latency}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
