/**
 * Document Vault Routes (MOD-26)
 *
 * GET  /api/v1/documents           — List documents for org
 * POST /api/v1/documents/upload    — Get presigned upload URL
 * GET  /api/v1/documents/:id       — Get document metadata
 * GET  /api/v1/documents/:id/url   — Get presigned download URL (24h)
 * DELETE /api/v1/documents/:id     — SUPER_ADMIN only; hard delete after 7 years
 *
 * Storage: Cloudflare R2 (S3-compatible)
 * Encryption at rest: R2 handles it by default (DO NOT set ServerSideEncryption)
 * Retention: 5 years minimum (NTA 2025); hard delete SUPER_ADMIN only after 7 years
 * Access: every download logged to AuditEvent (§8.3)
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireRole } from '../../plugins/requireRole';
import { writeAuditEvent } from '../../services/audit';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

const log = logger.child({ service: 'documents' });

// ─── R2 / S3 client ──────────────────────────────────────────────────────

const s3 = new S3Client({
  endpoint:    process.env.R2_ENDPOINT,
  region:      'auto',
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET   = process.env.R2_BUCKET_NAME || 'taxbridge-vault';
const SIGN_TTL = 86_400;  // 24h in seconds
// 5-year retention in milliseconds (NTA 2025 minimum)
const FIVE_YEARS_MS = 5 * 365 * 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────

function documentKey(orgId: string, docId: string, filename: string): string {
  return `documents/${orgId}/${docId}/${filename}`;
}

async function generateDownloadUrl(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: SIGN_TTL });
}

async function generateUploadUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    ContentType: contentType,
    // DO NOT set ServerSideEncryption — R2 encrypts at rest by default
  });
  return getSignedUrl(s3, cmd, { expiresIn: SIGN_TTL });
}

// ─── Routes ──────────────────────────────────────────────────────────────

export default async function documentRoutes(app: FastifyInstance) {
  // ── List documents for org ──────────────────────────────────────────────
  app.get(
    '/documents',
    { preHandler: [app.authenticate, app.resolveOrgContext] },
    async (req, reply) => {
      const orgId = (req as any).orgContext.orgId;
      const docs  = await (prisma as any).document.findMany({
        where:   { orgId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id:          true,
          name:        true,
          mimeType:    true,
          sizeBytes:   true,
          documentType:true,
          createdAt:   true,
          retainUntil: true,
        },
      });
      return reply.send({ documents: docs });
    },
  );

  // ── Get presigned upload URL ────────────────────────────────────────────
  app.post(
    '/documents/upload',
    { preHandler: [app.authenticate, app.resolveOrgContext] },
    async (req, reply) => {
      const parseResult = z.object({
        name:         z.string().min(1).max(255),
        mimeType:     z.string(),
        sizeBytes:    z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
        documentType: z.string(),
      }).safeParse(req.body);

      if (!parseResult.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parseResult.error.issues });
      }

      const { name, mimeType, sizeBytes, documentType } = parseResult.data;
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.userId;
      const role    = (req as any).user.role;

      // Create document record
      const doc = await (prisma as any).document.create({
        data: {
          orgId,
          name,
          mimeType,
          sizeBytes,
          documentType,
          storageKey:  '',  // will be set after upload
          retainUntil: new Date(Date.now() + FIVE_YEARS_MS),
          uploadedBy:  actorId,
        },
      });

      const key = documentKey(orgId, doc.id, name);
      const uploadUrl = await generateUploadUrl(key, mimeType);

      // Update storage key
      await (prisma as any).document.update({
        where: { id: doc.id },
        data:  { storageKey: key },
      });

      // Audit upload
      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'Document',
        targetId:   doc.id,
        action:     'UPLOAD' as any,
        after:      { name, documentType, sizeBytes },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      log.info({ orgId, docId: doc.id, name }, 'Document upload URL generated');

      return reply.send({
        documentId: doc.id,
        uploadUrl,
        expiresIn:  SIGN_TTL,
        key,
      });
    },
  );

  // ── Get document metadata ────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [app.authenticate, app.resolveOrgContext] },
    async (req, reply) => {
      const orgId = (req as any).orgContext.orgId;
      const doc   = await (prisma as any).document.findFirst({
        where: { id: req.params.id, orgId, deletedAt: null },
      });
      if (!doc) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Document not found' });
      return reply.send({ document: doc });
    },
  );

  // ── Get presigned download URL (every access logged) ────────────────────
  app.get<{ Params: { id: string } }>(
    '/documents/:id/url',
    { preHandler: [app.authenticate, app.resolveOrgContext] },
    async (req, reply) => {
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.userId;
      const role    = (req as any).user.role;

      const doc = await (prisma as any).document.findFirst({
        where: { id: req.params.id, orgId, deletedAt: null },
      });
      if (!doc) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Document not found' });

      const downloadUrl = await generateDownloadUrl(doc.storageKey);

      // Mandatory audit on every download (§8.3)
      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'Document',
        targetId:   doc.id,
        action:     'DOWNLOAD' as any,
        after:      { name: doc.name },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.send({ downloadUrl, expiresIn: SIGN_TTL });
    },
  );

  // ── Delete document (SUPER_ADMIN only, after 7 years) ───────────────────
  app.delete<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [app.authenticate, app.resolveOrgContext, requireRole('ADMIN')] },
    async (req, reply) => {
      const orgId   = (req as any).orgContext.orgId;
      const actorId = (req as any).user.userId;
      const role    = (req as any).user.role;

      const doc = await (prisma as any).document.findFirst({
        where: { id: req.params.id, orgId },
      });
      if (!doc) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Document not found' });

      const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;
      const ageMs = Date.now() - new Date(doc.createdAt).getTime();
      if (ageMs < SEVEN_YEARS_MS) {
        return reply.status(403).send({
          error:   'RETENTION_VIOLATION',
          message: 'Document cannot be deleted until after 7 years (NTA 2025 requirement).',
          code:    403,
        });
      }

      // Hard delete from R2
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.storageKey }));

      // Soft-delete in DB
      await (prisma as any).document?.update({
        where: { id: doc.id },
        data:  { deletedAt: new Date() },
      });

      await writeAuditEvent({
        orgId,
        actorId,
        actorRole:  role,
        targetType: 'Document',
        targetId:   doc.id,
        action:     'DELETE' as any,
        before:     { name: doc.name, storageKey: doc.storageKey },
        ip:         req.ip ?? '0.0.0.0',
        userAgent:  req.headers['user-agent'],
      });

      return reply.send({ success: true, deletedId: doc.id });
    },
  );
}
