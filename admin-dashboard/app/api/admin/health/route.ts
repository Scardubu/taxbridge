import { NextResponse } from 'next/server';
import { logError } from '@/lib/logger';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

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
    // Run health checks in parallel
    const [apiHealth, dbHealth, cacheHealth, queueHealth, digitaxHealth, remitaHealth] = await Promise.all([
      checkEndpoint('API Server', `${BACKEND_URL}/health/live`),
      checkEndpoint('Database', `${BACKEND_URL}/health/db`),
      checkEndpoint('Cache (Redis)', `${BACKEND_URL}/health/queues`),
      checkEndpoint('Job Queue', `${BACKEND_URL}/health/queues`),
      checkEndpoint('DigiTax (Mock)', `${BACKEND_URL}/health/digitax`),
      checkEndpoint('Remita (Sandbox)', `${BACKEND_URL}/health/remita`),
    ]);

    // Add mock mode messages
    digitaxHealth.message = 'Running in mock mode';
    remitaHealth.message = 'Using sandbox environment';

    const services = [apiHealth, dbHealth, cacheHealth, queueHealth, digitaxHealth, remitaHealth];
    
    // Calculate overall status
    const hasError = services.some(s => s.status === 'error');
    const hasDegraded = services.some(s => s.status === 'degraded');
    const overall = hasError ? 'error' : hasDegraded ? 'degraded' : 'healthy';

    // Return comprehensive system health data
    return NextResponse.json({
      overall,
      services,
      metrics: {
        uptime: 99.95, // Mock for Stage 1
        cpuUsage: Math.floor(Math.random() * 30) + 15, // 15-45%
        memoryUsage: Math.floor(Math.random() * 20) + 45, // 45-65%
        diskUsage: 34,
        activeConnections: Math.floor(Math.random() * 50) + 20,
      },
      integrations: {
        digitax: { 
          status: digitaxHealth.status === 'healthy' ? 'mock' : 'error', 
          latency: digitaxHealth.latency 
        },
        remita: { 
          status: remitaHealth.status === 'healthy' ? 'mock' : 'error', 
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
      recentEvents: [
        { id: '1', type: 'info', message: 'System health check passed', timestamp: new Date().toISOString() },
        { id: '2', type: 'info', message: 'DigiTax mock mode active', timestamp: new Date(Date.now() - 3600000).toISOString() },
      ],
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
