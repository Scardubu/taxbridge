'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
          formatter={(value: number | undefined, name: string | undefined) => [value || 0, name || '']}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="successRate"
          stroke="#10b981"
          strokeWidth={2}
          name="successRate"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="latency"
          stroke="#3b82f6"
          strokeWidth={2}
          name="latency"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
