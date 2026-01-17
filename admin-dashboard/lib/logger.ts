export type LogMeta = Record<string, unknown>;

function normalizeError(error: unknown): {
  name?: string;
  message: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function logError(
  context: string,
  error: unknown,
  meta?: LogMeta,
  options?: { suppressInProd?: boolean }
) {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && options?.suppressInProd) return;

  const normalized = normalizeError(error);

  if (isProd) {
    // Keep production logs concise and avoid leaking large payloads.
    console.error(context, {
      name: normalized.name,
      message: normalized.message,
      ...(meta ? { meta } : {}),
    });
    return;
  }

  console.error(context, {
    ...normalized,
    ...(meta ? { meta } : {}),
  });
}
