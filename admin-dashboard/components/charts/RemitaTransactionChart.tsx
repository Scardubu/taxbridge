'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAdminI18n } from '@/lib/i18n';
import { chartColors } from '@/lib/colors';

interface RemitaTransactionData {
  date: string;
  successful: number;
  failed: number;
  pending: number;
  total: number;
}

interface RemitaTransactionChartProps {
  data: RemitaTransactionData[];
}

export function RemitaTransactionChart({ data }: RemitaTransactionChartProps) {
  const { t } = useAdminI18n();
  const labels: Record<string, string> = {
    successful: t('analytics.chart.successful'),
    pending: t('analytics.chart.pending'),
    failed: t('analytics.chart.failed'),
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          labelFormatter={(value) => new Date(value).toLocaleDateString()}
          formatter={(value: number | undefined, name: string | undefined) => {
            const label = name ? labels[name] || name : '';
            return [value || 0, label];
          }}
        />
        <Bar dataKey="successful" stackId="a" fill={chartColors.success} name={labels.successful} />
        <Bar dataKey="pending" stackId="a" fill={chartColors.warning} name={labels.pending} />
        <Bar dataKey="failed" stackId="a" fill={chartColors.error} name={labels.failed} />
      </BarChart>
    </ResponsiveContainer>
  );
}
