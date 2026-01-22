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
  Settings, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  Database,
  Wifi,
  HardDrive,
  Activity,
  Clock,
  Zap,
  Globe
} from 'lucide-react';
import { FetchError, fetchJson } from '@/lib/fetcher';

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'error';
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'error';
    latency?: number;
    message?: string;
    lastCheck: string;
  }>;
  metrics: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
  };
  integrations: {
    digitax: { status: 'connected' | 'mock' | 'error'; latency?: number };
    remita: { status: 'connected' | 'mock' | 'error'; latency?: number };
    supabase: { status: 'connected' | 'error'; latency?: number };
    redis: { status: 'connected' | 'error'; latency?: number };
  };
  recentEvents: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

const fetcher = <T,>(url: string): Promise<T> => fetchJson<T>(url);

const extractErrorCode = (body: unknown): string | undefined => {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  return typeof record.code === 'string' ? record.code : undefined;
};

export default function SystemPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, error, isLoading, mutate } = useSWR<SystemHealth>(
    '/api/admin/health',
    fetcher,
    {
      refreshInterval: autoRefresh ? 30000 : 0,
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

  // Mock data for Stage 1
  const mockData: SystemHealth = {
    overall: 'healthy',
    services: [
      { name: 'API Server', status: 'healthy', latency: 45, lastCheck: new Date().toISOString() },
      { name: 'Database', status: 'healthy', latency: 12, lastCheck: new Date().toISOString() },
      { name: 'Cache (Redis)', status: 'healthy', latency: 3, lastCheck: new Date().toISOString() },
      { name: 'Job Queue', status: 'healthy', latency: 8, lastCheck: new Date().toISOString() },
      { name: 'DigiTax (Mock)', status: 'healthy', message: 'Running in mock mode', latency: 150, lastCheck: new Date().toISOString() },
      { name: 'Remita (Sandbox)', status: 'healthy', message: 'Using sandbox environment', latency: 230, lastCheck: new Date().toISOString() },
    ],
    metrics: {
      uptime: 99.95,
      cpuUsage: 23,
      memoryUsage: 56,
      diskUsage: 34,
      activeConnections: 47,
    },
    integrations: {
      digitax: { status: 'mock', latency: 150 },
      remita: { status: 'mock', latency: 230 },
      supabase: { status: 'connected', latency: 12 },
      redis: { status: 'connected', latency: 3 },
    },
    recentEvents: [
      { id: '1', type: 'info', message: 'System health check passed', timestamp: new Date().toISOString() },
      { id: '2', type: 'info', message: 'DigiTax mock mode active', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '3', type: 'warning', message: 'High latency detected on external API (recovered)', timestamp: new Date(Date.now() - 7200000).toISOString() },
    ],
  };

  const displayData = data || mockData;

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'error' | 'connected' | 'mock') => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'mock':
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: 'healthy' | 'degraded' | 'error' | 'connected' | 'mock') => {
    switch (status) {
      case 'healthy':
      case 'connected':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Healthy</Badge>;
      case 'mock':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Mock Mode</Badge>;
      case 'degraded':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Degraded</Badge>;
      case 'error':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Error</Badge>;
      default:
        return null;
    }
  };

  const getEventIcon = (type: 'info' | 'warning' | 'error') => {
    switch (type) {
      case 'info':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-rose-600" />;
    }
  };

  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Status</h1>
          <p className="text-slate-600 mt-1">Monitor infrastructure health and integrations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
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

      {/* Overall Status Banner */}
      <Alert 
        variant="default" 
        className={displayData.overall === 'healthy' 
          ? 'border-emerald-200 bg-emerald-50' 
          : displayData.overall === 'degraded' 
            ? 'border-amber-200 bg-amber-50'
            : 'border-rose-200 bg-rose-50'
        }
      >
        {getStatusIcon(displayData.overall)}
        <AlertTitle className={
          displayData.overall === 'healthy' ? 'text-emerald-800' :
          displayData.overall === 'degraded' ? 'text-amber-800' : 'text-rose-800'
        }>
          System Status: {displayData.overall === 'healthy' ? 'All Systems Operational' : 
            displayData.overall === 'degraded' ? 'Degraded Performance' : 'System Issues Detected'}
        </AlertTitle>
        <AlertDescription className={
          displayData.overall === 'healthy' ? 'text-emerald-700' :
          displayData.overall === 'degraded' ? 'text-amber-700' : 'text-rose-700'
        }>
          Uptime: {displayData.metrics.uptime}% • Last checked: {new Date().toLocaleTimeString()}
        </AlertDescription>
      </Alert>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Uptime</p>
                <p className="text-2xl font-bold text-emerald-600">{displayData.metrics.uptime}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">CPU</p>
                <p className="text-2xl font-bold text-slate-900">{displayData.metrics.cpuUsage}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Server className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <Progress value={displayData.metrics.cpuUsage} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Memory</p>
                <p className="text-2xl font-bold text-slate-900">{displayData.metrics.memoryUsage}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <Progress value={displayData.metrics.memoryUsage} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Disk</p>
                <p className="text-2xl font-bold text-slate-900">{displayData.metrics.diskUsage}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <Progress value={displayData.metrics.diskUsage} className="mt-3 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Connections</p>
                <p className="text-2xl font-bold text-slate-900">{displayData.metrics.activeConnections}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center">
                <Wifi className="h-5 w-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayData.services.map((service, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <p className="font-medium text-slate-900">{service.name}</p>
                      {service.message && (
                        <p className="text-xs text-slate-500">{service.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {service.latency !== undefined && (
                      <span className="text-sm text-slate-500">{service.latency}ms</span>
                    )}
                    {getStatusBadge(service.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              External Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(displayData.integrations).map(([name, info]) => (
                <div 
                  key={name} 
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(info.status)}
                    <div>
                      <p className="font-medium text-slate-900 capitalize">{name}</p>
                      {info.status === 'mock' && (
                        <p className="text-xs text-slate-500">Running in mock/sandbox mode</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {info.latency !== undefined && (
                      <span className="text-sm text-slate-500">{info.latency}ms</span>
                    )}
                    {getStatusBadge(info.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-600" />
              Recent Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayData.recentEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No recent events
                </div>
              ) : (
                displayData.recentEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      event.type === 'error' ? 'border-rose-200 bg-rose-50' :
                      event.type === 'warning' ? 'border-amber-200 bg-amber-50' :
                      'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {getEventIcon(event.type)}
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">{event.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
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
          return 'System monitoring is disabled for this environment. Showing mock data for Stage 1 beta.';
        }
        return `Failed to fetch system status: ${error.message}`;
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
