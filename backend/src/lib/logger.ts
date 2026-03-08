/**
 * Logger — TaxBridge V13 Sovereign
 *
 * Standalone Pino logger for services (route handlers use request.log).
 * Usage: import { logger } from '../lib/logger' — only in services, workers, cron
 * In route handlers: ALWAYS use request.log (Fastify child logger with request ID)
 */
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: [
    'req.headers.authorization',
    'body.password',
    'body.tin',
    'body.bvn',
    'body.receiptUrl',
    'body.documentUrl',
  ],
  ...(process.env.LOG_FORMAT !== 'json'
    ? { transport: { target: 'pino-pretty' } }
    : {}),
});

type LogFields = Record<string, unknown>;

/**
 * createLogger — backward compat factory.
 *
 * Supports BOTH:
 *   log.info('message')                   ← old custom API
 *   log.info('message', { fields })       ← old custom API
 *   log.info({ fields }, 'message')       ← pino-native API
 *
 * New code should import { logger } and call logger.child({ component })
 * or use request.log in route handlers.
 */
export function createLogger(component: string) {
  const child = logger.child({ component });

  function resolveArgs(
    msgOrFields: string | LogFields,
    fieldsOrMsg?: LogFields | string,
  ): { msg: string; fields: LogFields } {
    if (typeof msgOrFields === 'string') {
      return { msg: msgOrFields, fields: (typeof fieldsOrMsg === 'object' ? fieldsOrMsg : {}) as LogFields };
    }
    return { msg: typeof fieldsOrMsg === 'string' ? fieldsOrMsg : '(no message)', fields: msgOrFields };
  }

  return {
    debug(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolveArgs(msgOrFields, fieldsOrMsg);
      child.debug(fields, msg);
    },
    info(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolveArgs(msgOrFields, fieldsOrMsg);
      child.info(fields, msg);
    },
    warn(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolveArgs(msgOrFields, fieldsOrMsg);
      child.warn(fields, msg);
    },
    error(
      msgOrFields: string | (LogFields & { err?: unknown }),
      fieldsOrMsg?: (LogFields & { err?: unknown }) | string,
    ) {
      const { msg, fields } = resolveArgs(
        msgOrFields as string | LogFields,
        fieldsOrMsg as LogFields | string,
      );
      child.error(fields, msg);
    },
  };
}
