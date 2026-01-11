import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import axios from 'axios';
import { getRedisConnection } from '../queue/client';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'error';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthRouteOptions {
  prisma: any;
}

/**
 * Health check routes for TaxBridge production monitoring
 * Provides integration-specific health endpoints for Duplo and Remita
 */
export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify: FastifyInstance,
  opts: HealthRouteOptions
) => {
  const { prisma } = opts;

  // Base health check
  fastify.get('/health', async (request, reply) => {
    const checks: Record<string, HealthCheckResult> = {};

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy' };
    } catch (error: any) {
      checks.database = { status: 'error', error: error.message };
    }

    // Redis check
    try {
      const redis = getRedisConnection();
      await redis.ping();
      checks.redis = { status: 'healthy' };
    } catch (error: any) {
      checks.redis = { status: 'degraded', error: error.message };
    }

    const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
      ? 'healthy'
      : Object.values(checks).some(c => c.status === 'error')
        ? 'error'
        : 'degraded';

    return reply.code(overallStatus === 'healthy' ? 200 : 503).send({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // Duplo/DigiTax health check
  fastify.get('/health/duplo', async (request, reply) => {
    const startTime = Date.now();
    const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'false').toLowerCase() === 'true';

    if (mockMode) {
      return reply.send({
        status: 'healthy',
        provider: 'duplo',
        mode: 'mock',
        latency: 1,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const duploUrl = process.env.DUPLO_API_URL || 'https://api.duplo.co';
      
      // Attempt OAuth token exchange to verify connectivity
      const response = await axios.post(
        `${duploUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: process.env.DUPLO_CLIENT_ID,
          client_secret: process.env.DUPLO_CLIENT_SECRET,
        },
        {
          timeout: 5000,
          validateStatus: () => true, // Accept all status codes
        }
      );

      const latency = Date.now() - startTime;

      if (response.status === 200 || response.status === 201) {
        return reply.send({
          status: 'healthy',
          provider: 'duplo',
          latency,
          timestamp: new Date().toISOString(),
        });
      } else if (response.status === 401 || response.status === 403) {
        return reply.code(503).send({
          status: 'degraded',
          provider: 'duplo',
          error: 'Authentication failed - check credentials',
          latency,
          timestamp: new Date().toISOString(),
        });
      } else {
        return reply.code(503).send({
          status: 'degraded',
          provider: 'duplo',
          error: `Unexpected status: ${response.status}`,
          latency,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return reply.code(503).send({
        status: 'error',
        provider: 'duplo',
        error: error.message || 'Connection failed',
        latency,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Remita health check
  fastify.get('/health/remita', async (request, reply) => {
    const startTime = Date.now();
    const mockMode = String(process.env.REMITA_MOCK_MODE || 'false').toLowerCase() === 'true';

    if (mockMode) {
      return reply.send({
        status: 'healthy',
        provider: 'remita',
        mode: 'mock',
        latency: 1,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const remitaUrl = process.env.REMITA_API_URL || 'https://remitademo.net';
      
      // Ping Remita gateway
      const response = await axios.get(`${remitaUrl}/remita/ecomm/init.reg`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      const latency = Date.now() - startTime;

      // 400/405 is expected when hitting without proper params - means API is reachable
      if ([200, 400, 405, 404].includes(response.status)) {
        return reply.send({
          status: 'healthy',
          provider: 'remita',
          latency,
          timestamp: new Date().toISOString(),
        });
      } else if (response.status >= 500) {
        return reply.code(503).send({
          status: 'error',
          provider: 'remita',
          error: 'Remita API unavailable',
          latency,
          timestamp: new Date().toISOString(),
        });
      } else {
        return reply.code(503).send({
          status: 'degraded',
          provider: 'remita',
          error: `HTTP ${response.status}`,
          latency,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return reply.code(503).send({
        status: 'error',
        provider: 'remita',
        error: error.message || 'Connection failed',
        latency,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Combined integrations health check
  fastify.get('/health/integrations', async (request, reply) => {
    const [duploResponse, remitaResponse] = await Promise.allSettled([
      fastify.inject({ method: 'GET', url: '/health/duplo' }),
      fastify.inject({ method: 'GET', url: '/health/remita' }),
    ]);

    const duplo = duploResponse.status === 'fulfilled' 
      ? JSON.parse(duploResponse.value.body)
      : { status: 'error', error: 'Check failed' };
    
    const remita = remitaResponse.status === 'fulfilled'
      ? JSON.parse(remitaResponse.value.body)
      : { status: 'error', error: 'Check failed' };

    const overallStatus = 
      duplo.status === 'healthy' && remita.status === 'healthy' ? 'healthy' :
      duplo.status === 'error' || remita.status === 'error' ? 'error' : 'degraded';

    return reply.code(overallStatus === 'healthy' ? 200 : 503).send({
      status: overallStatus,
      integrations: { duplo, remita },
      timestamp: new Date().toISOString(),
    });
  });
};

export default healthRoutes;
