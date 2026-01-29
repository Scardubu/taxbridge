import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { privacyService } from '../services/privacy';
import { logSecurityEvent } from '../lib/security';

// JWT authentication helper
async function authenticate(request: FastifyRequest): Promise<string> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret) as { userId?: string };
      if (!decoded.userId) {
        throw new Error('Invalid token payload');
      }
      return decoded.userId;
    } catch (err) {
      if (secret === secrets[secrets.length - 1]) {
        throw new Error('Invalid or expired token');
      }
    }
  }

  throw new Error('Invalid or expired token');
}

const deleteRequestSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(10).max(500)
});

const consentUpdateSchema = z.object({
  userId: z.string().uuid(),
  consentType: z.enum(['data_processing', 'sms_marketing', 'ai_analytics', 'device_tracking']),
  granted: z.boolean()
});

export default async function privacyRoutes(app: FastifyInstance) {
  // Export user data (DSAR)
  app.get('/api/v1/privacy/export/:userId', async (request: FastifyRequest<{
    Params: { userId: string }
  }>, reply: FastifyReply) => {
    try {
      const authenticatedUserId = await authenticate(request);
      const { userId } = request.params;
      
      // Verify ownership - user can only export their own data
      if (authenticatedUserId !== userId) {
        return reply.status(403).send({ error: 'Unauthorized: Cannot export data for another user' });
      }
      
      const data = await privacyService.exportUserData(userId);
      
      await logSecurityEvent('DSAR_EXPORT', { userId }, 'info');
      
      return reply.send({
        success: true,
        data
      });
    } catch (error: any) {
      if (error.message.includes('authorization')) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(404).send({ error: error.message });
    }
  });

  // Download portable data (CSV)
  app.get('/api/v1/privacy/download/:userId', async (request: FastifyRequest<{
    Params: { userId: string }
  }>, reply: FastifyReply) => {
    try {
      const authenticatedUserId = await authenticate(request);
      const { userId } = request.params;
      
      // Verify ownership - user can only download their own data
      if (authenticatedUserId !== userId) {
        return reply.status(403).send({ error: 'Unauthorized: Cannot download data for another user' });
      }
      
      const csvBuffer = await privacyService.exportPortableData(userId);
      
      await logSecurityEvent('DATA_PORTABILITY_REQUEST', { userId }, 'info');
      
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="taxbridge-data-${userId}.csv"`);
      return reply.send(csvBuffer);
    } catch (error: any) {
      if (error.message.includes('authorization')) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(404).send({ error: error.message });
    }
  });

  // Delete user data (Right to erasure)
  app.post('/api/v1/privacy/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedUserId = await authenticate(request);
      const body = deleteRequestSchema.parse(request.body);
      
      // Verify ownership - user can only delete their own data
      if (authenticatedUserId !== body.userId) {
        return reply.status(403).send({ error: 'Unauthorized: Cannot delete data for another user' });
      }
      
      await privacyService.deleteUserData(body.userId, body.reason);
      
      await logSecurityEvent('DATA_DELETION_REQUEST', { userId: body.userId, reason: body.reason }, 'warning');
      
      return reply.send({
        success: true,
        message: 'User data has been anonymized'
      });
    } catch (error: any) {
      if (error.message.includes('authorization')) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // Update consent
  app.post('/api/v1/privacy/consent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authenticatedUserId = await authenticate(request);
      const body = consentUpdateSchema.parse(request.body);
      
      // Verify ownership - user can only update their own consent
      if (authenticatedUserId !== body.userId) {
        return reply.status(403).send({ error: 'Unauthorized: Cannot update consent for another user' });
      }
      
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
      if (error.message.includes('authorization')) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });

  // Check consent
  app.get('/api/v1/privacy/consent/:userId/:consentType', async (request: FastifyRequest<{
    Params: { userId: string; consentType: string }
  }>, reply: FastifyReply) => {
    try {
      const authenticatedUserId = await authenticate(request);
      const { userId, consentType } = request.params;
      
      // Verify ownership - user can only check their own consent
      if (authenticatedUserId !== userId) {
        return reply.status(403).send({ error: 'Unauthorized: Cannot check consent for another user' });
      }
      
      const hasConsent = await privacyService.hasConsent(userId, consentType);
      
      return reply.send({
        success: true,
        hasConsent
      });
    } catch (error: any) {
      if (error.message.includes('authorization')) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(400).send({ error: error.message });
    }
  });
}
