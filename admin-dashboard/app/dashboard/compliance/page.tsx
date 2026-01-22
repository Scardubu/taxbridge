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
          if (err.status === 401 || err.status === 403) return false;
          return err.status >= 500;
        }
        return true;
      },
      errorRetryCount: 3,
    }
  );

  // Mock data for Stage 1 (DigiTax integration is in mock mode)
  const mockData: ComplianceData = {
    overview: {
      complianceRate: 94.2,
      totalInvoices: 156,
      compliantInvoices: 147,
      pendingReview: 6,
      nonCompliant: 3,
    },
    nrsStatus: {
      status: 'mock',
      lastSync: '2026-01-21T08:00:00Z',
      pendingSubmissions: 12,
    },
    recentIssues: [
      {
        id: '1',
        type: 'missing_tin',
        description: 'Customer TIN not provided for B2B invoice',
        invoiceId: 'INV-2026-0145',
        createdAt: '2026-01-21T07:30:00Z',
        resolved: false,
      },
      {
        id: '2',
        type: 'submission_failed',
        description: 'NRS submission timeout (mock mode)',
        invoiceId: 'INV-2026-0142',
        createdAt: '2026-01-20T16:45:00Z',
        resolved: true,
      },
      {
        id: '3',
        type: 'format_error',
        description: 'UBL validation warning: optional field missing',
        invoiceId: 'INV-2026-0138',
        createdAt: '2026-01-20T14:20:00Z',
        resolved: true,
      },
    ],
    exemptionStats: [
      { exemption: 'Zero-rated (Export)', count: 23, percentage: 14.7 },
      { exemption: 'Exempt (Medical)', count: 8, percentage: 5.1 },
      { exemption: 'Exempt (Educational)', count: 5, percentage: 3.2 },
      { exemption: 'Standard VAT (7.5%)', count: 120, percentage: 76.9 },
    ],
  };

  const displayData = data || mockData;

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
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Missing TIN</Badge>;
      case 'submission_failed':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Submission Failed</Badge>;
      case 'format_error':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Format Error</Badge>;
      case 'invalid_amount':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Invalid Amount</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
          <p className="text-slate-600 mt-1">Monitor NRS compliance and invoice validation</p>
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
                {period}
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
            Refresh
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
          NRS Integration: {displayData.nrsStatus.status === 'mock' ? 'Mock Mode (Stage 1)' : 
            displayData.nrsStatus.status === 'connected' ? 'Connected' : 'Error'}
        </AlertTitle>
        <AlertDescription className={
          displayData.nrsStatus.status === 'mock' ? 'text-blue-700' :
          displayData.nrsStatus.status === 'connected' ? 'text-emerald-700' : 'text-rose-700'
        }>
          {displayData.nrsStatus.status === 'mock' 
            ? 'DigiTax integration is running in mock mode for Stage 1 beta. Invoice submissions are simulated.' 
            : displayData.nrsStatus.status === 'connected'
              ? `Last sync: ${displayData.nrsStatus.lastSync ? new Date(displayData.nrsStatus.lastSync).toLocaleString() : 'Never'}`
              : 'Unable to connect to NRS. Please check configuration.'}
          {displayData.nrsStatus.pendingSubmissions > 0 && (
            <span className="ml-2 font-medium">
              ({displayData.nrsStatus.pendingSubmissions} pending submissions)
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
                <p className="text-sm font-medium text-slate-600">Compliance Rate</p>
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
                <p className="text-sm font-medium text-slate-600">Compliant</p>
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
                <p className="text-sm font-medium text-slate-600">Pending Review</p>
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
                <p className="text-sm font-medium text-slate-600">Non-Compliant</p>
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
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayData.recentIssues.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
                  <p>No compliance issues found</p>
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
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{issue.description}</p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>Invoice: {issue.invoiceId}</span>
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
              Tax Exemption Breakdown
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
          return 'Compliance monitoring is disabled for this environment. Showing mock data for Stage 1 beta.';
        }
        return `Failed to fetch compliance data: ${error.message}`;
      }
      return 'An unexpected error occurred';
    })();

    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Limited Functionality</AlertTitle>
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
