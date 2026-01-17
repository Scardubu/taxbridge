'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DuploHealthChart } from '@/components/charts/DuploHealthChart';
import { RemitaTransactionChart } from '@/components/charts/RemitaTransactionChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, PieLabelRenderProps } from 'recharts';
import { Download, TrendingUp, Users, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';

interface AnalyticsData {
  overview: {
    totalUsers: number;
    totalInvoices: number;
    totalPayments: number;
    complianceRate: number;
    monthlyGrowth: number;
  };
  duploMetrics: {
    successTrend: Array<{
      timestamp: string;
      successRate: number;
      latency: number;
      submissions: number;
    }>;
    errorBreakdown: Array<{
      error: string;
      count: number;
      percentage: number;
    }>;
    dailySubmissions: Array<{
      date: string;
      successful: number;
      failed: number;
    }>;
  };
  remitaMetrics: {
    transactionTrend: Array<{
      date: string;
      successful: number;
      failed: number;
      pending: number;
      total: number;
    }>;
    paymentBreakdown: Array<{
      status: string;
      count: number;
      amount: number;
    }>;
    dailyVolume: Array<{
      date: string;
      volume: number;
      count: number;
    }>;
  };
  complianceMetrics: {
    exemptionUtilization: Array<{
      exemption: string;
      count: number;
      percentage: number;
    }>;
    withholdingTaxTracking: Array<{
      month: string;
      wthAmount: number;
      invoiceCount: number;
    }>;
    nrsComplianceTrend: Array<{
      date: string;
      compliant: number;
      nonCompliant: number;
    }>;
  };
}

const fetcher = (url: string): Promise<AnalyticsData> => fetchJson(url) as Promise<AnalyticsData>;

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d'); // 7d, 30d, 90d

  const { data: analytics, error } = useSWR<AnalyticsData, FetchError>(
    `/api/admin/analytics?range=${dateRange}`,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderCustomLabel = (props: PieLabelRenderProps) => {
    const { payload } = props;
    if (!payload) return null;
    const data = payload as { exemption: string; percentage: number };
    return `${data.exemption}: ${data.percentage}%`;
  };
  const renderErrorLabel = (props: PieLabelRenderProps) => {
    const { payload } = props;
    if (!payload) return null;
    const data = payload as { error: string; percentage: number };
    return `${data.error}: ${data.percentage}%`;
  };

  if (error) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTitle>Failed to load analytics</AlertTitle>
          <AlertDescription>
            {error instanceof FetchError ? error.message : 'An unexpected error occurred'}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  if (!analytics) {
    return (
      <DashboardLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into TaxBridge operations and compliance
          </p>
        </div>
        <div className="flex gap-2">
          <label htmlFor="date-range-select" className="sr-only">Select date range</label>
          <select 
            id="date-range-select"
            aria-label="Select date range"
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button 
            variant="outline"
            onClick={() => exportToCSV(analytics.duploMetrics.successTrend, 'duplo-metrics.csv')}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +{analytics.overview.monthlyGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalInvoices.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              NRS compliant submissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.totalPayments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Via Remita integration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.complianceRate}%</div>
            <p className="text-xs text-muted-foreground">
              NRS 2026 compliance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{analytics.overview.monthlyGrowth}%</div>
            <p className="text-xs text-muted-foreground">
              User acquisition
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Duplo Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Duplo E-Invoicing Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <DuploHealthChart data={analytics.duploMetrics.successTrend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Duplo Error Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.duploMetrics.errorBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderErrorLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.duploMetrics.errorBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Remita Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Remita Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <RemitaTransactionChart data={analytics.remitaMetrics.transactionTrend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remita Payment Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.remitaMetrics.paymentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip formatter={(value: number | undefined) => [`₦${(value || 0).toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Exemption Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.complianceMetrics.exemptionUtilization}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.complianceMetrics.exemptionUtilization.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Withholding Tax Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.complianceMetrics.withholdingTaxTracking}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: number | undefined, name: string | undefined) => [
                        name === 'wthAmount' ? `₦${(value || 0).toLocaleString()}` : value,
                        name === 'wthAmount' ? 'WHT Amount' : 'Invoice Count'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="wthAmount" stroke="#10b981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="invoiceCount" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>NRS Compliance Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.complianceMetrics.nrsComplianceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="compliant" stackId="a" fill="#10b981" name="Compliant" />
                    <Bar dataKey="nonCompliant" stackId="a" fill="#ef4444" name="Non-Compliant" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Duplo Daily Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.duploMetrics.dailySubmissions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="successful" stackId="a" fill="#10b981" name="Successful" />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remita Daily Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.remitaMetrics.dailyVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: number | undefined, name: string | undefined) => [
                        name === 'volume' ? `₦${(value || 0).toLocaleString()}` : value,
                        name === 'volume' ? 'Volume' : 'Count'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
}
