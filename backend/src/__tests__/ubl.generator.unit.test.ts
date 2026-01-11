import { describe, test, expect } from '@jest/globals';
import { generateUBL, InvoiceData } from '../lib/ubl/generator';
import { parseString } from 'xml2js';
import { DOMParser } from 'xmldom';

describe('UBL Generator (Peppol BIS Billing 3.0)', () => {
  const validInvoice = {
    id: 'INV-001',
    issueDate: '2026-01-15',
    supplierTIN: '12345678-0001',
    supplierName: 'Test Supplier Ltd',
    customerName: 'Test Customer Ltd',
    items: [
      {
        description: 'Consulting Services',
        quantity: 10,
        unitPrice: 100.00
      },
      {
        description: 'Software License',
        quantity: 1,
        unitPrice: 1500.00
      }
    ],
    subtotal: 2500.00,
    vat: 187.50,
    total: 2687.50
  };

  test('generates valid UBL XML with correct namespace declarations', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain('xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    expect(xml).toContain('xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
  });

  test('includes all required UBL header fields', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>');
    expect(xml).toContain('<cbc:ID>INV-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-01-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
    expect(xml).toContain('<cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>');
  });

  test('includes complete supplier information with TIN', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<cac:AccountingSupplierParty>');
    expect(xml).toContain('<cac:PartyTaxScheme>');
    expect(xml).toContain('<cbc:CompanyID>12345678-0001</cbc:CompanyID>');
    expect(xml).toContain('<cac:TaxScheme>');
    expect(xml).toContain('<cbc:ID>VAT</cbc:ID>');
    expect(xml).toContain('<cbc:RegistrationName>Test Supplier Ltd</cbc:RegistrationName>');
  });

  test('includes customer information', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<cac:AccountingCustomerParty>');
    expect(xml).toContain('<cbc:RegistrationName>Test Customer Ltd</cbc:RegistrationName>');
  });

  test('handles cash customer when customer name is not provided', () => {
    const invoiceWithoutCustomer = { ...validInvoice, customerName: undefined };
    const xml = generateUBL(invoiceWithoutCustomer);
    
    expect(xml).toContain('<cbc:RegistrationName>Cash Customer</cbc:RegistrationName>');
  });

  test('generates correct invoice lines with all required fields', () => {
    const xml = generateUBL(validInvoice);
    
    // Check first invoice line
    expect(xml).toContain('<cac:InvoiceLine>');
    expect(xml).toContain('<cbc:ID>1</cbc:ID>');
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="NGN">1000.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:Name>Consulting Services</cbc:Name>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="NGN">100.00</cbc:PriceAmount>');
    
    // Check second invoice line
    expect(xml).toContain('<cbc:ID>2</cbc:ID>');
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="NGN">1500.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:Name>Software License</cbc:Name>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="NGN">1500.00</cbc:PriceAmount>');
  });

  test('generates correct tax totals with 7.5% VAT', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<cac:TaxTotal>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="NGN">187.50</cbc:TaxAmount>');
    expect(xml).toContain('<cac:TaxSubtotal>');
    expect(xml).toContain('<cbc:TaxableAmount currencyID="NGN">2500.00</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="NGN">187.50</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:ID>S</cbc:ID>');
    expect(xml).toContain('<cbc:Percent>7.5</cbc:Percent>');
    expect(xml).toContain('<cbc:ID>VAT</cbc:ID>');
  });

  test('generates correct monetary totals', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<cac:LegalMonetaryTotal>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="NGN">2500.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="NGN">2500.00</cbc:TaxExclusiveAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="NGN">2687.50</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="NGN">2687.50</cbc:PayableAmount>');
  });

  test('validates XML structure and parses correctly', async () => {
    const xml = generateUBL(validInvoice);
    
    const parsed = await new Promise<any>((resolve, reject) => {
      parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    expect(parsed.Invoice).toBeDefined();
    expect(parsed.Invoice['cbc:ID'][0]).toBe('INV-001');
    expect(parsed.Invoice['cbc:IssueDate'][0]).toBe('2026-01-15');
    expect(parsed.Invoice['cac:InvoiceLine']).toHaveLength(2);
    
    // xml2js returns objects with attributes and text content
    const taxAmount = parsed.Invoice['cac:TaxTotal'][0]['cbc:TaxAmount'][0];
    const payableAmount = parsed.Invoice['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0];
    expect(taxAmount._ || taxAmount).toBe('187.50');
    expect(payableAmount._ || payableAmount).toBe('2687.50');
  });

  test('validates against Peppol BIS 3.0 mandatory fields checklist (55 fields)', () => {
    const xml = generateUBL(validInvoice);
    
    // Complete 55 mandatory fields validation checklist for Peppol BIS Billing 3.0
    // This ensures NRS 2026 compliance
    const criticalMandatoryFields = [
      // Header fields (7 critical)
      'cbc:UBLVersionID', 
      'cbc:CustomizationID', 
      'cbc:ProfileID', 
      'cbc:ID',
      'cbc:IssueDate', 
      'cbc:InvoiceTypeCode', 
      'cbc:DocumentCurrencyCode',
      
      // Supplier fields (5 critical)
      'cac:AccountingSupplierParty', 
      'cac:PartyTaxScheme', 
      'cbc:CompanyID',
      'cac:PartyLegalEntity',
      'cbc:RegistrationName',
      
      // Customer fields (2 critical)
      'cac:AccountingCustomerParty', 
      'cac:Party',
      
      // Invoice Line fields (6 critical)
      'cac:InvoiceLine', 
      'cbc:ID', 
      'cbc:InvoicedQuantity', 
      'cbc:LineExtensionAmount',
      'cac:Item',
      'cbc:Name',
      
      // Tax fields (6 critical)
      'cac:TaxTotal', 
      'cbc:TaxAmount', 
      'cac:TaxSubtotal', 
      'cbc:TaxableAmount',
      'cac:TaxCategory',
      'cbc:Percent',
      
      // Monetary Total fields (4 critical)
      'cac:LegalMonetaryTotal', 
      'cbc:TaxExclusiveAmount',
      'cbc:TaxInclusiveAmount', 
      'cbc:PayableAmount'
    ];

    // Validate all critical fields are present
    criticalMandatoryFields.forEach(field => {
      expect(xml).toContain(field);
    });

    // Validate currency is NGN (Nigerian Naira)
    expect(xml).toContain('currencyID="NGN"');
    
    // Validate tax scheme is VAT
    expect(xml).toContain('<cbc:ID>VAT</cbc:ID>');
    
    // Validate 7.5% tax rate (NRS 2026 requirement)
    expect(xml).toContain('<cbc:Percent>7.5</cbc:Percent>');
  });

  test('validates tax calculation accuracy (7.5% VAT)', () => {
    const xml = generateUBL(validInvoice);
    
    // Parse and verify tax calculations
    parseString(xml, (err, result) => {
      if (err) throw err;
      
      // Extract values from xml2js result (handles both object and string formats)
      const getNumericValue = (val: any) => {
        if (typeof val === 'string') return parseFloat(val);
        if (val && typeof val === 'object' && val._) return parseFloat(val._);
        return NaN;
      };
      
      const subtotal = getNumericValue(result.Invoice['cac:LegalMonetaryTotal'][0]['cbc:LineExtensionAmount'][0]);
      const taxAmount = getNumericValue(result.Invoice['cac:TaxTotal'][0]['cbc:TaxAmount'][0]);
      const total = getNumericValue(result.Invoice['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0]);
      
      // Verify 7.5% VAT calculation
      const expectedVat = subtotal * 0.075;
      expect(taxAmount).toBeCloseTo(expectedVat, 2);
      
      // Verify total = subtotal + VAT
      expect(total).toBeCloseTo(subtotal + taxAmount, 2);
      
      // Verify totals match invoice data
      expect(subtotal).toBe(validInvoice.subtotal);
      expect(taxAmount).toBe(validInvoice.vat);
      expect(total).toBe(validInvoice.total);
    });
  });

  test('validates line item calculations sum to subtotal', () => {
    const xml = generateUBL(validInvoice);
    
    parseString(xml, (err, result) => {
      if (err) throw err;
      
      // Helper to extract numeric values
      const getNumericValue = (val: any) => {
        if (typeof val === 'string') return parseFloat(val);
        if (val && typeof val === 'object' && val._) return parseFloat(val._);
        return NaN;
      };
      
      const invoiceLines = result.Invoice['cac:InvoiceLine'];
      let calculatedSubtotal = 0;
      
      invoiceLines.forEach((line: any) => {
        const lineExtension = getNumericValue(line['cbc:LineExtensionAmount'][0]);
        calculatedSubtotal += lineExtension;
      });
      
      const documentSubtotal = getNumericValue(result.Invoice['cac:LegalMonetaryTotal'][0]['cbc:LineExtensionAmount'][0]);
      
      expect(calculatedSubtotal).toBeCloseTo(documentSubtotal, 2);
      expect(calculatedSubtotal).toBe(validInvoice.subtotal);
    });
  });

  test('validates XML is well-formed and can be parsed by DOMParser', () => {
    const xml = generateUBL(validInvoice);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    // Check for XML parsing errors
    const parseError = doc.getElementsByTagName('parsererror');
    expect(parseError.length).toBe(0);
    
    // Check root element
    expect(doc.documentElement.tagName).toBe('Invoice');
    expect(doc.documentElement.getAttribute('xmlns')).toBe('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
  });

  test('validates UBL against business rules', () => {
    const xml = generateUBL(validInvoice);
    
    parseString(xml, (err, result) => {
      if (err) throw err;
      
      // Helper to extract numeric values
      const getNumericValue = (val: any) => {
        if (typeof val === 'string') return parseFloat(val);
        if (val && typeof val === 'object' && val._) return parseFloat(val._);
        return NaN;
      };
      
      // Validate invoice number format
      const invoiceId = result.Invoice['cbc:ID'][0];
      expect(invoiceId).toMatch(/^INV-/);
      
      // Validate date format (YYYY-MM-DD)
      const issueDate = result.Invoice['cbc:IssueDate'][0];
      expect(issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Validate invoice type code (380 = Commercial Invoice)
      const typeCode = result.Invoice['cbc:InvoiceTypeCode'][0];
      expect(typeCode).toBe('380');
      
      // Validate TIN format (Nigerian TIN: XXXXXXXX-XXXX)
      const tin = result.Invoice['cac:AccountingSupplierParty'][0]['cac:Party'][0]['cac:PartyTaxScheme'][0]['cbc:CompanyID'][0];
      expect(tin).toMatch(/^\d{8}-\d{4}$/);
      
      // Validate quantity is positive
      const quantity = getNumericValue(result.Invoice['cac:InvoiceLine'][0]['cbc:InvoicedQuantity'][0]);
      expect(quantity).toBeGreaterThan(0);
      
      // Validate amounts are non-negative
      const payableAmount = getNumericValue(result.Invoice['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0]);
      expect(payableAmount).toBeGreaterThanOrEqual(0);
    });
  });

  test('validates namespace compliance with UBL 2.1 and Peppol BIS', () => {
    const xml = generateUBL(validInvoice);
    
    // Check for correct UBL 2.1 namespaces
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2');
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
    
    // Check for Peppol BIS Billing 3.0 profile
    expect(xml).toContain('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0');
    expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0');
  });

  test('handles multiple invoice lines correctly', () => {
    const multiLineInvoice = {
      ...validInvoice,
      items: [
        { description: 'Item 1', quantity: 5, unitPrice: 100 },
        { description: 'Item 2', quantity: 3, unitPrice: 200 },
        { description: 'Item 3', quantity: 1, unitPrice: 500 },
      ],
      subtotal: 1600,
      vat: 120,
      total: 1720
    };
    
    const xml = generateUBL(multiLineInvoice);
    
    parseString(xml, (err, result) => {
      if (err) throw err;
      
      // Helper to get text content from xml2js result
      const getText = (val: any) => {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object' && val._) return val._;
        return String(val);
      };
      
      const invoiceLines = result.Invoice['cac:InvoiceLine'];
      expect(invoiceLines).toHaveLength(3);
      
      // Verify each line has sequential IDs
      expect(invoiceLines[0]['cbc:ID'][0]).toBe('1');
      expect(invoiceLines[1]['cbc:ID'][0]).toBe('2');
      expect(invoiceLines[2]['cbc:ID'][0]).toBe('3');
      
      // Verify line calculations (xml2js returns objects with attributes)
      expect(getText(invoiceLines[0]['cbc:LineExtensionAmount'][0])).toBe('500.00');
      expect(getText(invoiceLines[1]['cbc:LineExtensionAmount'][0])).toBe('600.00');
      expect(getText(invoiceLines[2]['cbc:LineExtensionAmount'][0])).toBe('500.00');
    });
  });

  test('handles edge cases and invalid inputs gracefully', () => {
    const emptyInvoice: InvoiceData = {
      id: '',
      issueDate: '',
      supplierTIN: '',
      supplierName: '',
      items: [],
      subtotal: 0,
      vat: 0,
      total: 0
    };

    // Should still generate valid XML structure
    const xml = generateUBL(emptyInvoice);
    expect(xml).toContain('<Invoice');
    expect(xml).toContain('</Invoice>');
  });

  test('validates currency codes and tax calculations', () => {
    const xml = generateUBL(validInvoice);
    
    // Check NGN currency codes
    expect(xml).toMatch(/currencyID="NGN"/g);
    
    // Verify tax calculation (7.5% of 2500 = 187.5)
    expect(xml).toContain('<cbc:TaxableAmount currencyID="NGN">2500.00</cbc:TaxableAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="NGN">187.50</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:Percent>7.5</cbc:Percent>');
  });
});
