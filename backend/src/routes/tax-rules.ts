/**
 * Tax Rules API Routes
 * 
 * GET /api/v1/tax/rules — Get all NTA 2025 tax rules
 * GET /api/v1/tax/rules/:type — Get specific tax type rules
 */

import type { FastifyInstance } from 'fastify';
import { NTA_2025_RULES } from '@taxbridge/contracts';

export default async function taxRulesRoutes(app: FastifyInstance) {
  
  /**
   * GET /api/v1/tax/rules
   * Returns all NTA 2025 tax rules
   */
  app.get('/api/v1/tax/rules', async (req, reply) => {
    return reply.send({
      success: true,
      data: {
        version: 'NTA 2025',
        effectiveDate: '2026-01-01',
        rules: NTA_2025_RULES,
      },
    });
  });

  /**
   * GET /api/v1/tax/rules/:type
   * Returns specific tax type rules (pit, vat, cit, cgt, wht, paye)
   */
  app.get<{
    Params: { type: string };
  }>('/api/v1/tax/rules/:type', async (req, reply) => {
    const { type } = req.params;
    const validTypes = ['pit', 'vat', 'cit', 'cgt', 'wht', 'paye', 'penalties', 'compliance'];
    
    if (!validTypes.includes(type)) {
      return reply.status(400).send({
        success: false,
        error: `Invalid tax type. Valid types: ${validTypes.join(', ')}`,
      });
    }

    const rules = NTA_2025_RULES[type as keyof typeof NTA_2025_RULES];
    
    return reply.send({
      success: true,
      data: {
        type,
        version: 'NTA 2025',
        effectiveDate: '2026-01-01',
        rules,
      },
    });
  });
}
