/**
 * UBL 3.0 / Peppol BIS Billing 3.0 Validation Script
 * Validates sample UBL XML against the 55 mandatory fields required by NRS 2026
 * 
 * Usage: node dist/src/tools/ubl-validate.js
 */

import { generateUBL, InvoiceData } from '../lib/ubl/generator';
import { createLogger } from '../lib/logger';
import fs from 'fs';
import path from 'path';
import { analyzeMandatoryFields, PEPPOL_MANDATORY_FIELDS } from '../lib/ubl/mandatoryFields';

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

  // Check for Peppol profile
  const peppolProfileRegex = /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/;
  if (!peppolProfileRegex.test(xml)) {
    result.warnings.push('Missing Peppol BIS Billing 3.0 ProfileID');
  }

  const analysis = analyzeMandatoryFields(xml);
  result.presentFields = analysis.presentFields;
  result.missingFields = analysis.missingFields;
  if (analysis.missingFields.length > 0) {
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
    const vat = +(subtotal * 0.075).toFixed(2);
    const total = +(subtotal + vat).toFixed(2);

    const sampleInvoice: InvoiceData = {
      id: 'TEST-001',
      issueDate: new Date().toISOString().split('T')[0],
      supplierTIN: '1234567890',
      supplierName: 'Test Supplier Ltd',
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
    console.log('\n' + '='.repeat(80));
    console.log('UBL 3.0 VALIDATION RESULTS');
    console.log('='.repeat(80));
    console.log(`Status: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Present fields: ${validation.presentFields.length}/${PEPPOL_MANDATORY_FIELDS.length}`);
    
    if (validation.missingFields.length > 0) {
      console.log(`\n❌ Missing mandatory fields (${validation.missingFields.length}):`);
      validation.missingFields.forEach(field => console.log(`  - ${field}`));
    }

    if (validation.errors.length > 0) {
      console.log(`\n❌ Errors (${validation.errors.length}):`);
      validation.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${validation.warnings.length}):`);
      validation.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    console.log('='.repeat(80) + '\n');

    // Exit with appropriate code
    process.exit(validation.valid ? 0 : 1);
  } catch (error) {
    log.error('Validation failed:', { err: error });
    console.error('\n❌ Validation script failed:', error);
    process.exit(1);
  }
}

main();
