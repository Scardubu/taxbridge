import fs from 'fs';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const validateUblXml = (xml, xsdPath) => {
  try {
    // Basic XML structure validation using fast-xml-parser
    const validationResult = XMLValidator.validate(xml);
    
    if (validationResult !== true) {
      return { 
        ok: false, 
        error: 'UBL XML structure validation failed', 
        details: validationResult.err 
      };
    }

    // Parse XML to verify structure
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    const xmlObj = parser.parse(xml);
    
    // Basic UBL structure checks
    const hasInvoice = xmlObj?.Invoice || xmlObj?.['ubl:Invoice'] || xmlObj?.['Invoice'];
    
    if (!hasInvoice) {
      return { 
        ok: false, 
        error: 'Invalid UBL structure: Invoice element not found',
        details: 'Root element must be Invoice'
      };
    }

    // Note: Full XSD validation requires external service or deployment-time check
    // For MVP, we rely on structural validation and DigiTax APP validation
    return { ok: true };
  } catch (err) {
    return { 
      ok: false, 
      error: err instanceof Error ? err.message : 'UBL XML validation failed' 
    };
  }
}
