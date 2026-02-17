import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const HAS_BACKEND_URL = Boolean(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DIGITAX_MODE = IS_PRODUCTION ? 'live' : 'mock';
const REMITA_MODE = IS_PRODUCTION ? 'live' : 'sandbox';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'error';
  latency?: number;
  message?: string;
  lastCheck: string;
}

async function checkEndpoint(name: string, url: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    
    const latency = Date.now() - startTime;
    const status = response.ok ? 'healthy' : 'error';
    
    return {
      name,
      status,
      latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name,
      status: 'error',
      message: getErrorMessage(error),
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * GET /api/admin/health
 * Fetches overall backend health status with detailed service checks
 */
export async function GET() {
  try {
    if (!HAS_BACKEND_URL && process.env.VERCEL) {
      return NextResponse.json(
        {
          overall: 'error',
          services: [],
          metrics: {
            uptime: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            diskUsage: 0,
            activeConnections: 0,
          },
          integrations: {
            digitax: { status: 'error' },
            remita: { status: 'error' },
            supabase: { status: 'error' },
            redis: { status: 'error' },
          },
          recentEvents: [
            {
              id: '1',
              type: 'error',
              message: 'Backend URL is not configured for this environment',
              timestamp: new Date().toISOString(),
            },
          ],
          error: 'Backend URL is not configured for this environment',
          code: 'BACKEND_NOT_CONFIGURED',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Run health checks in parallel
    const digitaxLabel = `DigiTax (${DIGITAX_MODE})`;
    const remitaLabel = `Remita (${REMITA_MODE})`;
    const [apiHealth, dbHealth, cacheHealth, queueHealth, digitaxHealth, remitaHealth] = await Promise.all([
      checkEndpoint('API Server', `${BACKEND_URL}/health/live`),
      checkEndpoint('Database', `${BACKEND_URL}/health/db`),
      checkEndpoint('Cache (Redis)', `${BACKEND_URL}/health/queues`),
      checkEndpoint('Job Queue', `${BACKEND_URL}/health/queues`),
      checkEndpoint(digitaxLabel, `${BACKEND_URL}/health/digitax`),
      checkEndpoint(remitaLabel, `${BACKEND_URL}/health/remita`),
    ]);

    // Annotate integration mode
    if (!IS_PRODUCTION) {
      digitaxHealth.message = `Running in ${DIGITAX_MODE} mode`;
      remitaHealth.message = `Using ${REMITA_MODE} environment`;
    }

    const services = [apiHealth, dbHealth, cacheHealth, queueHealth, digitaxHealth, remitaHealth];
    
    // Calculate overall status
    const hasError = services.some(s => s.status === 'error');
    const hasDegraded = services.some(s => s.status === 'degraded');
    const overall = hasError ? 'error' : hasDegraded ? 'degraded' : 'healthy';

    // Return comprehensive system health data
    // Note: CPU/memory/disk metrics require the backend to expose a /metrics endpoint
    return NextResponse.json({
      overall,
      services,
      metrics: {
        uptime: null,
        cpuUsage: null,
        memoryUsage: null,
        diskUsage: null,
        activeConnections: null,
      },
      integrations: {
        digitax: { 
          status: digitaxHealth.status === 'healthy' ? DIGITAX_MODE : 'error', 
          latency: digitaxHealth.latency 
        },
        remita: { 
          status: remitaHealth.status === 'healthy' ? REMITA_MODE : 'error', 
          latency: remitaHealth.latency 
        },
        supabase: { 
          status: dbHealth.status === 'healthy' ? 'connected' : 'error', 
          latency: dbHealth.latency 
        },
        redis: { 
          status: cacheHealth.status === 'healthy' ? 'connected' : 'error', 
          latency: cacheHealth.latency 
        },
      },
      recentEvents: services
        .filter(s => s.status === 'error' || s.status === 'degraded')
        .map((s, i) => ({
          id: String(i + 1),
          type: s.status === 'error' ? 'error' : 'warning',
          message: `${s.name}: ${s.message || s.status}`,
          timestamp: s.lastCheck,
        })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logError('admin/api/health: Error fetching backend health', error);
    return NextResponse.json(
      {
        overall: 'error',
        services: [],
        metrics: {
          uptime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          activeConnections: 0,
        },
        integrations: {
          digitax: { status: 'error' },
          remita: { status: 'error' },
          supabase: { status: 'error' },
          redis: { status: 'error' },
        },
        recentEvents: [
          { id: '1', type: 'error', message: getErrorMessage(error), timestamp: new Date().toISOString() },
        ],
        error: getErrorMessage(error) || 'Failed to reach backend',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
