import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { privacyService } from '../services/privacy';
import { logSecurityEvent } from '../lib/security';

const deleteRequestSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(10).max(500)
});

const consentUpdateSchema = z.object({
  userId: z.string().uuid(),
  consentType: z.enum(['data_processing', 'sms_marketing', 'ai_analytics']),
  granted: z.boolean()
});

export default async function privacyRoutes(app: FastifyInstance) {
  // Export user data (DSAR)
  app.get('/api/v1/privacy/export/:userId', async (request: FastifyRequest<{
    Params: { userId: string }
  }>, reply: FastifyReply) => {
    try {
      const { userId } = request.params;
      const data = await privacyService.exportUserData(userId);
      
      await logSecurityEvent('DSAR_EXPORT', { userId }, 'info');
      
      return reply.send({
        success: true,
        data
      });
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // Download portable data (CSV)
  app.get('/api/v1/privacy/download/:userId', async (request: FastifyRequest<{
    Params: { userId: string }
  }>, reply: FastifyReply) => {
    try {
      const { userId } = request.params;
      const csvBuffer = await privacyService.exportPortableData(userId);
      
      await logSecurityEvent('DATA_PORTABILITY_REQUEST', { userId }, 'info');
      
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="taxbridge-data-${userId}.csv"`);
      return reply.send(csvBuffer);
    } catch (error: any) {
      return reply.status(404).send({ error: error.message });
    }
  });

  // Delete user data (Right to erasure)
  app.post('/api/v1/privacy/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = deleteRequestSchema.parse(request.body);
      await privacyService.deleteUserData(body.userId, body.reason);
      
      await logSecurityEvent('DATA_DELETION_REQUEST', { userId: body.userId, reason: body.reason }, 'warning');
      
      return reply.send({
        success: true,
        message: 'User data has been anonymized'
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Update consent
  app.post('/api/v1/privacy/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = consentUpdateSchema.parse(request.body);
      await privacyService.updateConsent(body.userId, body.consentType, body.granted);
      
      await logSecurityEvent(
        'CONSENT_UPDATED',
        { userId: body.userId, consentType: body.consentType, granted: body.granted },
        'info'
      );
      
      return reply.send({
        success: true,
        message: 'Consent updated successfully'
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Check consent
  app.get('/api/v1/privacy/consent/:userId/:consentType', async (request: FastifyRequest<{
    Params: { userId: string; consentType: string }
  }>, reply: FastifyReply) => {
    try {
      const { userId, consentType } = request.params;
      const hasConsent = await privacyService.hasConsent(userId, consentType);
      
      return reply.send({
        success: true,
        hasConsent
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });
}
