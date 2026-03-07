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
import { useAdminI18n } from '@/lib/i18n';
import { chartColors } from '@/lib/colors';

interface AnalyticsData {
  fallback?: boolean;
  warnings?: string[];
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
  const { t } = useAdminI18n();

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
          <AlertTitle>{t('analytics.error.title')}</AlertTitle>
          <AlertDescription>
            {error instanceof FetchError ? error.message : t('common.unexpectedError')}
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

  const COLORS = chartColors.palette;
  const isFallback = Boolean(analytics.fallback);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isFallback && analytics.warnings && analytics.warnings.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTitle className="text-amber-900">{t('dashboard.warnings.dataTitle')}</AlertTitle>
            <AlertDescription className="text-amber-800">
              <div className="space-y-1">
                {analytics.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>
                    {t(`dashboard.warnings.code.${warning}` as Parameters<typeof t>[0], { defaultValue: warning })}
                  </p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
            <p className="text-muted-foreground">
              {t('analytics.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <label htmlFor="date-range-select" className="sr-only">{t('analytics.dateRange.label')}</label>
          <select
            id="date-range-select"
            name="dateRange"
            aria-label={t('analytics.dateRange.label')}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7d">{t('analytics.dateRange.7d')}</option>
            <option value="30d">{t('analytics.dateRange.30d')}</option>
            <option value="90d">{t('analytics.dateRange.90d')}</option>
          </select>
          <Button 
            variant="outline"
            onClick={() => exportToCSV(analytics.duploMetrics.successTrend, 'duplo-metrics.csv')}
            disabled={isFallback}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('analytics.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.overview.totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analytics.overview.totalUsers ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              {t('analytics.overview.fromLastMonth', { percent: analytics.overview.monthlyGrowth })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.overview.totalInvoices')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analytics.overview.totalInvoices ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.overview.nrsCompliant')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.overview.totalPayments')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analytics.overview.totalPayments ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.overview.viaRemita')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.overview.complianceRate')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.complianceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.overview.nrs2026')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics.overview.monthlyGrowth')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{analytics.overview.monthlyGrowth}%</div>
            <p className="text-xs text-muted-foreground">
              {t('analytics.overview.userAcquisition')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">{t('analytics.tabs.integrations')}</TabsTrigger>
          <TabsTrigger value="compliance">{t('analytics.tabs.compliance')}</TabsTrigger>
          <TabsTrigger value="trends">{t('analytics.tabs.trends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Duplo Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.duplo.metrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <DuploHealthChart data={analytics.duploMetrics.successTrend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.duplo.errorBreakdown')}</CardTitle>
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
                      fill={chartColors.primary}
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
                <CardTitle>{t('analytics.remita.transactions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RemitaTransactionChart data={analytics.remitaMetrics.transactionTrend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.remita.breakdown')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.remitaMetrics.paymentBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`₦${Number(value || 0).toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" fill={chartColors.success} />
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
                <CardTitle>{t('analytics.compliance.exemptions')}</CardTitle>
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
                      fill={chartColors.primary}
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
                <CardTitle>{t('analytics.compliance.withholding')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.complianceMetrics.withholdingTaxTracking}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        name === 'wthAmount' ? `₦${Number(value || 0).toLocaleString()}` : value,
                        name === 'wthAmount' ? t('analytics.chart.wthAmount') : t('analytics.chart.invoiceCount')
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="wthAmount" stroke={chartColors.success} strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="invoiceCount" stroke={chartColors.info} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t('analytics.compliance.nrsTrend')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.complianceMetrics.nrsComplianceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="compliant" stackId="a" fill={chartColors.success} name={t('analytics.chart.compliant')} />
                    <Bar dataKey="nonCompliant" stackId="a" fill={chartColors.error} name={t('analytics.chart.nonCompliant')} />
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
                <CardTitle>{t('analytics.duplo.submissions')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.duploMetrics.dailySubmissions}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="successful" stackId="a" fill={chartColors.success} name={t('analytics.chart.successful')} />
                    <Bar dataKey="failed" stackId="a" fill={chartColors.error} name={t('analytics.chart.failed')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('analytics.remita.volume')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.remitaMetrics.dailyVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        name === 'volume' ? `₦${Number(value || 0).toLocaleString()}` : value,
                        name === 'volume' ? 'Volume' : 'Count'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="volume" stroke={chartColors.success} strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke={chartColors.info} strokeWidth={2} />
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
