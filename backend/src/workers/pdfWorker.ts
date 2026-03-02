/**
 * pdfWorker — TaxBridge V12
 *
 * BullMQ worker that generates a PDF audit report for a tax filing
 * and uploads it to Cloudflare R2 (or AWS S3).
 *
 * GAP-15 / C-40 / criterion #26.
 *
 * Queue name: "pdf-generation"
 * Job payload: { filingId: string; orgId: string; taxType: string; period: string }
 *
 * C-07: Failures are logged to Sentry and the job is retried via BullMQ
 *       backoff — no data loss and no process crash.
 */

import { Worker, type Job } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import PDFDocument from 'pdfkit';
import * as Sentry from '@sentry/node';
import { createLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getRedisConnection } from '../queue/client';

const log = createLogger('pdf-worker');

// ─── Job payload type ─────────────────────────────────────────────────────────

export interface PdfJobPayload {
  filingId: string;
  orgId:    string;
  taxType:  string;
  period:   string;
}

// ─── S3 / R2 client (Cloudflare R2 via S3-compatible API) ────────────────────

const s3 = new S3Client({
  endpoint:         process.env.AWS_ENDPOINT,          // Cloudflare R2 endpoint
  region:           process.env.AWS_REGION || 'auto',
  credentials: {
    accessKeyId:      process.env.AWS_ACCESS_KEY!,
    secretAccessKey:  process.env.AWS_SECRET_KEY!,
  },
  forcePathStyle: true,                                 // Required for R2
});

const BUCKET = process.env.AWS_BUCKET || 'taxbridge-documents';

// ─── PDF generation ───────────────────────────────────────────────────────────

async function generateFilingPdf(job: Job<PdfJobPayload>): Promise<void> {
  const { filingId, orgId, taxType, period } = job.data;

  log.info('PDF generation started', { filingId, orgId, taxType, period });

  // ── Fetch filing data ─────────────────────────────────────────────────────
  const filing = await (prisma as any).taxFiling.findUnique({
    where:  { id: filingId },
    select: {
      id: true, taxType: true, period: true, status: true,
      filedAt: true, amount: true, vatAmount: true,
      org: { select: { name: true, tin: true } },
    },
  });

  if (!filing) {
    throw new Error(`Filing ${filingId} not found`);
  }

  // ── Build PDF in memory ───────────────────────────────────────────────────
  const pdfBuffer = await _buildPdf(filing);

  // ── Upload to R2 ─────────────────────────────────────────────────────────
  const key = `filings/${orgId}/${taxType}/${period}/${filingId}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        pdfBuffer,
    ContentType: 'application/pdf',
    Metadata: {
      filingId,
      orgId,
      taxType,
      period,
      generatedAt: new Date().toISOString(),
    },
  }));

  // ── Store reference in DB ─────────────────────────────────────────────────
  await (prisma as any).taxFiling.update({
    where: { id: filingId },
    data:  { pdfKey: key, pdfGeneratedAt: new Date() },
  });

  log.info('PDF uploaded to R2 successfully', { filingId, key });
}

// ─── PDF builder ──────────────────────────────────────────────────────────────

function _buildPdf(filing: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ───────────────────────────────────────────────────────────────
    doc
      .font('Helvetica-Bold').fontSize(20)
      .text('TaxBridge', { align: 'center' })
      .fontSize(12).font('Helvetica')
      .text('Official Tax Filing Receipt', { align: 'center' })
      .moveDown(0.5);

    doc
      .strokeColor('#0566B1').lineWidth(2)
      .moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      .moveDown();

    // ── Filing details ────────────────────────────────────────────────────────
    const rows: [string, string][] = [
      ['Filing ID',   filing.id],
      ['Organisation', filing.org?.name ?? 'N/A'],
      ['TIN',          filing.org?.tin  ?? 'N/A'],
      ['Tax Type',     filing.taxType],
      ['Period',       filing.period],
      ['Status',       filing.status],
      ['Filed At',     filing.filedAt ? new Date(filing.filedAt).toLocaleDateString('en-NG') : 'Pending'],
      ['Amount',       `₦${Number(filing.amount ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`],
    ];

    for (const [label, value] of rows) {
      doc
        .font('Helvetica-Bold').text(`${label}:  `, { continued: true })
        .font('Helvetica').text(value)
        .moveDown(0.25);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.moveDown(2)
      .fontSize(9).fillColor('#666666')
      .text(
        `Generated by TaxBridge on ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} WAT. ` +
        'This document is a system-generated receipt and constitutes official evidence of filing.',
        { align: 'center' },
      );

    doc.end();
  });
}

// ─── Worker registration ─────────────────────────────────────────────────────

export function startPdfWorker(): Worker<PdfJobPayload> | null {
  const redis = getRedisConnection();
  if (!redis) {
    log.warn('Redis unavailable — PDF worker not started');
    return null;
  }

  const worker = new Worker<PdfJobPayload>(
    'pdf-generation',
    generateFilingPdf,
    {
      connection: redis,
      concurrency: 2,
      limiter:     { max: 10, duration: 60_000 }, // 10 PDFs per minute
    },
  );

  worker.on('completed', (job) => {
    log.info('PDF job completed', { jobId: job.id, filingId: job.data.filingId });
  });

  worker.on('failed', (job, err) => {
    Sentry.captureException(err, { extra: { jobId: job?.id, filingId: job?.data?.filingId } });
    log.error('PDF job failed', { err, jobId: job?.id });
  });

  log.info('PDF generation worker started');
  return worker;
}
