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
  Legend,
} from 'recharts';
import { useAdminI18n } from '@/lib/i18n';

export interface InvoiceChartDataPoint {
  month: string;
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
}

interface InvoiceChartProps {
  data: InvoiceChartDataPoint[];
}

const COLORS = {
  draft: '#9CA3AF',
  sent: '#3B82F6',
  paid: '#10B981',
  overdue: '#DC2626',
};

export const InvoiceChart = memo<InvoiceChartProps>(function InvoiceChart({ data }) {
  const { t } = useAdminI18n();
  const isEmpty = useMemo(() => !data || data.length === 0, [data]);

  if (isEmpty) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60">
        <p className="text-sm text-slate-500">{t('chart.empty.invoices')}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6B7280' }}
          axisLine={{ stroke: '#E5E7EB' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
        />
        <Bar dataKey="draft" name={t('chart.legend.draft')} fill={COLORS.draft} radius={[2, 2, 0, 0]} />
        <Bar dataKey="sent" name={t('chart.legend.sent')} fill={COLORS.sent} radius={[2, 2, 0, 0]} />
        <Bar dataKey="paid" name={t('chart.legend.paid')} fill={COLORS.paid} radius={[2, 2, 0, 0]} />
        <Bar dataKey="overdue" name={t('chart.legend.overdue')} fill={COLORS.overdue} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
});

InvoiceChart.displayName = 'InvoiceChart';
