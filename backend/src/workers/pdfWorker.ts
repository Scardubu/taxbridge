/**
 * PDF Worker — TaxBridge V13 Sovereign
 *
 * BullMQ 5 Worker: consumes pdf-generation queue → pdfkit → R2 upload.
 * C-40: No ServerSideEncryption param on R2 upload (causes R2 error).
 * C-46: Uses createWorkerConnection() for dedicated BullMQ connection.
 */
import { Worker, Job }                  from 'bullmq';
import PDFDocument                       from 'pdfkit';
import { S3Client, PutObjectCommand }    from '@aws-sdk/client-s3';
import { createWorkerConnection }        from '../services/eventBus';
import { logger }                        from '../lib/logger';

const s3 = new S3Client({
  region:      'auto',
  endpoint:    process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface PDFJobData {
  orgId:     string;
  filingId:  string;
  taxType:   string;
  period:    string;
  reference: string;
}

async function processPDFJob(job: Job<PDFJobData>): Promise<{ key: string }> {
  const { orgId, filingId, taxType, period, reference } = job.data;

  logger.info({ jobId: job.id, orgId, filingId }, 'Processing PDF generation');

  // Generate PDF in memory
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).text('TaxBridge Filing Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12)
      .text(`Reference:  ${reference}`)
      .text(`Tax Type:   ${taxType}`)
      .text(`Period:     ${period}`)
      .text(`Filed At:   ${new Date().toISOString()}`)
      .text(`Org ID:     ${orgId}`);

    doc.end();
  });

  const key = `filings/${orgId}/${taxType}/${period}/${filingId}.pdf`;

  // C-40: No ServerSideEncryption param
  await s3.send(new PutObjectCommand({
    Bucket:      process.env.CLOUDFLARE_R2_BUCKET!,
    Key:         key,
    Body:        pdfBuffer,
    ContentType: 'application/pdf',
  }));

  logger.info({ jobId: job.id, key }, 'PDF uploaded to R2');
  return { key };
}

export function startPDFWorker(): Worker<PDFJobData> {
  const workerConnection = createWorkerConnection();

  const worker = new Worker<PDFJobData>('pdf-generation', processPDFJob, {
    connection: workerConnection,
    concurrency: 3,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'PDF job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'PDF job failed');
  });

  return worker;
}
