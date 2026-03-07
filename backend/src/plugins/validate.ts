/**
 * validate preHandler factory — TaxBridge V13 Sovereign
 *
 * Usage: preHandler: [..., validate(MyZodSchema)]
 *
 * C-11: reply.code(400).send({ error:'VALIDATION_ERROR', issues: result.error.issues })
 *       '.issues' not '.errors'
 * C-34: validate() preHandler on all POST/PATCH mutation routes
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema }                 from 'zod';

export function validate<T extends ZodSchema>(schema: T) {
  return async function validateHandler(
    request: FastifyRequest,
    reply:   FastifyReply,
  ) {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({
        error:  'VALIDATION_ERROR',
        issues: result.error.issues,
      });
    }
    // Replace body with parsed (typed) data
    (request as any).body = result.data;
  };
}
