/**
 * UBL 3.0 / Peppol BIS Billing 3.0 Validation Script
 * Validates sample UBL XML against the 55 mandatory fields required by NRS 2026
 * 
 * Usage: node dist/src/tools/ubl-validate.js
 */

import { generateUBL, InvoiceData } from '../lib/ubl/generator';
import { VAT_RATE } from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';
import { analyzeMandatoryFields, PEPPOL_MANDATORY_FIELDS } from '../lib/ubl/mandatoryFields';
import { validateUblXml } from '../lib/ubl';
import { PARTY_ID_SCHEME_TIN, PEPPOL_ENDPOINT_SCHEME } from '../lib/constants';

const log = createLogger('ubl-validate');

interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  presentFields: string[];
  errors: string[];
  warnings: string[];
}

function validateUBLStructure(xml: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    missingFields: [],
    presentFields: [],
    errors: [],
    warnings: []
  };

  // Check for required namespaces
  const requiredNamespaces = [
    'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
  ];

  for (const ns of requiredNamespaces) {
    if (!xml.includes(ns)) {
      result.errors.push(`Missing required namespace: ${ns}`);
      result.valid = false;
    }
  }

  // Check for Peppol profile/customization
  const peppolProfileRegex = /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/;
  const peppolCustomizationRegex = /<cbc:CustomizationID>urn:cen\.eu:en16931:2017#compliant#urn:fdc:peppol\.eu:2017:poacc:billing:3\.0<\/cbc:CustomizationID>/;
  if (!peppolProfileRegex.test(xml)) {
    result.errors.push('Missing Peppol BIS Billing 3.0 ProfileID');
    result.valid = false;
  }
  if (!peppolCustomizationRegex.test(xml)) {
    result.errors.push('Missing Peppol BIS Billing 3.0 CustomizationID');
    result.valid = false;
  }

  const analysis = analyzeMandatoryFields(xml);
  result.presentFields = analysis.presentFields;
  result.missingFields = analysis.missingFields;
  if (analysis.missingFields.length > 0) {
    result.valid = false;
  }

  const endpointRegex = new RegExp(`<cbc:EndpointID\\s+schemeID="${PEPPOL_ENDPOINT_SCHEME}">([^<]+)<\\/cbc:EndpointID>`, 'i');
  const endpointMatches = xml.match(new RegExp(endpointRegex.source, 'gi')) || [];
  if (endpointMatches.length < 2) {
    result.errors.push('Missing EndpointID with ISO 6523 scheme for supplier/customer');
    result.valid = false;
  }

  const partyIdRegex = new RegExp(`<cbc:ID\\s+schemeID="${PARTY_ID_SCHEME_TIN}">([^<]+)<\\/cbc:ID>`, 'i');
  const partyIdMatches = xml.match(new RegExp(partyIdRegex.source, 'gi')) || [];
  if (partyIdMatches.length < 2) {
    result.errors.push('Missing PartyIdentification cbc:ID with schemeID="TIN" for supplier/customer');
    result.valid = false;
  }

  // Nigeria-specific validations
  if (!analysis.hasNigeriaCurrency) {
    result.errors.push('Currency must be NGN (Nigerian Naira)');
    result.valid = false;
  }

  // Check for 7.5% VAT rate
  if (!analysis.hasVatRate) {
    result.warnings.push('VAT rate should be 7.5% for Nigeria');
  }

  return result;
}

async function main() {
  log.info('Starting UBL 3.0 validation...');

  try {
    // Generate a sample UBL invoice
    const sampleItems = [
      { description: 'Test Item 1', quantity: 10, unitPrice: 1000 },
      { description: 'Test Item 2', quantity: 5, unitPrice: 2000 }
    ];
    const subtotal = sampleItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vat = +(subtotal * VAT_RATE).toFixed(2);
    const total = +(subtotal + vat).toFixed(2);

    const sampleInvoice: InvoiceData = {
      id: 'TEST-001',
      issueDate: new Date().toISOString().split('T')[0],
      supplierTIN: '1234567890',
      supplierName: 'Test Supplier Ltd',
      customerTIN: '9876543210',
      customerName: 'Test Customer Ltd',
      items: sampleItems,
      subtotal,
      vat,
      total
    };

    log.info('Generating UBL XML...');
    const ublXml = generateUBL(sampleInvoice);

    log.info('Validating UBL structure...');
    const validation = validateUBLStructure(ublXml);

    // Log results
    log.info('\n' + '='.repeat(80));
    log.info('UBL 3.0 VALIDATION RESULTS');
    log.info('='.repeat(80));
    log.info(`Status: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
    log.info(`Present fields: ${validation.presentFields.length}/${PEPPOL_MANDATORY_FIELDS.length}`);
    
    if (validation.missingFields.length > 0) {
      log.info(`\n❌ Missing mandatory fields (${validation.missingFields.length}):`);
      validation.missingFields.forEach(field => log.info(`  - ${field}`));
    }

    if (validation.errors.length > 0) {
      log.info(`\n❌ Errors (${validation.errors.length}):`);
      validation.errors.forEach(err => log.info(`  - ${err}`));
    }

    if (validation.warnings.length > 0) {
      log.info(`\n⚠️  Warnings (${validation.warnings.length}):`);
      validation.warnings.forEach(warn => log.info(`  - ${warn}`));
    }

    log.info('='.repeat(80) + '\n');

    // Exit with appropriate code
    process.exit(validation.valid ? 0 : 1);
  } catch (error) {
    log.error('Validation script failed', { err: error });
    process.exit(1);
  }
}

main();
