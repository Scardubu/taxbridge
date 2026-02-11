/**
 * TaxBridge Error Handling — Unit Tests
 *
 * Tests all custom error classes, error formatting, retriability detection,
 * and the wrapError utility.
 */

import {
  TaxBridgeError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DuploError,
  RemitaError,
  PaystackError,
  FlutterwaveError,
  SMSError,
  DatabaseError,
  QueueError,
  OCRError,
  UBLError,
  isRetriableError,
  wrapError,
  formatErrorResponse,
} from '../lib/errors';

// ═══════════════════════════════════════════════════════════════════════════
// Base Error Class
// ═══════════════════════════════════════════════════════════════════════════

describe('TaxBridgeError', () => {
  it('should create error with all properties', () => {
    const err = new TaxBridgeError('TEST_CODE', 'Test message', 418, true, { key: 'val' });

    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('Test message');
    expect(err.statusCode).toBe(418);
    expect(err.retriable).toBe(true);
    expect(err.metadata).toEqual({ key: 'val' });
    expect(err.timestamp).toBeInstanceOf(Date);
    expect(err.name).toBe('TaxBridgeError');
    expect(err.stack).toBeDefined();
  });

  it('should default to 500 status and non-retriable', () => {
    const err = new TaxBridgeError('CODE', 'msg');
    expect(err.statusCode).toBe(500);
    expect(err.retriable).toBe(false);
    expect(err.metadata).toEqual({});
  });

  it('toJSON should produce structured output', () => {
    const err = new TaxBridgeError('CODE', 'msg', 400, false, { field: 'email' });
    const json = err.toJSON();

    expect(json.error).toBe('CODE');
    expect(json.message).toBe('msg');
    expect(json.statusCode).toBe(400);
    expect(json.retriable).toBe(false);
    expect(json.timestamp).toBeTruthy();
    expect(json.details).toEqual({ field: 'email' });
  });

  it('toJSON should omit details when metadata is empty', () => {
    const err = new TaxBridgeError('CODE', 'msg');
    const json = err.toJSON();
    expect(json.details).toBeUndefined();
  });

  it('should be instanceof Error', () => {
    const err = new TaxBridgeError('CODE', 'msg');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaxBridgeError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Specific Error Classes
// ═══════════════════════════════════════════════════════════════════════════

describe('ValidationError', () => {
  it('should have 400 status and VALIDATION_ERROR code', () => {
    const err = new ValidationError('Invalid email');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.retriable).toBe(false);
    expect(err.name).toBe('ValidationError');
  });

  it('should include details', () => {
    const err = new ValidationError('Bad input', { field: 'email', value: 'bad' });
    expect(err.metadata).toEqual({ field: 'email', value: 'bad' });
  });
});

describe('AuthenticationError', () => {
  it('should have 401 status and default message', () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Authentication required');
    expect(err.code).toBe('AUTHENTICATION_ERROR');
    expect(err.name).toBe('AuthenticationError');
  });

  it('should accept custom message', () => {
    const err = new AuthenticationError('Token expired');
    expect(err.message).toBe('Token expired');
  });
});

describe('AuthorizationError', () => {
  it('should have 403 status', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Access denied');
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    expect(err.name).toBe('AuthorizationError');
  });
});

describe('NotFoundError', () => {
  it('should format message with resource and identifier', () => {
    const err = new NotFoundError('Invoice', 'inv-123');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Invoice with ID 'inv-123' not found");
    expect(err.metadata).toEqual({ resource: 'Invoice', identifier: 'inv-123' });
    expect(err.name).toBe('NotFoundError');
  });

  it('should format message without identifier', () => {
    const err = new NotFoundError('Business');
    expect(err.message).toBe('Business not found');
  });
});

describe('RateLimitError', () => {
  it('should have 429 status and be retriable', () => {
    const err = new RateLimitError(120);
    expect(err.statusCode).toBe(429);
    expect(err.retriable).toBe(true);
    expect(err.retryAfter).toBe(120);
    expect(err.name).toBe('RateLimitError');
  });

  it('should default to 60s retry', () => {
    const err = new RateLimitError();
    expect(err.retryAfter).toBe(60);
  });
});

describe('Integration Error Classes', () => {
  it('DuploError should be 502 and retriable by default', () => {
    const err = new DuploError('DigiTax timeout');
    expect(err.statusCode).toBe(502);
    expect(err.retriable).toBe(true);
    expect(err.code).toBe('DUPLO_ERROR');
    expect(err.name).toBe('DuploError');
  });

  it('RemitaError should be 502 and retriable by default', () => {
    const err = new RemitaError('Connection refused');
    expect(err.statusCode).toBe(502);
    expect(err.retriable).toBe(true);
    expect(err.code).toBe('REMITA_ERROR');
  });

  it('PaystackError should be 502 and retriable by default', () => {
    const err = new PaystackError('API error');
    expect(err.statusCode).toBe(502);
    expect(err.retriable).toBe(true);
    expect(err.code).toBe('PAYSTACK_ERROR');
  });

  it('FlutterwaveError should be 502 and retriable by default', () => {
    const err = new FlutterwaveError('Timeout');
    expect(err.statusCode).toBe(502);
    expect(err.retriable).toBe(true);
    expect(err.code).toBe('FLUTTERWAVE_ERROR');
  });

  it('SMSError should include provider', () => {
    const err = new SMSError('Delivery failed', 'africastalking');
    expect(err.statusCode).toBe(502);
    expect(err.metadata).toEqual({ provider: 'africastalking' });
    expect(err.code).toBe('SMS_ERROR');
  });

  it('Integration errors can be non-retriable', () => {
    const err = new DuploError('Invalid API key', false);
    expect(err.retriable).toBe(false);
  });
});

describe('Infrastructure Error Classes', () => {
  it('DatabaseError should be 503', () => {
    const err = new DatabaseError();
    expect(err.statusCode).toBe(503);
    expect(err.retriable).toBe(true);
    expect(err.code).toBe('DATABASE_ERROR');
  });

  it('QueueError should include queue name', () => {
    const err = new QueueError('Queue full', 'invoice-sync');
    expect(err.statusCode).toBe(503);
    expect(err.metadata).toEqual({ queueName: 'invoice-sync' });
    expect(err.code).toBe('QUEUE_ERROR');
  });

  it('OCRError should be 422 and non-retriable by default', () => {
    const err = new OCRError('Cannot read receipt');
    expect(err.statusCode).toBe(422);
    expect(err.retriable).toBe(false);
    expect(err.code).toBe('OCR_ERROR');
  });

  it('UBLError should be 422', () => {
    const err = new UBLError('Invalid XML', { field: 'TaxTotal' });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('UBL_ERROR');
    expect(err.metadata).toEqual({ field: 'TaxTotal' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isRetriableError
// ═══════════════════════════════════════════════════════════════════════════

describe('isRetriableError', () => {
  it('should return true for retriable TaxBridgeError', () => {
    expect(isRetriableError(new DuploError('timeout'))).toBe(true);
    expect(isRetriableError(new RemitaError('timeout'))).toBe(true);
    expect(isRetriableError(new DatabaseError())).toBe(true);
    expect(isRetriableError(new RateLimitError())).toBe(true);
  });

  it('should return false for non-retriable TaxBridgeError', () => {
    expect(isRetriableError(new ValidationError('bad input'))).toBe(false);
    expect(isRetriableError(new AuthenticationError())).toBe(false);
    expect(isRetriableError(new NotFoundError('Invoice'))).toBe(false);
    expect(isRetriableError(new OCRError('bad image'))).toBe(false);
  });

  it('should detect retriable network errors', () => {
    expect(isRetriableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetriableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetriableError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isRetriableError(new Error('ENOTFOUND'))).toBe(true);
    expect(isRetriableError(new Error('Network Error'))).toBe(true);
    expect(isRetriableError(new Error('timeout exceeded'))).toBe(true);
  });

  it('should return false for generic errors', () => {
    expect(isRetriableError(new Error('Something went wrong'))).toBe(false);
    expect(isRetriableError(new TypeError('Cannot read property'))).toBe(false);
  });

  it('should return false for non-Error values', () => {
    expect(isRetriableError('string error')).toBe(false);
    expect(isRetriableError(null)).toBe(false);
    expect(isRetriableError(undefined)).toBe(false);
    expect(isRetriableError(42)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// wrapError
// ═══════════════════════════════════════════════════════════════════════════

describe('wrapError', () => {
  it('should return TaxBridgeError as-is', () => {
    const original = new ValidationError('bad input');
    const wrapped = wrapError(original);
    expect(wrapped).toBe(original);
  });

  it('should wrap generic Error into TaxBridgeError', () => {
    const original = new Error('Something failed');
    const wrapped = wrapError(original);

    expect(wrapped).toBeInstanceOf(TaxBridgeError);
    expect(wrapped.message).toBe('Something failed');
    expect(wrapped.statusCode).toBe(500);
    expect(wrapped.code).toBe('INTERNAL_ERROR');
  });

  it('should include context in message', () => {
    const wrapped = wrapError(new Error('DB down'), 'Creating invoice');
    expect(wrapped.message).toBe('Creating invoice: DB down');
  });

  it('should handle non-Error values', () => {
    const wrapped = wrapError('string error');
    expect(wrapped.message).toBe('An unexpected error occurred');
    expect(wrapped.statusCode).toBe(500);
  });

  it('should handle null/undefined', () => {
    expect(wrapError(null).message).toBe('An unexpected error occurred');
    expect(wrapError(undefined).message).toBe('An unexpected error occurred');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatErrorResponse
// ═══════════════════════════════════════════════════════════════════════════

describe('formatErrorResponse', () => {
  it('should format TaxBridgeError correctly', () => {
    const err = new ValidationError('Invalid TIN', { field: 'tin' });
    const { statusCode, body } = formatErrorResponse(err);

    expect(statusCode).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid TIN');
  });

  it('should format Zod-like validation errors', () => {
    const zodError = { issues: [{ path: ['email'], message: 'Invalid email' }] };
    const { statusCode, body } = formatErrorResponse(zodError);

    expect(statusCode).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Request validation failed');
  });

  it('should format generic errors as 500', () => {
    const { statusCode, body } = formatErrorResponse(new Error('Unexpected'));

    expect(statusCode).toBe(500);
    expect(body.error).toBe('INTERNAL_ERROR');
  });

  it('should handle non-Error values', () => {
    const { statusCode } = formatErrorResponse('string error');
    expect(statusCode).toBe(500);
  });

  it('should preserve status codes for all error types', () => {
    expect(formatErrorResponse(new AuthenticationError()).statusCode).toBe(401);
    expect(formatErrorResponse(new AuthorizationError()).statusCode).toBe(403);
    expect(formatErrorResponse(new NotFoundError('X')).statusCode).toBe(404);
    expect(formatErrorResponse(new RateLimitError()).statusCode).toBe(429);
    expect(formatErrorResponse(new DuploError('x')).statusCode).toBe(502);
    expect(formatErrorResponse(new DatabaseError()).statusCode).toBe(503);
  });
});
