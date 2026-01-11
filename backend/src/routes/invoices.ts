import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

import { computeRequestHash } from '../lib/idempotency';
import { getInvoiceSyncQueue } from '../queue/client';

export default async function invoicesRoutes(app: FastifyInstance, opts: { prisma: PrismaClient }) {
  const prisma = opts.prisma;

  const InvoiceBodySchema = z.object({
    customerName: z.string().optional(),
    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive()
      })
    )
  });

  const InvoiceParamsSchema = z.object({ id: z.string().min(1) });

  const InvoiceListQuerySchema = z.object({
    status: z.string().optional(),
    cursor: z.string().optional(),
    take: z.coerce.number().int().positive().max(100).optional()
  });

  const InvoiceListResponseSchema = z.object({
    invoices: z.array(
      z.object({
        id: z.string(),
        status: z.string(),
        customerName: z.string().nullable().optional(),
        total: z.string().optional(),
        createdAt: z.string().optional()
      })
    ),
    nextCursor: z.string().nullable()
  });

  const InvoiceResponseSchema = z.object({
    invoiceId: z.string(),
    status: z.string()
  });

  const InvoiceDetailSchema = z.object({
    id: z.string(),
    userId: z.string(),
    customerName: z.string().nullable(),
    status: z.string(),
    subtotal: z.string(),
    vat: z.string(),
    total: z.string(),
    items: z.unknown(),
    ublXml: z.string().nullable(),
    nrsReference: z.string().nullable(),
    qrCode: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string()
  });

  const InvoiceDetailResponseSchema = z.object({
    invoice: InvoiceDetailSchema
  });

  app.post(
    '/api/v1/invoices',
    {
      schema: {
        body: InvoiceBodySchema,
        response: {
          200: InvoiceResponseSchema,
          409: z.object({ error: z.string() }),
          500: z.object({ error: z.string() }),
          201: InvoiceResponseSchema
        }
      }
    },
    async (req, reply) => {
      const idempotencyKeyHeader = req.headers['idempotency-key'];
      const idempotencyKey = Array.isArray(idempotencyKeyHeader) ? idempotencyKeyHeader[0] : idempotencyKeyHeader;

      const requestHash = computeRequestHash({ method: req.method, path: req.url, body: req.body });

      if (idempotencyKey) {
        const existing = await prisma.idempotencyCache.findUnique({ where: { key: idempotencyKey } });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            return reply.status(409).send({ error: 'Idempotency-Key reuse with different request body' });
          }

          const parsed = InvoiceResponseSchema.safeParse(existing.responseBody);
          if (!parsed.success) {
            app.log.error({ err: parsed.error, idempotencyKey }, 'Invalid cached idempotency responseBody');
            return reply.status(500).send({ error: 'Internal Server Error' });
          }

          return reply.status(200).send(parsed.data);
        }
      }

      const { customerName, items } = req.body as z.infer<typeof InvoiceBodySchema>;

      const devUserId = '00000000-0000-0000-0000-000000000001';

      await prisma.user.upsert({
        where: { id: devUserId },
        update: {
          name: 'TaxBridge Test Merchant',
          tin: '12345678-0001'
        },
        create: {
          id: devUserId,
          phone: '00000000000',
          name: 'TaxBridge Test Merchant',
          tin: '12345678-0001'
        }
      });

      const subtotalNumber = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const vatNumber = subtotalNumber * 0.075;
      const totalNumber = subtotalNumber + vatNumber;

      const invoice = await prisma.invoice.create({
        data: {
          userId: devUserId,
          customerName,
          subtotal: new Prisma.Decimal(subtotalNumber.toFixed(2)),
          vat: new Prisma.Decimal(vatNumber.toFixed(2)),
          total: new Prisma.Decimal(totalNumber.toFixed(2)),
          items,
          status: 'queued'
        }
      });

      const queue = getInvoiceSyncQueue();
      await queue.add(
        'sync',
        { invoiceId: invoice.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      const responseBody = { invoiceId: invoice.id, status: invoice.status };

      if (idempotencyKey) {
        await prisma.idempotencyCache.create({
          data: {
            key: idempotencyKey,
            requestHash,
            method: req.method,
            path: req.url,
            statusCode: 201,
            responseBody
          }
        });
      }

      return reply.status(201).send(responseBody);
    }
  );

  app.get(
    '/api/v1/invoices',
    {
      schema: {
        querystring: InvoiceListQuerySchema,
        response: {
          200: InvoiceListResponseSchema
        }
      }
    },
    async (req, reply) => {
      const query = req.query as z.infer<typeof InvoiceListQuerySchema>;
      const take = query.take ?? 50;

      const invoices = await prisma.invoice.findMany({
        where: query.status ? { status: query.status } : undefined,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
      });

      const nextCursor = invoices.length === take ? invoices[invoices.length - 1].id : null;

      const payloadInvoices = invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        customerName: inv.customerName,
        total: inv.total.toString(),
        createdAt: inv.createdAt.toISOString()
      }));

      return reply.send({ invoices: payloadInvoices, nextCursor });
    }
  );

  app.get(
    '/api/v1/invoices/:id',
    {
      schema: {
        params: InvoiceParamsSchema,
        response: {
          200: InvoiceDetailResponseSchema,
          404: z.object({ error: z.string() })
        }
      }
    },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof InvoiceParamsSchema>;

      const invoice = await prisma.invoice.findUnique({ where: { id } });
      if (!invoice) {
        return reply.status(404).send({ error: `Invoice with ID '${id}' not found` });
      }

      return reply.send({
        invoice: {
          id: invoice.id,
          userId: invoice.userId,
          customerName: invoice.customerName,
          status: invoice.status,
          subtotal: invoice.subtotal.toString(),
          vat: invoice.vat.toString(),
          total: invoice.total.toString(),
          items: invoice.items,
          ublXml: invoice.ublXml,
          nrsReference: invoice.nrsReference,
          qrCode: invoice.qrCode,
          createdAt: invoice.createdAt.toISOString(),
          updatedAt: invoice.updatedAt.toISOString()
        }
      });
    }
  );

  app.put(
    '/api/v1/invoices/:id',
    {
      schema: {
        params: InvoiceParamsSchema,
        body: InvoiceBodySchema,
        response: {
          200: InvoiceResponseSchema,
          409: z.object({ error: z.string() }),
          404: z.object({ error: z.string() })
        }
      }
    },
    async (req, reply) => {
      const { id } = req.params as z.infer<typeof InvoiceParamsSchema>;
      const existing = await prisma.invoice.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: `Invoice with ID '${id}' not found` });
      }

      if (existing.status === 'stamped' || existing.status === 'processing') {
        return reply.status(409).send({ error: `Cannot edit invoice in status '${existing.status}'` });
      }

      const { customerName, items } = req.body as z.infer<typeof InvoiceBodySchema>;

      const subtotalNumber = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const vatNumber = subtotalNumber * 0.075;
      const totalNumber = subtotalNumber + vatNumber;

      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          customerName,
          items,
          subtotal: new Prisma.Decimal(subtotalNumber.toFixed(2)),
          vat: new Prisma.Decimal(vatNumber.toFixed(2)),
          total: new Prisma.Decimal(totalNumber.toFixed(2)),
          status: 'queued',
          ublXml: null,
          nrsReference: null,
          qrCode: null
        }
      });

      const queue = getInvoiceSyncQueue();
      await queue.add(
        'sync',
        { invoiceId: updated.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false
        }
      );

      return reply.send({ invoiceId: updated.id, status: updated.status });
    }
  );
}
