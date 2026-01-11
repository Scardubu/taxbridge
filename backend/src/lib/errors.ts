/**
 * TaxBridge Centralized Error Handling
 * 
 * Provides standardized error classes for consistent error handling
 * across the application. All errors include:
 * - Error code for categorization
 * - HTTP status code
 * - Retriable flag for automatic retry logic
 * - Structured metadata for logging
 */

import { createLogger } from './logger';

const log = createLogger('errors');

// Base error class for all TaxBridge errors
export class TaxBridgeError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retriable: boolean;
  public readonly metadata: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    retriable: boolean = false,
    metadata: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TaxBridgeError';
    this.code = code;
    this.statusCode = statusCode;
    this.retriable = retriable;
    this.metadata = metadata;
    this.timestamp = new Date();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retriable: this.retriable,
      timestamp: this.timestamp.toISOString(),
      ...(Object.keys(this.metadata).length > 0 && { details: this.metadata })
    };
  }
}

// Validation errors (400)
export class ValidationError extends TaxBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, false, details);
    this.name = 'ValidationError';
  }
}

// Authentication errors (401)
export class AuthenticationError extends TaxBridgeError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401, false);
    this.name = 'AuthenticationError';
  }
}

// Authorization errors (403)
export class AuthorizationError extends TaxBridgeError {
  constructor(message: string = 'Access denied') {
    super('AUTHORIZATION_ERROR', message, 403, false);
    this.name = 'AuthorizationError';
  }
}

// Not found errors (404)
export class NotFoundError extends TaxBridgeError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with ID '${identifier}' not found` 
      : `${resource} not found`;
    super('NOT_FOUND', message, 404, false, { resource, identifier });
    this.name = 'NotFoundError';
  }
}

// Rate limit errors (429)
export class RateLimitError extends TaxBridgeError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later', 429, true, { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Duplo/DigiTax integration errors (502)
export class DuploError extends TaxBridgeError {
  constructor(message: string, retriable: boolean = true, details?: Record<string, unknown>) {
    super('DUPLO_ERROR', message, 502, retriable, details);
    this.name = 'DuploError';
  }
}

// Remita payment errors (502)
export class RemitaError extends TaxBridgeError {
  constructor(message: string, retriable: boolean = true, details?: Record<string, unknown>) {
    super('REMITA_ERROR', message, 502, retriable, details);
    this.name = 'RemitaError';
  }
}

// SMS provider errors (502)
export class SMSError extends TaxBridgeError {
  constructor(message: string, provider: string, retriable: boolean = true) {
    super('SMS_ERROR', message, 502, retriable, { provider });
    this.name = 'SMSError';
  }
}

// Database errors (503)
export class DatabaseError extends TaxBridgeError {
  constructor(message: string = 'Database operation failed', retriable: boolean = true) {
    super('DATABASE_ERROR', message, 503, retriable);
    this.name = 'DatabaseError';
  }
}

// Queue errors (503)
export class QueueError extends TaxBridgeError {
  constructor(message: string, queueName: string, retriable: boolean = true) {
    super('QUEUE_ERROR', message, 503, retriable, { queueName });
    this.name = 'QueueError';
  }
}

// OCR processing errors
export class OCRError extends TaxBridgeError {
  constructor(message: string, retriable: boolean = false) {
    super('OCR_ERROR', message, 422, retriable);
    this.name = 'OCRError';
  }
}

// UBL generation errors
export class UBLError extends TaxBridgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('UBL_ERROR', message, 422, false, details);
    this.name = 'UBLError';
  }
}

// Helper function to determine if an error is retriable
export function isRetriableError(error: unknown): boolean {
  if (error instanceof TaxBridgeError) {
    return error.retriable;
  }
  
  // Network errors are generally retriable
  if (error instanceof Error) {
    const retriableMessages = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ESOCKETTIMEDOUT',
      'Network Error',
      'timeout'
    ];
    return retriableMessages.some(msg => error.message.includes(msg));
  }
  
  return false;
}

// Helper function to wrap unknown errors
export function wrapError(error: unknown, context?: string): TaxBridgeError {
  if (error instanceof TaxBridgeError) {
    return error;
  }
  
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  const fullMessage = context ? `${context}: ${message}` : message;
  
  log.error('Wrapped unknown error', { 
    originalError: error, 
    context,
    stack: error instanceof Error ? error.stack : undefined 
  });
  
  return new TaxBridgeError('INTERNAL_ERROR', fullMessage, 500, false);
}

// Error response formatter for Fastify
export function formatErrorResponse(error: unknown): {
  statusCode: number;
  body: Record<string, unknown>;
} {
  if (error instanceof TaxBridgeError) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON()
    };
  }
  
  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    return {
      statusCode: 400,
      body: {
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error
      }
    };
  }
  
  // Generic error
  const wrapped = wrapError(error);
  return {
    statusCode: wrapped.statusCode,
    body: wrapped.toJSON()
  };
}

export default {
  TaxBridgeError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  DuploError,
  RemitaError,
  SMSError,
  DatabaseError,
  QueueError,
  OCRError,
  UBLError,
  isRetriableError,
  wrapError,
  formatErrorResponse
};
