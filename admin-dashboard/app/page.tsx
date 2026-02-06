'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Users, FileText, CreditCard, TrendingUp, Shield } from 'lucide-react';
import { useAdminI18n } from '@/lib/i18n';

export default function Home() {
  const router = useRouter();
  const { t } = useAdminI18n();

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            {t('home.title')}
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.systemHealth.title')}</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{t('home.card.systemHealth.value')}</div>
              <p className="text-xs text-slate-500">{t('home.card.systemHealth.subtext')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.activeUsers.title')}</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{t('home.card.loading')}</div>
              <p className="text-xs text-slate-500">{t('home.card.redirecting')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.complianceRate.title')}</CardTitle>
              <Shield className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{t('home.card.loading')}</div>
              <p className="text-xs text-slate-500">{t('home.card.complianceRate.subtext')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.invoices.title')}</CardTitle>
              <FileText className="h-4 w-4 text-amber-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">{t('home.card.loading')}</div>
              <p className="text-xs text-slate-500">{t('home.card.redirecting')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.payments.title')}</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{t('home.card.loading')}</div>
              <p className="text-xs text-slate-500">{t('home.card.redirecting')}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{t('home.card.growth.title')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{t('home.card.loading')}</div>
              <p className="text-xs text-slate-500">{t('home.card.redirecting')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
            <p className="text-lg text-slate-600">{t('home.redirecting')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center mt-8">
          <Button 
            onClick={() => router.push('/dashboard')}
            size="lg"
            className="bg-slate-900 hover:bg-slate-800 text-white px-8"
          >
            {t('home.cta')}
          </Button>
        </div>
      </div>
    </div>
  );
}
