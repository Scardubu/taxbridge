/**
 * Feature Flags API Route
 * 
 * Phase 3: Feature Flag System
 * 
 * Provides centralized feature flag management for mobile clients.
 * 
 * Endpoint: GET /api/v1/feature-flags
 * 
 * Response format:
 * {
 *   flags: {
 *     receiptsScanner: boolean,
 *     taxEngineV2: boolean,
 *     offlineInvoices: boolean,
 *     ocrScanner: boolean
 *   },
 *   lastUpdated: ISO timestamp
 * }
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

// Feature flags schema (mobile-specific flags)
const MobileFeatureFlagsSchema = z.object({
  receiptsScanner: z.boolean(),
  taxEngineV2: z.boolean(),
  offlineInvoices: z.boolean(),
  ocrScanner: z.boolean(),
});

type MobileFeatureFlags = z.infer<typeof MobileFeatureFlagsSchema>;

/**
 * Default feature flags (safe production defaults)
 * Can be overridden via environment variables
 */
function getDefaultFlags(): MobileFeatureFlags {
  return {
    receiptsScanner: process.env.FEATURE_RECEIPTS_SCANNER === 'true',
    taxEngineV2: process.env.FEATURE_TAX_ENGINE_V2 === 'true',
    offlineInvoices: process.env.FEATURE_OFFLINE_INVOICES !== 'false', // default true
    ocrScanner: process.env.FEATURE_OCR_SCANNER === 'true',
  };
}

/**
 * Feature flags route handler
 */
export default async function featureFlagsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/feature-flags
   * 
   * Returns current feature flags for mobile app
   * No authentication required (public endpoint)
   * Cached for 5 minutes
   */
  fastify.get(
    '/api/v1/feature-flags',
    {
      schema: {
        description: 'Get mobile app feature flags',
        tags: ['Feature Flags'],
        response: {
          200: {
            type: 'object',
            properties: {
              flags: {
                type: 'object',
                properties: {
                  receiptsScanner: { type: 'boolean' },
                  taxEngineV2: { type: 'boolean' },
                  offlineInvoices: { type: 'boolean' },
                  ocrScanner: { type: 'boolean' },
                },
              },
              lastUpdated: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const flags = getDefaultFlags();
      
      // Set cache headers (5 minutes)
      reply.header('Cache-Control', 'public, max-age=300');
      
      return {
        flags,
        lastUpdated: new Date().toISOString(),
      };
    }
  );

  /**
   * POST /api/v1/feature-flags (Admin only)
   * 
   * Update feature flags dynamically
   * Requires admin authentication
   * 
   * Note: This is for future use - currently flags are env-based only
   */
  fastify.post(
    '/api/v1/feature-flags',
    {
      schema: {
        description: 'Update feature flags (Admin only)',
        tags: ['Feature Flags', 'Admin'],
        body: {
          type: 'object',
          properties: {
            receiptsScanner: { type: 'boolean' },
            taxEngineV2: { type: 'boolean' },
            offlineInvoices: { type: 'boolean' },
            ocrScanner: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          501: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Check admin authentication
      const apiKey = request.headers['x-admin-api-key'];
      if (!apiKey) {
        return reply.code(401).send({ error: 'Admin authentication required' });
      }

      // Validate API key
      const validApiKeys = process.env.ADMIN_API_KEYS?.split(',').map(k => k.trim()) || [];
      if (!validApiKeys.includes(apiKey as string)) {
        return reply.code(401).send({ error: 'Invalid admin API key' });
      }

      // Dynamic flag updates not yet implemented
      // Flags are environment-based only for now
      return reply.code(501).send({
        error: 'Dynamic flag updates not implemented. Use environment variables.',
      });
    }
  );
}
