import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../lib/prisma';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_SECONDS = 300;
const RETENTION_YEARS = 7;
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const CreateIntentSchema = z.object({
  businessId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255).refine((value) => !/[\\/\\0-\\x1f\\x7f]/.test(value), 'Filename contains invalid characters'),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  byteSize: z.number().int().positive().max(MAX_RECEIPT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

const ReceiptParamsSchema = z.object({ id: z.string().uuid() });

function storageConfig() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    const error = new Error('Receipt object storage is not configured');
    Object.assign(error, { statusCode: 503, code: 'RECEIPT_STORAGE_UNAVAILABLE' });
    throw error;
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function createStorageClient(): S3Client {
  const config = storageConfig();
  return new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

function retentionDate(): Date {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() + RETENTION_YEARS);
  return value;
}

export default async function receiptRoutes(app: FastifyInstance): Promise<void> {
  app.post('/receipts/upload-intents', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    preHandler: [app.authenticate, app.resolveOrgContext],
  }, async (request, reply) => {
    const parsed = CreateIntentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
    }

    const { businessId, filename, contentType, byteSize, sha256 } = parsed.data;
    const userId = (request as any).user.userId as string;
    const orgId = (request as any).orgContext.orgId as string;
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId, organizationId: orgId },
      select: { id: true },
    });
    if (!business) {
      return reply.code(404).send({ error: 'BUSINESS_NOT_FOUND', message: 'Business not found in this organization' });
    }

    const id = randomUUID();
    const storageKey = `receipts/${orgId}/${id}`;
    const uploadExpiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);
    const record = await prisma.receiptEvidence.create({
      data: {
        id,
        organizationId: orgId,
        userId,
        businessId,
        storageKey,
        originalFilename: filename,
        contentType,
        byteSize,
        sha256: sha256.toLowerCase(),
        status: 'PENDING_UPLOAD',
        uploadExpiresAt,
        retentionUntil: retentionDate(),
      },
      select: { id: true, status: true, uploadExpiresAt: true },
    });

    try {
      const config = storageConfig();
      const client = createStorageClient();
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        ContentType: contentType,
        ContentLength: byteSize,
        Metadata: { sha256: sha256.toLowerCase() },
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
      await prisma.auditEvent.create({ data: {
        orgId, userId, action: 'RECEIPT_UPLOAD_INTENT_CREATED', resource: 'ReceiptEvidence',
        resourceId: record.id, metadata: { businessId, contentType, byteSize, sha256: sha256.toLowerCase() },
        ipAddress: request.ip ?? null, userAgent: request.headers['user-agent'] ?? null,
      } });
      return reply.code(201).send({
        receiptEvidenceId: record.id,
        uploadUrl,
        requiredHeaders: { 'content-type': contentType, 'x-amz-meta-sha256': sha256.toLowerCase() },
        expiresAt: record.uploadExpiresAt.toISOString(),
        maxBytes: MAX_RECEIPT_BYTES,
      });
    } catch (error) {
      await prisma.receiptEvidence.delete({ where: { id: record.id } });
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>('/receipts/:id/complete', {
    preHandler: [app.authenticate, app.resolveOrgContext],
  }, async (request, reply) => {
    const params = ReceiptParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'INVALID_RECEIPT_ID' });

    const userId = (request as any).user.userId as string;
    const orgId = (request as any).orgContext.orgId as string;
    const record = await prisma.receiptEvidence.findFirst({
      where: { id: params.data.id, userId, organizationId: orgId },
    });
    if (!record) return reply.code(404).send({ error: 'RECEIPT_NOT_FOUND' });
    if (record.status === 'UPLOADED' || record.status === 'ATTACHED') {
      return reply.send({ receiptEvidenceId: record.id, status: record.status, verifiedAt: record.verifiedAt?.toISOString() ?? null });
    }
    if (record.status !== 'PENDING_UPLOAD' || record.uploadExpiresAt <= new Date()) {
      return reply.code(409).send({ error: 'UPLOAD_INTENT_EXPIRED', message: 'Create a new upload intent' });
    }

    const config = storageConfig();
    const client = createStorageClient();
    let object;
    try {
      object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: record.storageKey }));
    } catch {
      return reply.code(409).send({ error: 'UPLOAD_NOT_FOUND', message: 'The uploaded object could not be verified' });
    }

    if (object.ContentLength !== record.byteSize || object.ContentType !== record.contentType) {
      await prisma.receiptEvidence.update({ where: { id: record.id }, data: { status: 'REJECTED' } });
      return reply.code(422).send({ error: 'RECEIPT_OBJECT_MISMATCH', message: 'Uploaded object size or content type does not match the upload intent' });
    }
    const bytes = await object.Body?.transformToByteArray();
    const actualSha256 = bytes ? createHash('sha256').update(bytes).digest('hex') : '';
    const signature = bytes ? Buffer.from(bytes).subarray(0, 12) : Buffer.alloc(0);
    const matchesMagic = record.contentType === 'application/pdf'
      ? signature.subarray(0, 5).toString('ascii') === '%PDF-'
      : record.contentType === 'image/jpeg'
        ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
        : record.contentType === 'image/png'
          ? signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
          : record.contentType === 'image/webp'
            ? signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
              signature.subarray(8, 12).toString('ascii') === 'WEBP'
            : false;
    const valid = Boolean(bytes) &&
      bytes!.byteLength === record.byteSize &&
      object.ContentLength === record.byteSize &&
      object.ContentType === record.contentType &&
      object.Metadata?.sha256?.toLowerCase() === record.sha256 &&
      actualSha256 === record.sha256 &&
      matchesMagic;
    if (!valid) {
      await prisma.receiptEvidence.update({
        where: { id: record.id },
        data: { status: 'REJECTED' },
      });
      return reply.code(422).send({ error: 'RECEIPT_OBJECT_MISMATCH', message: 'Uploaded object metadata does not match the signed upload intent' });
    }

    const verifiedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.receiptEvidence.updateMany({
        where: { id: record.id, userId, organizationId: orgId, status: 'PENDING_UPLOAD' },
        data: { status: 'UPLOADED', verifiedAt },
      });
      if (result.count === 1) {
        await tx.auditEvent.create({ data: {
          orgId, userId, action: 'RECEIPT_UPLOAD_VERIFIED', resource: 'ReceiptEvidence',
          resourceId: record.id, metadata: { businessId: record.businessId, byteSize: record.byteSize, sha256: record.sha256 },
          ipAddress: request.ip ?? null, userAgent: request.headers['user-agent'] ?? null,
        } });
      }
      return result.count;
    });
    if (updated !== 1) {
      const current = await prisma.receiptEvidence.findFirst({
        where: { id: record.id, userId, organizationId: orgId },
        select: { status: true, verifiedAt: true },
      });
      if (current?.status === 'UPLOADED' || current?.status === 'ATTACHED') {
        return reply.send({ receiptEvidenceId: record.id, status: current.status, verifiedAt: current.verifiedAt?.toISOString() ?? null });
      }
      return reply.code(409).send({ error: 'RECEIPT_STATE_CONFLICT' });
    }
    return reply.send({ receiptEvidenceId: record.id, status: 'UPLOADED', verifiedAt: verifiedAt.toISOString() });
  });
}
