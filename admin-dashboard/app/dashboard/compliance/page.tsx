'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  AlertCircle,
  TrendingUp,
  Calendar,
  Building2
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';

interface ComplianceData {
  overview: {
    complianceRate: number;
    totalInvoices: number;
    compliantInvoices: number;
    pendingReview: number;
    nonCompliant: number;
  };
  nrsStatus: {
    status: 'connected' | 'mock' | 'error';
    lastSync?: string;
    pendingSubmissions: number;
  };
  recentIssues: Array<{
    id: string;
    type: 'missing_tin' | 'invalid_amount' | 'format_error' | 'submission_failed';
    description: string;
    invoiceId: string;
    createdAt: string;
    resolved: boolean;
  }>;
  exemptionStats: Array<{
    exemption: string;
    count: number;
    percentage: number;
  }>;
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

const extractErrorCode = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  return typeof record.code === 'string' ? record.code : undefined;
};

export default function CompliancePage() {
  const { t } = useAdminI18n();
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  const { data, error, isLoading, mutate } = useSWR<ComplianceData>(
    `/api/admin/compliance?period=${selectedPeriod}`,
    fetcher,
    {
      refreshInterval: 60000,
      shouldRetryOnError: (err) => {
        if (err instanceof FetchError) {
          const code = extractErrorCode(err.body);
          if (code === 'ADMIN_API_DISABLED') return false;
          if (code === 'BACKEND_NOT_CONFIGURED') return false;
          if (err.status === 401 || err.status === 403) return false;
          return err.status >= 500;
        }
        return true;
      },
      errorRetryCount: 3,
    }
  );

  const emptyData: ComplianceData = {
    overview: {
      complianceRate: 0,
      totalInvoices: 0,
      compliantInvoices: 0,
      pendingReview: 0,
      nonCompliant: 0,
    },
    nrsStatus: {
      status: 'error',
      pendingSubmissions: 0,
    },
    recentIssues: [],
    exemptionStats: [],
  };

  const displayData = data || emptyData;

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing_tin':
        return <Building2 className="h-4 w-4 text-amber-600" />;
      case 'submission_failed':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'format_error':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-slate-600" />;
    }
  };

  const getIssueBadge = (type: string) => {
    switch (type) {
      case 'missing_tin':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{t('compliance.issue.missingTin')}</Badge>;
      case 'submission_failed':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">{t('compliance.issue.submissionFailed')}</Badge>;
      case 'format_error':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">{t('compliance.issue.formatError')}</Badge>;
      case 'invalid_amount':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">{t('compliance.issue.invalidAmount')}</Badge>;
      default:
        return <Badge variant="outline">{t('compliance.issue.unknown')}</Badge>;
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('compliance.title')}</h1>
          <p className="text-slate-600 mt-1">{t('compliance.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {['7d', '30d', '90d'].map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
              >
                {period === '7d'
                  ? t('compliance.range.7d')
                  : period === '30d'
                    ? t('compliance.range.30d')
                    : t('compliance.range.90d')}
              </Button>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('compliance.refresh')}
          </Button>
        </div>
      </div>

      {/* NRS Status Banner */}
      <Alert 
        variant="default" 
        className={displayData.nrsStatus.status === 'mock' 
          ? 'border-blue-200 bg-blue-50' 
          : displayData.nrsStatus.status === 'connected' 
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-rose-200 bg-rose-50'
        }
      >
        <Shield className={`h-4 w-4 ${
          displayData.nrsStatus.status === 'mock' ? 'text-blue-600' :
          displayData.nrsStatus.status === 'connected' ? 'text-emerald-600' : 'text-rose-600'
        }`} />
        <AlertTitle className={
          displayData.nrsStatus.status === 'mock' ? 'text-blue-800' :
          displayData.nrsStatus.status === 'connected' ? 'text-emerald-800' : 'text-rose-800'
        }>
          {t('compliance.nrs.title')}: {displayData.nrsStatus.status === 'mock'
            ? t('compliance.nrs.mock')
            : displayData.nrsStatus.status === 'connected'
              ? t('compliance.nrs.connected')
              : t('compliance.nrs.error')}
        </AlertTitle>
        <AlertDescription className={
          displayData.nrsStatus.status === 'mock' ? 'text-blue-700' :
          displayData.nrsStatus.status === 'connected' ? 'text-emerald-700' : 'text-rose-700'
        }>
          {displayData.nrsStatus.status === 'mock'
            ? t('compliance.nrs.mockDesc')
            : displayData.nrsStatus.status === 'connected'
              ? t('compliance.nrs.connectedDesc', {
                  time: displayData.nrsStatus.lastSync
                    ? new Date(displayData.nrsStatus.lastSync).toLocaleString()
                    : t('compliance.nrs.never'),
                })
              : t('compliance.nrs.errorDesc')}
          {displayData.nrsStatus.pendingSubmissions > 0 && (
            <span className="ml-2 font-medium">
              {t('compliance.nrs.pending', { count: displayData.nrsStatus.pendingSubmissions })}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('compliance.stats.complianceRate')}</p>
                <p className="text-2xl font-bold text-emerald-600">{displayData.overview.complianceRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <Progress value={displayData.overview.complianceRate} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('compliance.stats.compliant')}</p>
                <p className="text-2xl font-bold text-slate-900">{displayData.overview.compliantInvoices}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('compliance.stats.pendingReview')}</p>
                <p className="text-2xl font-bold text-amber-600">{displayData.overview.pendingReview}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('compliance.stats.nonCompliant')}</p>
                <p className="text-2xl font-bold text-rose-600">{displayData.overview.nonCompliant}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {t('compliance.issues.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayData.recentIssues.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
                  <p>{t('compliance.issues.none')}</p>
                </div>
              ) : (
                displayData.recentIssues.map((issue) => (
                  <div 
                    key={issue.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      issue.resolved ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    {getIssueIcon(issue.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getIssueBadge(issue.type)}
                        {issue.resolved && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {t('compliance.issues.resolved')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{issue.description}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{t('compliance.issues.invoice', { id: issue.invoiceId })}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(issue.createdAt).toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exemption Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-blue-600" />
              {t('compliance.exemptions.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayData.exemptionStats.map((stat, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{stat.exemption}</span>
                    <span className="font-medium text-slate-900">
                      {stat.count} ({stat.percentage}%)
                    </span>
                  </div>
                  <Progress value={stat.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (error) {
    const message = (() => {
      if (error instanceof FetchError) {
        const code = extractErrorCode(error.body);
        if (code === 'ADMIN_API_DISABLED') {
          return t('compliance.limited.disabled');
        }
        if (code === 'BACKEND_NOT_CONFIGURED') {
          return t('compliance.limited.backendNotConfigured');
        }
        return t('compliance.error.fetch', { message: error.message });
      }
      return t('common.unexpectedError');
    })();

    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">{t('compliance.limited.title')}</AlertTitle>
            <AlertDescription className="text-amber-700">
              {message}
            </AlertDescription>
          </Alert>
          {content}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
