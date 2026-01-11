import crypto from 'crypto';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(',')}}`;
}

export function computeRequestHash(input: {
  method: string;
  path: string;
  body: unknown;
}): string {
  const payload = `${input.method.toUpperCase()} ${input.path} ${stableStringify(input.body)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
