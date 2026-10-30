import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { prisma } from '../lib/prisma';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ATTEMPTS = 5;
const scannerTimeoutMs = 30_000;

function storage() {
  const endpoint = process.env.R2_ENDPOINT, accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY, bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error('RECEIPT_STORAGE_UNAVAILABLE');
  return { bucket, client: new S3Client({ endpoint, region: 'auto', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }) };
}

async function readBounded(body: any): Promise<Buffer> {
  if (!body) throw new Error('RECEIPT_OBJECT_EMPTY');
  const chunks: Buffer[] = []; let total = 0;
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    const part = Buffer.from(chunk); total += part.length;
    if (total > MAX_BYTES) throw new Error('RECEIPT_OBJECT_TOO_LARGE');
    chunks.push(part);
  }
  return Buffer.concat(chunks, total);
}

/** ClamAV INSTREAM protocol. Missing/unreachable scanner is a retryable failure, never CLEAN. */
async function scanWithClamAv(bytes: Buffer): Promise<{ verdict: 'CLEAN' | 'INFECTED'; engine: string; version: string; findings: string[] }> {
  const host = process.env.CLAMAV_HOST, port = Number(process.env.CLAMAV_PORT || 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MALWARE_SCANNER_NOT_CONFIGURED');
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const chunks: Buffer[] = []; let settled = false;
    const finish = (error?: Error, value?: { verdict: 'CLEAN' | 'INFECTED'; engine: string; version: string; findings: string[] }) => {
      if (settled) return; settled = true; socket.destroy(); error ? reject(error) : resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error('MALWARE_SCANNER_TIMEOUT')), scannerTimeoutMs);
    socket.on('error', (error) => { clearTimeout(timer); finish(error); });
    socket.on('data', (data) => chunks.push(Buffer.from(data)));
    socket.on('end', () => {
      clearTimeout(timer);
      const response = Buffer.concat(chunks).toString('utf8').replace(/\0$/, '').trim();
      const match = response.match(/^stream: (.+) FOUND$/);
      if (match) return finish(undefined, { verdict: 'INFECTED', engine: 'ClamAV', version: 'daemon', findings: [match[1]] });
      if (/^stream: OK$/.test(response)) return finish(undefined, { verdict: 'CLEAN', engine: 'ClamAV', version: 'daemon', findings: [] });
      finish(new Error('MALWARE_SCANNER_INVALID_RESPONSE'));
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        const part = bytes.subarray(offset, Math.min(offset + 64 * 1024, bytes.length));
        const size = Buffer.alloc(4); size.writeUInt32BE(part.length); socket.write(size); socket.write(part);
      }
      socket.write(Buffer.alloc(4));
      socket.end();
    });
  });
}

async function extractEvidenceText(bytes: Buffer): Promise<{ text: string; confidence: number | null; provider: string; version: string }> {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') throw new Error('OCR_PDF_REQUIRES_ASYNC_DOCUMENT_PROCESSOR');
  const client = new ImageAnnotatorClient();
  const [result] = await client.documentTextDetection({ image: { content: bytes } });
  const annotation = result.fullTextAnnotation;
  const text = annotation?.text?.slice(0, 100_000) ?? '';
  const values: number[] = [];
  for (const page of annotation?.pages ?? []) for (const block of page.blocks ?? []) {
    if (typeof block.confidence === 'number' && Number.isFinite(block.confidence)) values.push(block.confidence);
  }
  const confidence = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return { text, confidence, provider: 'google-cloud-vision', version: 'documentTextDetection' };
}

async function claimJob(): Promise<{ id: string; receipt_evidence_id: string; attempts: number } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; receipt_evidence_id: string; attempts: number }>>`
    WITH candidate AS (
      SELECT id FROM receipt_processing_jobs
      WHERE (status IN ('PENDING','RETRY') AND available_at <= NOW())
         OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '10 minutes')
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE receipt_processing_jobs j
       SET status = 'PROCESSING', attempts = j.attempts + 1, locked_at = NOW(), updated_at = NOW()
      FROM candidate c WHERE j.id = c.id
    RETURNING j.id, j.receipt_evidence_id, j.attempts
  `;
  return rows[0] ?? null;
}

