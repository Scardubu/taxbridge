import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { PEPPOL_ENDPOINT_SCHEME, PARTY_ID_SCHEME_TIN } from '../constants';
import { analyzeMandatoryFields } from './mandatoryFields';

interface UblValidationResult {
  ok: boolean;
  error?: string;
  errors?: string[];
  warnings?: string[];
  missingFields?: string[];
}

export const validateUblXml = (xml: string, xsdPath?: string): UblValidationResult => {
  try {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic XML structure validation using fast-xml-parser
    const validationResult = XMLValidator.validate(xml);
    
    if (validationResult !== true) {
      return { 
        ok: false, 
        error: 'UBL XML structure validation failed', 
        errors: ['UBL XML structure validation failed'],
        warnings
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
        errors: ['Invalid UBL structure: Invoice element not found'],
        warnings
      };
    }

    const peppolProfileRegex = /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/;
    const peppolCustomizationRegex = /<cbc:CustomizationID>urn:cen\.eu:en16931:2017#compliant#urn:fdc:peppol\.eu:2017:poacc:billing:3\.0<\/cbc:CustomizationID>/;

    if (!peppolProfileRegex.test(xml)) {
      errors.push('Missing Peppol BIS Billing 3.0 ProfileID');
    }

    if (!peppolCustomizationRegex.test(xml)) {
      errors.push('Missing Peppol BIS Billing 3.0 CustomizationID');
    }

    const analysis = analyzeMandatoryFields(xml);
    if (analysis.missingFields.length > 0) {
      errors.push(`Missing mandatory fields: ${analysis.missingFields.join(', ')}`);
    }

    const endpointRegex = new RegExp(`<cbc:EndpointID\\s+schemeID="${PEPPOL_ENDPOINT_SCHEME}">([^<]+)<\\/cbc:EndpointID>`, 'i');
    const endpointMatches = xml.match(new RegExp(endpointRegex.source, 'gi')) || [];
    if (endpointMatches.length < 2) {
      errors.push('Missing EndpointID with ISO 6523 scheme for supplier/customer');
    }

    const partyIdRegex = new RegExp(`<cbc:ID\\s+schemeID="${PARTY_ID_SCHEME_TIN}">([^<]+)<\\/cbc:ID>`, 'i');
    const partyIdMatches = xml.match(new RegExp(partyIdRegex.source, 'gi')) || [];
    if (partyIdMatches.length < 2) {
      errors.push('Missing PartyIdentification cbc:ID with schemeID="TIN" for supplier/customer');
    }

    if (xml.includes('>N/A<')) {
      errors.push('Mandatory identifiers must not be N/A');
    }

    if (!analysis.hasNigeriaCurrency) {
      errors.push('Currency must be NGN (Nigerian Naira)');
    }

    if (!analysis.hasVatRate) {
      warnings.push('VAT rate should be 7.5% for Nigeria');
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: errors[0],
        errors,
        warnings,
        missingFields: analysis.missingFields
      };
    }

    // Note: Full XSD validation requires external service or deployment-time check
    // For now, we rely on structural + mandatory-field validation
    return { ok: true, warnings };
  } catch (err) {
    return { 
      ok: false, 
      error: err instanceof Error ? err.message : 'UBL XML validation failed',
      errors: [err instanceof Error ? err.message : 'UBL XML validation failed']
    };
  }
}
