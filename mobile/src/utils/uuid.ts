function randomHex(bytes: number): string {
  const out: string[] = [];
  for (let i = 0; i < bytes; i += 1) {
    out.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return out.join('');
}

export function generateUuid(): string {
  // Prefer platform implementation when available
  const cryptoAny = globalThis as any;
  const maybeRandomUUID = cryptoAny?.crypto?.randomUUID || cryptoAny?.randomUUID;
  if (typeof maybeRandomUUID === 'function') {
    try {
      return maybeRandomUUID.call(cryptoAny.crypto ?? cryptoAny);
    } catch {
      // fall through
    }
  }

  // RFC 4122-ish v4 fallback (not cryptographically secure)
  const hex = randomHex(16);
  const b = hex.split('');

  // Version 4
  b[12] = '4';
  // Variant 10xx
  const variant = (parseInt(b[16], 16) & 0x3) | 0x8;
  b[16] = variant.toString(16);

  const s = b.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
