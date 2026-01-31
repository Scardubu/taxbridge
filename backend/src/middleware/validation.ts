import { z, ZodSchema, ZodError } from 'zod';
import { parseStringPromise } from 'xml2js';
import {
  commonSchemas,
  sanitizeFilePath,
  sanitizeHTML,
  sanitizeSQLInput
} from '../schemas/commonValidators';
export const schemas = commonSchemas;

export { sanitizeSQLInput, sanitizeHTML, sanitizeFilePath };

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
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      throw error;
    }
  };
}
