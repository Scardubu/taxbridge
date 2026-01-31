import { z } from 'zod';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const jsdomWindow = new JSDOM('').window;
const DOMPurify = createDOMPurify(jsdomWindow as unknown as typeof globalThis);

export const commonSchemas = {
  phoneNumber: z.string().regex(/^\+234[789]\d{9}$/, 'Invalid Nigerian phone number'),
  tin: z.string().regex(/^\d{8}-\d{4}$/, 'Invalid TIN format (XXXXXXXX-XXXX)'),
  nin: z.string().regex(/^\d{11}$/, 'Invalid NIN format (11 digits)'),
  amount: z.number().positive().max(1_000_000_000, 'Amount too large'),
  email: z.string().email().max(255),
  name: z
    .string()
    .min(2, 'Name too short')
    .max(100, 'Name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
  invoiceDescription: z
    .string()
    .min(1, 'Description required')
    .max(500, 'Description too long')
    .transform(value => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })),
  apiKey: z.string().min(32).max(128).regex(/^[a-zA-Z0-9+/=]+$/, 'Invalid API key format')
};

export function sanitizeSQLInput(input: string): string {
  return input.replace(/[\'\";\\]/g, '').substring(0, 255);
}

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
}

export function sanitizeFilePath(filePath: string): string {
  return filePath.replace(/\.\./g, '').replace(/^\/+/, '').substring(0, 255);
}
