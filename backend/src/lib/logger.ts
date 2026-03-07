export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function nowMs(): number {
  return Date.now();
}

function safeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }

  return { error: err };
}

// C-45, COMP-10: PII fields that must never appear in structured log output.
// receiptUrl and documentUrl may contain signed S3 URLs with embedded credentials.
const PII_REDACTED_FIELDS = new Set<string>([
  'password',
  'passwordHash',
  'tin',
  'bvn',
  'nin',
  'bankAccount',
  'accountNumber',
  'cardNumber',
  'mfaSecret',
  'mfaTempSecret',
  'ecdsaPrivateKey',
  'duploClientSecret',
  'remitaApiKey',
  'flutterwaveSecretKey',
  'receiptUrl',
  'documentUrl',
]);

/**
 * Shallow-clone `fields` replacing any PII_REDACTED_FIELDS values with '[REDACTED]'.
 * Does not mutate input.
 */
function scrubFields(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = PII_REDACTED_FIELDS.has(k) ? '[REDACTED]' : v;
  }
  return out;
}

function write(level: LogLevel, component: string, msg: string, fields?: LogFields) {
  const line = {
    level,
    time: nowMs(),
    pid: process.pid,
    component,
    msg,
    ...(scrubFields(fields) ?? {}),
  };

  const payload = JSON.stringify(line);

  if (level === 'error') {
    process.stderr.write(`${payload}\n`);
  } else {
    process.stdout.write(`${payload}\n`);
  }
}

/**
 * Resolve pino-compatible overloads:
 *   log.info('message')                   — canonical single-arg
 *   log.info('message', { fields })       — canonical with context
 *   log.info({ fields }, 'message')       — pino-style (used by routes)
 */
function resolve(
  msgOrFields: string | LogFields,
  fieldsOrMsg?: LogFields | string,
): { msg: string; fields?: LogFields } {
  if (typeof msgOrFields === 'string') {
    return {
      msg:    msgOrFields,
      fields: typeof fieldsOrMsg === 'object' ? fieldsOrMsg : undefined,
    };
  }
  return {
    msg:    typeof fieldsOrMsg === 'string' ? fieldsOrMsg : '(no message)',
    fields: msgOrFields,
  };
}

export function createLogger(component: string) {
  return {
    debug(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolve(msgOrFields, fieldsOrMsg);
      write('debug', component, msg, fields);
    },
    info(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolve(msgOrFields, fieldsOrMsg);
      write('info', component, msg, fields);
    },
    warn(msgOrFields: string | LogFields, fieldsOrMsg?: LogFields | string) {
      const { msg, fields } = resolve(msgOrFields, fieldsOrMsg);
      write('warn', component, msg, fields);
    },
    error(
      msgOrFields: string | (LogFields & { err?: unknown }),
      fieldsOrMsg?: (LogFields & { err?: unknown }) | string,
    ) {
      const { msg, fields } = resolve(
        msgOrFields as string | LogFields,
        fieldsOrMsg as LogFields | string,
      );
      const err = (fields as any)?.err;
      const rest: LogFields = { ...(fields ?? {}) };
      if ('err' in rest) delete (rest as any).err;
      write('error', component, msg, {
        ...rest,
        ...(err !== undefined ? { err: safeError(err) } : {}),
      });
    },
  };
}
