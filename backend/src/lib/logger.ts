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

export function createLogger(component: string) {
  return {
    debug(msg: string, fields?: LogFields) {
      write('debug', component, msg, fields);
    },
    info(msg: string, fields?: LogFields) {
      write('info', component, msg, fields);
    },
    warn(msg: string, fields?: LogFields) {
      write('warn', component, msg, fields);
    },
    error(msg: string, fields?: LogFields & { err?: unknown }) {
      const err = fields?.err;
      const rest: LogFields = { ...(fields ?? {}) };
      if ('err' in rest) delete (rest as any).err;
      write('error', component, msg, { ...rest, ...(err !== undefined ? { err: safeError(err) } : {}) });
    }
  };
}
