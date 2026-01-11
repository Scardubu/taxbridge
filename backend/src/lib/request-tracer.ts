/**
 * TaxBridge - Request Tracing Utility
 * 
 * Provides request correlation IDs and structured logging
 * for distributed tracing and debugging.
 */

import { randomUUID } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from './logger';

const log = createLogger('request-tracer');

// Request context storage
const requestContexts = new Map<string, RequestContext>();

export interface RequestContext {
  requestId: string;
  correlationId: string;
  startTime: number;
  path: string;
  method: string;
  ip: string;
  userAgent: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a request context from a Fastify request
 */
export function createRequestContext(request: FastifyRequest): RequestContext {
  const requestId = (request.headers['x-request-id'] as string) || generateRequestId();
  const correlationId = (request.headers['x-correlation-id'] as string) || requestId;
  
  const context: RequestContext = {
    requestId,
    correlationId,
    startTime: Date.now(),
    path: request.url,
    method: request.method,
    ip: request.ip || (request.headers['x-forwarded-for'] as string) || 'unknown',
    userAgent: (request.headers['user-agent'] as string) || 'unknown',
    metadata: {}
  };
  
  requestContexts.set(requestId, context);
  return context;
}

/**
 * Get request context by ID
 */
export function getRequestContext(requestId: string): RequestContext | undefined {
  return requestContexts.get(requestId);
}

/**
 * Clean up request context
 */
export function cleanupRequestContext(requestId: string): void {
  requestContexts.delete(requestId);
}

/**
 * Add metadata to request context
 */
export function addRequestMetadata(requestId: string, key: string, value: unknown): void {
  const context = requestContexts.get(requestId);
  if (context) {
    context.metadata[key] = value;
  }
}

/**
 * Set user ID in request context
 */
export function setRequestUserId(requestId: string, userId: string): void {
  const context = requestContexts.get(requestId);
  if (context) {
    context.userId = userId;
  }
}

/**
 * Calculate request duration
 */
export function getRequestDuration(requestId: string): number {
  const context = requestContexts.get(requestId);
  if (!context) return 0;
  return Date.now() - context.startTime;
}

/**
 * Log request completion with timing
 */
export function logRequestCompletion(
  requestId: string, 
  statusCode: number,
  error?: Error
): void {
  const context = requestContexts.get(requestId);
  if (!context) return;
  
  const duration = getRequestDuration(requestId);
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  const logData = {
    requestId: context.requestId,
    correlationId: context.correlationId,
    method: context.method,
    path: context.path,
    statusCode,
    duration,
    ip: context.ip,
    userId: context.userId,
    ...(error && { error: error.message, stack: error.stack }),
    ...context.metadata
  };
  
  const message = `${context.method} ${context.path} ${statusCode} ${duration}ms`;
  
  if (level === 'error') {
    log.error(message, logData);
  } else if (level === 'warn') {
    log.warn(message, logData);
  } else {
    log.info(message, logData);
  }
  
  // Clean up context after logging
  cleanupRequestContext(requestId);
}

/**
 * Fastify hook to inject request context
 */
export function requestTracingHook(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const context = createRequestContext(request);
  
  // Add headers to response
  reply.header('X-Request-ID', context.requestId);
  reply.header('X-Correlation-ID', context.correlationId);
  
  // Attach context to request for access in handlers
  (request as any).requestContext = context;
  
  done();
}

/**
 * Fastify hook to log response
 */
export function responseLoggingHook(request: FastifyRequest, reply: FastifyReply, done: () => void): void {
  const context = (request as any).requestContext as RequestContext | undefined;
  if (context) {
    logRequestCompletion(context.requestId, reply.statusCode);
  }
  done();
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string) {
  const context = requestContexts.get(requestId);
  const baseData = { requestId, correlationId: context?.correlationId };
  
  return {
    info: (msg: string, data?: Record<string, unknown>) => {
      log.info(msg, { ...baseData, ...data });
    },
    warn: (msg: string, data?: Record<string, unknown>) => {
      log.warn(msg, { ...baseData, ...data });
    },
    error: (msg: string, data?: Record<string, unknown>) => {
      log.error(msg, { ...baseData, ...data });
    },
    debug: (msg: string, data?: Record<string, unknown>) => {
      log.debug(msg, { ...baseData, ...data });
    }
  };
}

// Cleanup stale contexts periodically (contexts older than 5 minutes)
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  for (const [requestId, context] of requestContexts.entries()) {
    if (now - context.startTime > staleThreshold) {
      log.warn('Cleaning up stale request context', { requestId });
      requestContexts.delete(requestId);
    }
  }
}, 60000); // Check every minute
