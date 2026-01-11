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

function write(level: LogLevel, component: string, msg: string, fields?: LogFields) {
  const line = {
    level,
    time: nowMs(),
    pid: process.pid,
    component,
    msg,
    ...(fields ?? {})
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
