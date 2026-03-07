'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Users as UsersIcon, 
  Search, 
  RefreshCw, 
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';
import { useAdminI18n } from '@/lib/i18n';
import { safeDate } from '@/lib/utils';

interface User {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  tin?: string;
  status: 'active' | 'pending' | 'suspended';
  onboardingComplete: boolean;
  invoiceCount: number;
  createdAt: string;
  lastActive?: string;
}

interface UsersData {
  users: User[];
  total: number;
  stats: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

const extractErrorCode = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  return typeof record.code === 'string' ? record.code : undefined;
};

export default function UsersPage() {
  const { t } = useAdminI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, error, isLoading, mutate } = useSWR<UsersData>(
    '/api/admin/users',
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

  const getStatusBadge = (status: User['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />{t('users.filters.status.active')}</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="w-3 h-3 mr-1" />{t('users.filters.status.pending')}</Badge>;
      case 'suspended':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200"><XCircle className="w-3 h-3 mr-1" />{t('users.filters.status.suspended')}</Badge>;
      default:
        return null;
    }
  };

  const emptyData: UsersData = {
    users: [],
    total: 0,
    stats: { total: 0, active: 0, pending: 0, suspended: 0 },
  };

  const displayData = data || emptyData;

  const filteredUsers = displayData.users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.tin && user.tin.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (error) {
    const message = (() => {
      if (error instanceof FetchError) {
        const code = extractErrorCode(error.body);
        if (code === 'ADMIN_API_DISABLED') {
          return t('users.limited.disabled');
        }
        if (code === 'BACKEND_NOT_CONFIGURED') {
          return t('users.limited.backendNotConfigured');
        }
        return t('users.error.fetch', { message: error.message });
      }
      return t('common.unexpectedError');
    })();

    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="default" className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">{t('users.limited.title')}</AlertTitle>
            <AlertDescription className="text-amber-700">
              {message}
            </AlertDescription>
          </Alert>
          <UsersContent 
            data={emptyData} 
            filteredUsers={[]}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            getStatusBadge={getStatusBadge}
            onRefresh={() => mutate()}
            isLoading={false}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <UsersContent 
        data={displayData} 
        filteredUsers={filteredUsers}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        getStatusBadge={getStatusBadge}
        onRefresh={() => mutate()}
        isLoading={isLoading}
      />
    </DashboardLayout>
  );
}

interface UsersContentProps {
  data: UsersData;
  filteredUsers: User[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  getStatusBadge: (status: User['status']) => React.ReactNode;
  onRefresh: () => void;
  isLoading: boolean;
}

function UsersContent({ 
  data, 
  filteredUsers, 
  searchQuery, 
  setSearchQuery, 
  statusFilter, 
  setStatusFilter,
  getStatusBadge,
  onRefresh,
  isLoading
}: UsersContentProps) {
  const { t } = useAdminI18n();

  const statusLabel = (status: string) => {
    switch (status) {
      case 'all':
        return t('users.filters.status.all');
      case 'active':
        return t('users.filters.status.active');
      case 'pending':
        return t('users.filters.status.pending');
      case 'suspended':
        return t('users.filters.status.suspended');
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('users.title')}</h1>
          <p className="text-slate-600 mt-1">{t('users.subtitle')}</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('users.stats.total')}</p>
                <p className="text-2xl font-bold text-slate-900">{data.stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <UsersIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{t('users.stats.active')}</p>
                <p className="text-2xl font-bold text-emerald-600">{data.stats.active}</p>
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
                <p className="text-sm font-medium text-slate-600">{t('users.stats.pending')}</p>
                <p className="text-2xl font-bold text-amber-600">{data.stats.pending}</p>
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
                <p className="text-sm font-medium text-slate-600">{t('users.stats.suspended')}</p>
                <p className="text-2xl font-bold text-rose-600">{data.stats.suspended}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="users-search"
                name="search"
                placeholder={t('users.filters.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label={t('users.filters.searchPlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              {['all', 'active', 'pending', 'suspended'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="capitalize"
                >
                  {statusLabel(status)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            {t('users.list.title', { count: filteredUsers.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {t('users.empty')}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{user.businessName}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {t('users.list.invoiceCount', { count: user.invoiceCount })}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {t('users.list.joined', { date: safeDate(user.createdAt, { dateStyle: 'short' }) })}
                      </p>
                    </div>
                    {getStatusBadge(user.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
