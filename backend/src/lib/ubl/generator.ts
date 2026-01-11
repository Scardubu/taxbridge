import { create } from 'xmlbuilder2';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  id: string;
  issueDate: string;
  supplierTIN: string;
  supplierName: string;
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  total: number;
}

export function generateUBL(invoice: InvoiceData): string {
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
    })
    .ele('cbc:UBLVersionID')
    .txt('2.1')
    .up()
    .ele('cbc:CustomizationID')
    .txt('urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0')
    .up()
    .ele('cbc:ProfileID')
    .txt('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')
    .up()
    .ele('cbc:ID')
    .txt(invoice.id)
    .up()
    .ele('cbc:IssueDate')
    .txt(invoice.issueDate)
    .up()
    .ele('cbc:InvoiceTypeCode')
    .txt('380')
    .up()
    .ele('cbc:DocumentCurrencyCode')
    .txt('NGN')
    .up();

  doc
    .ele('cac:AccountingSupplierParty')
    .ele('cac:Party')
    .ele('cac:PartyTaxScheme')
    .ele('cbc:CompanyID')
    .txt(invoice.supplierTIN)
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt('VAT')
    .up()
    .up()
    .up()
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(invoice.supplierName)
    .up()
    .up()
    .up()
    .up();

  doc
    .ele('cac:AccountingCustomerParty')
    .ele('cac:Party')
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(invoice.customerName || 'Cash Customer')
    .up()
    .up()
    .up()
    .up();

  invoice.items.forEach((item, index) => {
    doc
      .ele('cac:InvoiceLine')
      .ele('cbc:ID')
      .txt((index + 1).toString())
      .up()
      .ele('cbc:InvoicedQuantity', { unitCode: 'C62' })
      .txt(String(item.quantity))
      .up()
      .ele('cbc:LineExtensionAmount', { currencyID: 'NGN' })
      .txt((item.quantity * item.unitPrice).toFixed(2))
      .up()
      .ele('cac:Item')
      .ele('cbc:Name')
      .txt(item.description)
      .up()
      .up()
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: 'NGN' })
      .txt(item.unitPrice.toFixed(2))
      .up()
      .up()
      .up();
  });

  doc
    .ele('cac:TaxTotal')
    .ele('cbc:TaxAmount', { currencyID: 'NGN' })
    .txt(invoice.vat.toFixed(2))
    .up()
    .ele('cac:TaxSubtotal')
    .ele('cbc:TaxableAmount', { currencyID: 'NGN' })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxAmount', { currencyID: 'NGN' })
    .txt(invoice.vat.toFixed(2))
    .up()
    .ele('cac:TaxCategory')
    .ele('cbc:ID')
    .txt('S')
    .up()
    .ele('cbc:Percent')
    .txt('7.5')
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt('VAT')
    .up()
    .up()
    .up()
    .up()
    .up()
    .up();

  doc
    .ele('cac:LegalMonetaryTotal')
    .ele('cbc:LineExtensionAmount', { currencyID: 'NGN' })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxExclusiveAmount', { currencyID: 'NGN' })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxInclusiveAmount', { currencyID: 'NGN' })
    .txt(invoice.total.toFixed(2))
    .up()
    .ele('cbc:PayableAmount', { currencyID: 'NGN' })
    .txt(invoice.total.toFixed(2))
    .up()
    .up();

  return doc.end({ prettyPrint: true });
}
