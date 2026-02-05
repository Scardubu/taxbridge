'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAdminI18n } from '@/lib/i18n';
import { chartColors } from '@/lib/colors';

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

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="timestamp" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(value) => new Date(value).toLocaleString()}
          formatter={(value: number | undefined, name: string | undefined) => {
            const label = name ? labels[name] || name : '';
            return [value || 0, label];
          }}
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
