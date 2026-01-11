'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
          formatter={(value: number | undefined, name: string | undefined) => [value || 0, name || '']}
        />
        <Bar dataKey="successful" stackId="a" fill="#10b981" name="successful" />
        <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="pending" />
        <Bar dataKey="failed" stackId="a" fill="#ef4444" name="failed" />
      </BarChart>
    </ResponsiveContainer>
  );
}
