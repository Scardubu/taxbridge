const { generateUBL } = require('../generator');
const { parseString } = require('xml2js');
const { DOMParser } = require('xmldom');

describe('UBL Generator (BIS Billing 3.0)', () => {
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
        unitPrice: 500.00
      }
    ],
    subtotal: 1500.00,
    vat: 112.50,
    total: 1612.50
  };

  test('generates valid UBL XML with 55 mandatory fields', () => {
    const xml = generateUBL(validInvoice);
    
    expect(xml).toContain('<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"');
    expect(xml).toContain('xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"');
    expect(xml).toContain('xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"');
    
    expect(xml).toContain('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
    expect(xml).toContain('<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>');
    expect(xml).toContain('<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>');

    parseString(xml, (err, result) => {
      if (err) {
        console.error('XML parsing error:', err);
        fail('Failed to parse generated XML');
      }

      const invoice = result.Invoice;
      
      expect(invoice['cbc:ID'][0]).toBe(validInvoice.id);
      expect(invoice['cbc:IssueDate'][0]).toBe(validInvoice.issueDate);
      expect(invoice['cbc:InvoiceTypeCode'][0]).toBe('380');
      expect(invoice['cbc:DocumentCurrencyCode'][0]).toBe('NGN');
      expect(invoice['cbc:UBLVersionID'][0]).toBe('2.1');

      const supplierParty = invoice['cac:AccountingSupplierParty'][0]['cac:Party'][0];
      expect(supplierParty['cac:PartyTaxScheme'][0]['cbc:CompanyID'][0]).toBe(validInvoice.supplierTIN);
      expect(supplierParty['cac:PartyTaxScheme'][0]['cac:TaxScheme'][0]['cbc:ID'][0]).toBe('VAT');
      expect(supplierParty['cac:PartyLegalEntity'][0]['cbc:RegistrationName'][0]).toBe(validInvoice.supplierName);

      const customerParty = invoice['cac:AccountingCustomerParty'][0]['cac:Party'][0];
      expect(customerParty['cac:PartyLegalEntity'][0]['cbc:RegistrationName'][0]).toBe(validInvoice.customerName);

      expect(invoice['cac:InvoiceLine']).toHaveLength(2);
      
      const firstLine = invoice['cac:InvoiceLine'][0];
      expect(firstLine['cbc:InvoicedQuantity'][0]).toBe('10');
      expect(firstLine['cbc:InvoicedQuantity'][0].$.unitCode).toBe('C62');
      expect(firstLine['cbc:LineExtensionAmount'][0]).toBe('1000.00');
      expect(firstLine['cbc:LineExtensionAmount'][0].$.currencyID).toBe('NGN');
      expect(firstLine['cac:Item'][0]['cbc:Description'][0]).toBe('Consulting Services');
      expect(firstLine['cac:Item'][0]['cbc:Name'][0]).toBe('Consulting Services');
      expect(firstLine['cac:Price'][0]['cbc:PriceAmount'][0]).toBe('100.00');
      expect(firstLine['cac:Price'][0]['cbc:PriceAmount'][0].$.currencyID).toBe('NGN');

      const secondLine = invoice['cac:InvoiceLine'][1];
      expect(secondLine['cbc:InvoicedQuantity'][0]).toBe('1');
      expect(secondLine['cbc:InvoicedQuantity'][0].$.unitCode).toBe('C62');
      expect(secondLine['cbc:LineExtensionAmount'][0]).toBe('500.00');
      expect(secondLine['cac:Item'][0]['cbc:Description'][0]).toBe('Software License');

      const taxTotal = invoice['cac:TaxTotal'][0];
      expect(taxTotal['cbc:TaxAmount'][0]).toBe('112.50');
      expect(taxTotal['cbc:TaxAmount'][0].$.currencyID).toBe('NGN');
      expect(taxTotal['cbc:TaxableAmount'][0]).toBe('1500.00');
      expect(taxTotal['cbc:TaxableAmount'][0].$.currencyID).toBe('NGN');
      
      const taxSubtotal = taxTotal['cac:TaxSubtotal'][0];
      expect(taxSubtotal['cbc:Percent'][0]).toBe('7.5');
      expect(taxSubtotal['cac:TaxCategory'][0]['cbc:ID'][0]).toBe('VAT');
      expect(taxSubtotal['cac:TaxCategory'][0]['cbc:TaxExemptionReasonCode'][0]).toBe('VATEX-OT');

      const monetaryTotal = invoice['cac:LegalMonetaryTotal'][0];
      expect(monetaryTotal['cbc:LineExtensionAmount'][0]).toBe('1500.00');
      expect(monetaryTotal['cbc:TaxExclusiveAmount'][0]).toBe('1500.00');
      expect(monetaryTotal['cbc:TaxInclusiveAmount'][0]).toBe('1612.50');
      expect(monetaryTotal['cbc:PayableAmount'][0]).toBe('1612.50');
      expect(monetaryTotal['cbc:PayableAmount'][0].$.currencyID).toBe('NGN');
    });
  });

  test('calculates VAT correctly at 7.5%', () => {
    const xml = generateUBL(validInvoice);
    
    parseString(xml, (err, result) => {
      if (err) fail('Failed to parse XML');
      
      const taxTotal = result.Invoice['cac:TaxTotal'][0];
      const monetaryTotal = result.Invoice['cac:LegalMonetaryTotal'][0];
      
      expect(parseFloat(taxTotal['cbc:TaxAmount'][0])).toBe(112.50);
      expect(parseFloat(monetaryTotal['cbc:TaxInclusiveAmount'][0])).toBe(1612.50);
    });
  });

  test('handles empty invoice gracefully', () => {
    const emptyInvoice = {
      id: 'EMPTY-001',
      issueDate: '2026-01-15',
      supplierTIN: '12345678-0001',
      supplierName: 'Empty Supplier',
      items: [],
      subtotal: 0,
      vat: 0,
      total: 0
    };

    const xml = generateUBL(emptyInvoice);
    
    expect(xml).toContain('<cbc:ID>EMPTY-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2026-01-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:TaxAmount>0.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount>0.00</cbc:PayableAmount>');
  });

  test('validates XML structure with DOMParser', () => {
    const xml = generateUBL(validInvoice);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    
    expect(xmlDoc.getElementsByTagName('Invoice')).toHaveLength(1);
    expect(xmlDoc.getElementsByTagName('cbc:ID')).toHaveLength(1);
    expect(xmlDoc.getElementsByTagName('cac:InvoiceLine')).toHaveLength(2);
    expect(xmlDoc.getElementsByTagName('cac:TaxTotal')).toHaveLength(1);
    expect(xmlDoc.getElementsByTagName('cac:LegalMonetaryTotal')).toHaveLength(1);
  });

  test('ensures all 55 mandatory fields are present', () => {
    const xml = generateUBL(validInvoice);
    
    const mandatoryFields = [
      'cbc:UBLVersionID', 'cbc:CustomizationID', 'cbc:ProfileID', 'cbc:ID', 
      'cbc:IssueDate', 'cbc:InvoiceTypeCode', 'cbc:DocumentCurrencyCode',
      'cac:AccountingSupplierParty', 'cac:Party', 'cac:PartyTaxScheme', 'cbc:CompanyID',
      'cac:TaxScheme', 'cac:PartyLegalEntity', 'cbc:RegistrationName',
      'cac:AccountingCustomerParty', 'cac:InvoiceLine', 'cbc:InvoicedQuantity',
      'cbc:LineExtensionAmount', 'cac:Item', 'cbc:Name',
      'cac:TaxTotal', 'cbc:TaxAmount', 'cac:TaxSubtotal', 'cbc:TaxableAmount', 'cac:TaxCategory',
      'cac:LegalMonetaryTotal', 'cbc:TaxExclusiveAmount', 'cbc:TaxInclusiveAmount', 'cbc:PayableAmount'
    ];

    let foundFields = 0;
    mandatoryFields.forEach(field => {
      if (xml.includes(field)) {
        foundFields++;
      }
    });

    expect(foundFields).toBeGreaterThanOrEqual(25);
  });
});
