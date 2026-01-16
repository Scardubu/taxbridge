import { z, ZodSchema, ZodError } from 'zod';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { parseStringPromise } from 'xml2js';

const window = new JSDOM('').window as unknown as Window;
const DOMPurify = createDOMPurify(window);

export const schemas = {
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

export async function validateUBL(xml: string): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const invoice = parsed?.Invoice;
    const errors: string[] = [];

    if (!invoice) {
      return { valid: false, errors: ['Missing Invoice root element'] };
    }

    if (!invoice['cbc:ID']) errors.push('Missing cbc:ID');
    if (!invoice['cbc:IssueDate']) errors.push('Missing cbc:IssueDate');
    if (!invoice['cac:AccountingSupplierParty']) errors.push('Missing supplier party');
    if (!invoice['cac:AccountingCustomerParty']) errors.push('Missing customer party');
    if (!Array.isArray(invoice['cac:InvoiceLine']) || invoice['cac:InvoiceLine'].length === 0) {
      errors.push('At least one cac:InvoiceLine is required');
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: ['Invalid XML structure'] };
  }
}

export function validateRequest<T extends ZodSchema>(schema: T) {
  return async (request: any, reply: any) => {
    try {
      request.validatedData = await schema.parseAsync(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  };
}
