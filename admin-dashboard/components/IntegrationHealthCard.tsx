'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  provider?: string;
  latency?: number;
  error?: string;
  mode?: string;
  timestamp: string;
}

interface IntegrationsHealth {
  status: 'healthy' | 'degraded' | 'error';
  integrations: {
    duplo: HealthStatus;
    remita: HealthStatus;
  };
  timestamp: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    healthy: 'default',
    degraded: 'secondary',
    error: 'destructive',
  };

  const labels: Record<string, string> = {
    healthy: '✓ Healthy',
    degraded: '⚠ Degraded',
    error: '✕ Error',
  };

  return (
    <Badge variant={variants[status] || 'outline'}>
      {labels[status] || status}
    </Badge>
  );
}

function LatencyIndicator({ latency }: { latency?: number }) {
  if (!latency) return null;
  
  const color = latency < 100 ? 'text-green-600' : latency < 500 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <span className={`text-sm ${color}`}>
      {latency}ms
    </span>
  );
}

export default function IntegrationHealthCard() {
  const [health, setHealth] = useState<IntegrationsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/health/integrations');
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch health status';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Integration Health</span>
          {health && <StatusBadge status={health.status} />}
        </CardTitle>
        <CardDescription>
          Real-time status of external API integrations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && !health && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm py-2">
            {error}
          </div>
        )}

        {health && (
          <div className="space-y-4">
            {/* Duplo/DigiTax */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Duplo (DigiTax)</div>
                <div className="text-xs text-gray-500">
                  NRS e-Invoicing via NITDA-accredited APP
                </div>
                {health.integrations.duplo.mode === 'mock' && (
                  <Badge variant="outline" className="mt-1 text-xs">Mock Mode</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <LatencyIndicator latency={health.integrations.duplo.latency} />
                <StatusBadge status={health.integrations.duplo.status} />
              </div>
            </div>

            {/* Remita */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Remita</div>
                <div className="text-xs text-gray-500">
                  Payment gateway (RRR generation)
                </div>
                {health.integrations.remita.mode === 'mock' && (
                  <Badge variant="outline" className="mt-1 text-xs">Mock Mode</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <LatencyIndicator latency={health.integrations.remita.latency} />
                <StatusBadge status={health.integrations.remita.status} />
              </div>
            </div>

            {/* Last updated */}
            <div className="text-xs text-gray-400 text-right pt-2">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              <button 
                onClick={fetchHealth}
                className="ml-2 text-blue-500 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
