import crypto, { CipherGCM, DecipherGCM } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';

const log = createLogger('encryption');
const SENSITIVE_FIELDS = new Set([
  'tin',
  'nin',
  'duploClientId',
  'duploClientSecret',
  'remitaMerchantId',
  'remitaApiKey',
  'ecdsaPrivateKey'
]);

class EncryptionService {
  private algorithm: 'aes-256-gcm' = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      log.warn('ENCRYPTION_KEY missing. Generating ephemeral key – restart will invalidate encrypted data.');
    }
    const derivedSecret = secret || crypto.randomBytes(32).toString('hex');
    this.key = crypto.scryptSync(derivedSecret, 'taxbridge-salt', 32);
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const cipher: CipherGCM = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted payload format');
    }

    const decipher: DecipherGCM = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

export const encryption = new EncryptionService();

type PrismaMiddlewareParams = Prisma.MiddlewareParams;

function encryptUserFields(data: Record<string, any>): void {
  for (const field of SENSITIVE_FIELDS) {
    if (typeof data[field] === 'string' && data[field]) {
      data[field] = encryption.encrypt(data[field]);
    }
  }
}

function decryptUserFields<T>(record: T): T {
  if (!record || typeof record !== 'object') {
    return record;
  }

  for (const field of SENSITIVE_FIELDS) {
    const currentValue = (record as Record<string, any>)[field];
    if (typeof currentValue === 'string' && currentValue.includes(':')) {
      try {
        (record as Record<string, any>)[field] = encryption.decrypt(currentValue);
      } catch (error) {
        log.error('Failed to decrypt field', { field, error });
      }
    }
  }

  return record;
}

export function attachEncryptionMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params: PrismaMiddlewareParams, next) => {
    if (params.model === 'User' && params.args?.data) {
      encryptUserFields(params.args.data);
    }

    const result = await next(params);

    if (params.model === 'User') {
      if (Array.isArray(result)) {
        return result.map(record => decryptUserFields(record));
      }
      return decryptUserFields(result);
    }

    return result;
  });
}
