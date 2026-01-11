import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from '../queue/client';
import USSDHandler from '../integrations/ussd/handler';

export default async function ussdRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;
  const handler = new USSDHandler(prisma);

  app.post('/ussd', async (req, reply) => {
    const body = req.body as any;
    const sessionId = body.sessionId || body.session_id || body.session;
    const phoneNumber = body.phoneNumber || body.phone || body.msisdn || body.msisdn;
    const text = body.text || '';
    const serviceCode = body.serviceCode || body.service_code || '';

    const response = await handler.handle({ sessionId, phoneNumber, text, serviceCode });
    reply.header('Content-Type', 'text/plain').send(response);
  });
}
