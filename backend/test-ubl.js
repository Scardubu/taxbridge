const { generateUBL } = require('./src/lib/ubl/generator');

// Simple test runner
function runTests() {
  console.log('🧪 Running UBL Generator Tests...\n');
  
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

  try {
    // Test 1: Generate UBL XML
    console.log('✅ Test 1: Generating UBL XML...');
    const xml = generateUBL(validInvoice);
    console.log('✅ UBL XML generated successfully');
    console.log(`📄 XML Length: ${xml.length} characters`);
    
    // Test 2: Check for required elements
    console.log('\n✅ Test 2: Validating required elements...');
    const requiredElements = [
      '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
      'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
      'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
      '<cbc:UBLVersionID>2.1</cbc:UBLVersionID>',
      '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>',
      '<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>',
      '<cbc:ID>INV-001</cbc:ID>',
      '<cbc:IssueDate>2026-01-15</cbc:IssueDate>',
      '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>',
      '<cbc:DocumentCurrencyCode>NGN</cbc:DocumentCurrencyCode>',
      '<cbc:CompanyID>12345678-0001</cbc:CompanyID>',
      '<cbc:RegistrationName>Test Supplier Ltd</cbc:RegistrationName>',
      '<cbc:RegistrationName>Test Customer Ltd</cbc:RegistrationName>',
      '<cbc:TaxAmount currencyID="NGN">187.50</cbc:TaxAmount>',
      '<cbc:TaxableAmount currencyID="NGN">2500.00</cbc:TaxableAmount>',
      '<cbc:Percent>7.5</cbc:Percent>',
      '<cbc:PayableAmount currencyID="NGN">2687.50</cbc:PayableAmount>'
    ];

    let passedElements = 0;
    requiredElements.forEach(element => {
      if (xml.includes(element)) {
        passedElements++;
      } else {
        console.log(`❌ Missing: ${element}`);
      }
    });
    
    console.log(`✅ Elements validation: ${passedElements}/${requiredElements.length} passed`);
    
    // Test 3: Check invoice lines
    console.log('\n✅ Test 3: Validating invoice lines...');
    const lineChecks = [
      '<cbc:ID>1</cbc:ID>',
      '<cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>',
      '<cbc:LineExtensionAmount currencyID="NGN">1000.00</cbc:LineExtensionAmount>',
      '<cbc:Name>Consulting Services</cbc:Name>',
      '<cbc:ID>2</cbc:ID>',
      '<cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>',
      '<cbc:LineExtensionAmount currencyID="NGN">1500.00</cbc:LineExtensionAmount>',
      '<cbc:Name>Software License</cbc:Name>'
    ];
    
    let passedLines = 0;
    lineChecks.forEach(check => {
      if (xml.includes(check)) {
        passedLines++;
      } else {
        console.log(`❌ Missing line check: ${check}`);
      }
    });
    
    console.log(`✅ Invoice lines validation: ${passedLines}/${lineChecks.length} passed`);
    
    // Test 4: XML structure validation
    console.log('\n✅ Test 4: Validating XML structure...');
    const structureChecks = [
      xml.includes('<Invoice'),
      xml.includes('</Invoice>'),
      xml.includes('<cac:AccountingSupplierParty>'),
      xml.includes('<cac:AccountingCustomerParty>'),
      xml.includes('<cac:InvoiceLine>'),
      xml.includes('<cac:TaxTotal>'),
      xml.includes('<cac:LegalMonetaryTotal>')
    ];
    
    const passedStructure = structureChecks.filter(check => check).length;
    console.log(`✅ Structure validation: ${passedStructure}/${structureChecks.length} passed`);
    
    // Summary
    const totalTests = 4;
    const overallScore = (passedElements === requiredElements.length && 
                         passedLines === lineChecks.length && 
                         passedStructure === structureChecks.length) ? 'PASS' : 'FAIL';
    
    console.log('\n📊 TEST SUMMARY');
    console.log('================');
    console.log(`Overall Result: ${overallScore === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Required Elements: ${passedElements}/${requiredElements.length}`);
    console.log(`Invoice Lines: ${passedLines}/${lineChecks.length}`);
    console.log(`XML Structure: ${passedStructure}/${structureChecks.length}`);
    
    if (overallScore === 'PASS') {
      console.log('\n🎉 All tests passed! UBL Generator is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }
    
    // Output sample of generated XML
    console.log('\n📄 SAMPLE GENERATED XML (first 500 chars):');
    console.log(xml.substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

runTests();
