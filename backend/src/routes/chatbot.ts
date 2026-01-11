import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import TaxChatbot from '../services/chatbot';
import AnalyticsService from '../services/analytics';
import { createLogger } from '../lib/logger';

const logger = createLogger('chatbot-routes');

const ChatQuerySchema = z.object({
  query: z.string().min(1).max(500),
  language: z.enum(['en', 'pidgin']).default('en'),
  userId: z.string().uuid().optional()
});

const ChatAnalyticsSchema = z.object({
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

export default async function chatbotRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();
  const chatbot = new TaxChatbot(prisma);
  const analytics = new AnalyticsService(prisma);

  // Main chat endpoint
  fastify.post(
    '/api/chatbot',
    {
      schema: {
        body: ChatQuerySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              confidence: { type: 'number' },
              source: { type: 'string' },
              apiAction: { type: 'string', nullable: true },
              apiData: { type: 'object', nullable: true },
              timestamp: { type: 'string' }
            }
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { query, language, userId } = ChatQuerySchema.parse(request.body);

        // Get chatbot response
        const response = await chatbot.getResponse(query, language, userId);

        // Log API action for compliance
        if (response.apiAction && userId) {
          await prisma.auditLog.create({
            data: {
              userId,
              action: `chatbot_${response.apiAction}`,
              metadata: {
                query,
                language,
                apiData: response.apiData,
                timestamp: new Date().toISOString()
              }
            }
          });
        }

        return reply.send({
          ...response,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Chatbot API error:', { err: error });
        
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Invalid request parameters',
            details: error.issues
          });
        }

        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );

  // Analytics endpoint
  fastify.get(
    '/api/chatbot/analytics',
    {
      schema: {
        querystring: ChatAnalyticsSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              totalQueries: { type: 'number' },
              queriesByLanguage: { type: 'array' },
              period: {
                type: 'object',
                properties: {
                  startDate: { type: 'string', nullable: true },
                  endDate: { type: 'string', nullable: true }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId, startDate, endDate } = ChatAnalyticsSchema.parse(request.query);
        
        const analyticsData = await analytics.getChatbotMetrics(
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );

        return reply.send(analyticsData);

      } catch (error) {
        logger.error('Chatbot analytics error:', { err: error });
        
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Invalid query parameters',
            details: error.issues
          });
        }

        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );

  // Health check for chatbot service
  fastify.get(
    '/api/chatbot/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              version: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  );

  // FAQ management endpoint (for admin use)
  fastify.get(
    '/api/chatbot/faqs',
    {
      schema: {
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question_en: { type: 'string' },
                question_pidgin: { type: 'string' },
                answer_en: { type: 'string' },
                answer_pidgin: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // This should be protected by admin authentication in production
        const complianceReport = await analytics.getComplianceReport(
          new Date(new Date().setMonth(new Date().getMonth() - 1)), // Last month
          new Date()
        );
        
        return reply.send({
          message: 'Compliance report endpoint - implement admin authentication',
          report: complianceReport
        });

      } catch (error) {
        logger.error('FAQ endpoint error:', { err: error });
        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );

  // Webhook for processing chatbot actions asynchronously
  fastify.post(
    '/api/chatbot/webhook',
    {
      schema: {
        body: z.object({
          action: z.string(),
          userId: z.string().uuid(),
          data: z.object({}).optional()
        })
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { action, userId, data } = request.body as any;

        // Log webhook for audit
        await prisma.auditLog.create({
          data: {
            userId,
            action: `chatbot_webhook_${action}`,
            metadata: {
              webhookData: data,
              timestamp: new Date().toISOString()
            }
          }
        });

        // Process different webhook actions
        switch (action) {
          case 'payment_completed':
            // Handle payment completion webhook
            if (data?.rrr) {
              await prisma.payment.updateMany({
                where: { 
                  rrr: data.rrr,
                  status: 'pending'
                },
                data: { 
                  status: 'paid',
                  paidAt: new Date()
                }
              });
            }
            break;

          case 'invoice_stamped':
            // Handle invoice stamping confirmation
            if (data?.nrsReference) {
              await prisma.invoice.updateMany({
                where: { 
                  nrsReference: data.nrsReference
                },
                data: { 
                  status: 'stamped',
                  updatedAt: new Date()
                }
              });
            }
            break;
        }

        return reply.send({
          status: 'processed',
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Chatbot webhook error:', { err: error });
        return reply.status(500).send({
          error: 'Webhook processing failed'
        });
      }
    }
  );
}