async function processJob(job: { id: string; receipt_evidence_id: string; attempts: number }): Promise<void> {
  const receipt = await prisma.receiptEvidence.findUnique({ where: { id: job.receipt_evidence_id } });
  if (!receipt || !['QUARANTINED','SCANNING'].includes(receipt.status)) {
    await prisma.receiptProcessingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', lockedAt: null } });
    return;
  }
  const { client, bucket } = storage();
  await prisma.receiptEvidence.update({ where: { id: receipt.id }, data: { status: 'SCANNING' } });
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: receipt.storageKey }));
    const bytes = await readBounded(object.Body);
    if (bytes.length !== receipt.byteSize) throw new Error('RECEIPT_SIZE_MISMATCH');
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) throw new Error('RECEIPT_SHA256_MISMATCH');
    const scan = await scanWithClamAv(bytes);
    await prisma.receiptScanResult.upsert({
      where: { receiptEvidenceId: receipt.id },
      update: {},
      create: {
      receiptEvidenceId: receipt.id, sha256: receipt.sha256, engine: scan.engine,
      engineVersion: scan.version, verdict: scan.verdict, findings: scan.findings,
    } });
    if (scan.verdict === 'INFECTED') {
      await prisma.receiptEvidence.update({ where: { id: receipt.id }, data: { status: 'INFECTED' } });
      await prisma.auditEvent.create({ data: {
        orgId: receipt.organizationId, userId: receipt.userId, action: 'RECEIPT_MALWARE_DETECTED',
        resource: 'ReceiptEvidence', resourceId: receipt.id, metadata: { sha256: receipt.sha256, findings: scan.findings },
      } });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: receipt.storageKey })).catch(() => undefined);
      await prisma.receiptProcessingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', lockedAt: null } });
      return;
    }
    if (!object.ETag) throw new Error('RECEIPT_OBJECT_VERSION_UNAVAILABLE');
    const cleanStorageKey = receipt.cleanStorageKey ?? `receipts/clean/${receipt.organizationId}/${receipt.id}`;
    await client.send(new CopyObjectCommand({
      Bucket: bucket, Key: cleanStorageKey, CopySource: `${bucket}/${receipt.storageKey}`,
      CopySourceIfMatch: object.ETag, MetadataDirective: 'COPY',
    }));
    try {
      const ocr = await extractEvidenceText(bytes);
      await prisma.receiptOcrExtraction.upsert({
        where: { receiptEvidenceId: receipt.id }, update: {}, create: {
        receiptEvidenceId: receipt.id, sha256: receipt.sha256, provider: ocr.provider,
        providerVersion: ocr.version, status: 'SUCCEEDED', extractedText: ocr.text,
        meanConfidence: ocr.confidence, fieldCandidates: { reviewRequired: true },
      } });
    } catch {
      await prisma.receiptOcrExtraction.upsert({
        where: { receiptEvidenceId: receipt.id }, update: {}, create: {
        receiptEvidenceId: receipt.id, sha256: receipt.sha256, provider: 'google-cloud-vision',
        providerVersion: 'documentTextDetection', status: 'UNAVAILABLE',
        fieldCandidates: { reviewRequired: true },
      } });
      await prisma.auditEvent.create({ data: {
        orgId: receipt.organizationId, userId: receipt.userId, action: 'RECEIPT_OCR_UNAVAILABLE',
        resource: 'ReceiptEvidence', resourceId: receipt.id, metadata: { reason: 'OCR_PROVIDER_UNAVAILABLE' },
      } });
    }
    await prisma.receiptEvidence.update({
      where: { id: receipt.id },
      data: { cleanStorageKey, status: receipt.expenseId ? 'ATTACHED' : 'CLEAN', reviewStatus: 'REQUIRED' },
    });
    await prisma.auditEvent.create({ data: {
      orgId: receipt.organizationId, userId: receipt.userId, action: 'RECEIPT_SCAN_CLEAN',
      resource: 'ReceiptEvidence', resourceId: receipt.id, metadata: { sha256: receipt.sha256, scanner: scan.engine },
    } });
    await prisma.receiptProcessingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', lockedAt: null } });
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: receipt.storageKey })).catch(() => undefined);
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'RECEIPT_PROCESSING_FAILED';
    const terminal = job.attempts >= MAX_ATTEMPTS;
    await prisma.receiptProcessingJob.update({ where: { id: job.id }, data: {
      status: terminal ? 'DEAD_LETTER' : 'RETRY',
      availableAt: new Date(Date.now() + Math.min(60_000 * (2 ** (job.attempts - 1)), 60 * 60_000)),
      lockedAt: null, lastErrorCode: code,
    } });
    if (terminal) {
      await prisma.receiptEvidence.update({ where: { id: receipt.id }, data: { status: 'SCAN_FAILED' } });
      await prisma.auditEvent.create({ data: {
        orgId: receipt.organizationId, userId: receipt.userId, action: 'RECEIPT_SCAN_FAILED',
        resource: 'ReceiptEvidence', resourceId: receipt.id, metadata: { errorCode: code, attempts: job.attempts },
      } });
    }
  }
}

let running = false;
export async function processReceiptJobsBatch(limit = 5): Promise<number> {
  if (running) return 0;
  running = true;
  let processed = 0;
  try {
    while (processed < limit) {
      const job = await claimJob();
      if (!job) break;
      await processJob(job);
      processed++;
    }
    return processed;
  } finally { running = false; }
}
