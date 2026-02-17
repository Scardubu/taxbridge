'use client';

import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  CreditCard,
  Receipt,
  Shield,
  Activity,
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';

interface UserDetail {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  tin?: string;
  cacNumber?: string;
  bvn?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  businessType: string;
  status: 'active' | 'pending' | 'suspended';
  onboardingComplete: boolean;
  verifiedAt?: string;
  createdAt: string;
  lastActive?: string;
  stats: {
    invoiceCount: number;
    totalRevenue: number;
    paymentCount: number;
    expenseCount: number;
    employeeCount: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useAdminI18n();
  const userId = params?.id as string;

  const { data, error, isLoading, mutate } = useSWR<UserDetail>(
    userId ? `/api/admin/users/${userId}` : null,
    fetcher,
    { refreshInterval: 30000, errorRetryCount: 3 }
  );

  const getStatusBadge = (status: UserDetail['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />{t('userDetail.status.active')}
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />{t('userDetail.status.pending')}
          </Badge>
        );
      case 'suspended':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200">
            <XCircle className="w-3 h-3 mr-1" />{t('userDetail.status.suspended')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />{t('userDetail.back')}
          </Button>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('userDetail.error.title')}</AlertTitle>
            <AlertDescription>
              {error instanceof FetchError ? error.message : t('userDetail.error.loadFailed')}
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading || !data) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />{t('userDetail.back')}
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-4 bg-muted rounded w-1/3" /></CardHeader>
                <CardContent><div className="h-8 bg-muted rounded w-1/2" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />{t('userDetail.back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{data.businessName}</h1>
              <p className="text-sm text-muted-foreground">{data.email}</p>
            </div>
            {getStatusBadge(data.status)}
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="w-4 h-4 mr-2" />{t('userDetail.refresh')}
          </Button>
        </div>

        {/* Business Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />{t('userDetail.section.businessInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label={t('userDetail.label.businessName')} value={data.businessName} />
              <InfoRow label={t('userDetail.label.businessType')} value={data.businessType} />
              <InfoRow label={t('userDetail.label.tin')} value={data.tin || '—'} />
              <InfoRow label={t('userDetail.label.cacNumber')} value={data.cacNumber || '—'} />
              {data.address && (
                <InfoRow
                  label={t('userDetail.label.address')}
                  value={[data.address.street, data.address.city, data.address.state]
                    .filter(Boolean)
                    .join(', ') || '—'}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" />{t('userDetail.section.accountDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label={t('userDetail.label.email')} value={data.email} icon={<Mail className="w-3 h-3" />} />
              <InfoRow label={t('userDetail.label.phone')} value={data.phone} icon={<Phone className="w-3 h-3" />} />
              <InfoRow label={t('userDetail.label.registered')} value={formatDate(data.createdAt)} icon={<Calendar className="w-3 h-3" />} />
              <InfoRow label={t('userDetail.label.lastActive')} value={data.lastActive ? formatDate(data.lastActive) : '—'} />
              <InfoRow
                label={t('userDetail.label.onboarding')}
                value={data.onboardingComplete ? t('userDetail.label.complete') : t('userDetail.label.incomplete')}
              />
              {data.verifiedAt && (
                <InfoRow label={t('userDetail.label.verified')} value={formatDate(data.verifiedAt)} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} label={t('userDetail.stats.invoices')} value={data.stats.invoiceCount} />
          <StatCard icon={<CreditCard className="w-5 h-5 text-emerald-600" />} label={t('userDetail.stats.revenue')} value={formatCurrency(data.stats.totalRevenue)} />
          <StatCard icon={<Receipt className="w-5 h-5 text-purple-600" />} label={t('userDetail.stats.payments')} value={data.stats.paymentCount} />
          <StatCard icon={<Receipt className="w-5 h-5 text-orange-600" />} label={t('userDetail.stats.expenses')} value={data.stats.expenseCount} />
          <StatCard icon={<Building2 className="w-5 h-5 text-muted-foreground" />} label={t('userDetail.stats.employees')} value={data.stats.employeeCount} />
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />{t('userDetail.activity.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('userDetail.activity.empty')}</p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.timestamp)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{event.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {icon}{label}
      </span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
