'use client';

import React, { useMemo, memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAdminI18n } from '@/lib/i18n';

export interface UserGrowthDataPoint {
  date: string;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
}

interface UserGrowthChartProps {
  data: UserGrowthDataPoint[];
}

const COLORS = {
  totalUsers: '#0B5FFF',
  newUsers: '#10B981',
  activeUsers: '#F59E0B',
};

export const UserGrowthChart = memo<UserGrowthChartProps>(function UserGrowthChart({ data }) {
  const { t } = useAdminI18n();
  const isEmpty = useMemo(() => !data || data.length === 0, [data]);

  if (isEmpty) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60">
        <p className="text-sm text-slate-500">{t('chart.empty.userGrowth')}</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="date"
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
        <Line
          type="monotone"
          dataKey="totalUsers"
          name={t('chart.legend.totalUsers')}
          stroke={COLORS.totalUsers}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="newUsers"
          name={t('chart.legend.newUsers')}
          stroke={COLORS.newUsers}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="activeUsers"
          name={t('chart.legend.activeUsers')}
          stroke={COLORS.activeUsers}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

UserGrowthChart.displayName = 'UserGrowthChart';
