import { OperationEnvelopeSchema } from '@taxbridge/contracts';
import { buildMobileOperationEnvelope } from '../services/operationEnvelope';
import { classifyQueueFailure } from '../services/offlineQueuePolicy';

describe('mobile durable operation envelope', () => {
  it('serializes an offline item using the shared contract shape', () => {
    const envelope = buildMobileOperationEnvelope({
      operationId: '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55',
      idempotencyKey: 'mobile-installation-operation-0001',
      clientOperationType: 'INVOICE_SUBMIT',
      payload: { invoiceDraftId: 'local-invoice-12', total: 12500 },
      createdAt: '2026-11-06T04:00:00.000Z',
    });

    expect(OperationEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope).toMatchObject({
      operationId: '4fb24ad5-2dc9-45f7-baa0-1e0038d96b55',
      idempotencyKey: 'mobile-installation-operation-0001',
      operationType: 'sync',
      schemaVersion: 1,
      payload: {
        clientOperationType: 'INVOICE_SUBMIT',
        data: { invoiceDraftId: 'local-invoice-12', total: 12500 },
      },
    });
  });

  it('rejects malformed operation IDs and short idempotency keys', () => {
    expect(() => buildMobileOperationEnvelope({
      operationId: 'not-a-uuid',
      idempotencyKey: 'short',
      clientOperationType: 'PROFILE_SYNC',
      payload: {},
      createdAt: '2026-11-06T04:00:00.000Z',
    })).toThrow();
  });
});

describe('offline operation retry classification', () => {
  it('retries network failures with no HTTP status', () => {
    expect(classifyQueueFailure(new Error('Network request failed'))).toBe('retry');
  });

  it('retries rate limits and server failures', () => {
    expect(classifyQueueFailure({ status: 429 })).toBe('retry');
    expect(classifyQueueFailure({ status: 503 })).toBe('retry');
  });

  it('pauses on authentication expiry without exhausting retries', () => {
    expect(classifyQueueFailure({ status: 401 })).toBe('pause');
  });

  it('does not retry a definitive unsupported-operation response', () => {
    expect(classifyQueueFailure({
      status: 501,
      details: { retryable: false, code: 'OPERATION_HANDLER_NOT_REGISTERED' },
    })).toBe('terminal');
  });

  it('treats validation and authorization failures as terminal', () => {
    expect(classifyQueueFailure({ status: 400 })).toBe('terminal');
    expect(classifyQueueFailure({ status: 403 })).toBe('terminal');
  });
});
