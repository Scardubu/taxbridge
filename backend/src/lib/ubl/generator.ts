import { create } from 'xmlbuilder2';
import {
  VAT_RATE_PERCENT,
  CURRENCY_CODE,
  UBL_VERSION,
  PEPPOL_CUSTOMIZATION_ID,
  PEPPOL_PROFILE_ID,
  INVOICE_TYPE_CODE,
  TAX_CATEGORY_STANDARD,
  TAX_SCHEME_VAT,
  UNIT_CODE,
  DEFAULT_CASH_CUSTOMER,
} from '../constants';

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
  supplierStreet?: string;
  supplierCity?: string;
  supplierPostalCode?: string;
  supplierCountry?: string;
  customerName?: string;
  customerTIN?: string;
  customerStreet?: string;
  customerCity?: string;
  customerPostalCode?: string;
  customerCountry?: string;
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
    .txt(UBL_VERSION)
    .up()
    .ele('cbc:CustomizationID')
    .txt(PEPPOL_CUSTOMIZATION_ID)
    .up()
    .ele('cbc:ProfileID')
    .txt(PEPPOL_PROFILE_ID)
    .up()
    .ele('cbc:ID')
    .txt(invoice.id)
    .up()
    .ele('cbc:IssueDate')
    .txt(invoice.issueDate)
    .up()
    .ele('cbc:InvoiceTypeCode')
    .txt(INVOICE_TYPE_CODE)
    .up()
    .ele('cbc:DocumentCurrencyCode')
    .txt(CURRENCY_CODE)
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
    .txt(TAX_SCHEME_VAT)
    .up()
    .up()
    .up()
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(invoice.supplierName)
    .up()
    .up()
    .ele('cac:PostalAddress')
    .ele('cbc:StreetName')
    .txt(invoice.supplierStreet || '123 Default Street')
    .up()
    .ele('cbc:CityName')
    .txt(invoice.supplierCity || 'Lagos')
    .up()
    .ele('cbc:PostalZone')
    .txt(invoice.supplierPostalCode || '100001')
    .up()
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt(invoice.supplierCountry || 'NG')
    .up()
    .up()
    .up()
    .up()
    .up();

  doc
    .ele('cac:AccountingCustomerParty')
    .ele('cac:Party')
    .ele('cac:PartyTaxScheme')
    .ele('cbc:CompanyID')
    .txt(invoice.customerTIN || 'N/A')
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt(TAX_SCHEME_VAT)
    .up()
    .up()
    .up()
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(invoice.customerName || DEFAULT_CASH_CUSTOMER)
    .up()
    .up()
    .ele('cac:PostalAddress')
    .ele('cbc:StreetName')
    .txt(invoice.customerStreet || 'N/A')
    .up()
    .ele('cbc:CityName')
    .txt(invoice.customerCity || 'N/A')
    .up()
    .ele('cbc:PostalZone')
    .txt(invoice.customerPostalCode || 'N/A')
    .up()
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt(invoice.customerCountry || 'NG')
    .up()
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
      .ele('cbc:InvoicedQuantity', { unitCode: UNIT_CODE })
      .txt(String(item.quantity))
      .up()
      .ele('cbc:LineExtensionAmount', { currencyID: CURRENCY_CODE })
      .txt((item.quantity * item.unitPrice).toFixed(2))
      .up()
      .ele('cac:Item')
      .ele('cbc:Name')
      .txt(item.description)
      .up()
      .up()
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: CURRENCY_CODE })
      .txt(item.unitPrice.toFixed(2))
      .up()
      .up()
      .up();
  });

  doc
    .ele('cac:TaxTotal')
    .ele('cbc:TaxAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.vat.toFixed(2))
    .up()
    .ele('cac:TaxSubtotal')
    .ele('cbc:TaxableAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.vat.toFixed(2))
    .up()
    .ele('cac:TaxCategory')
    .ele('cbc:ID')
    .txt(TAX_CATEGORY_STANDARD)
    .up()
    .ele('cbc:Percent')
    .txt(String(VAT_RATE_PERCENT))
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt(TAX_SCHEME_VAT)
    .up()
    .up()
    .up()
    .up()
    .up()
    .up();

  doc
    .ele('cac:LegalMonetaryTotal')
    .ele('cbc:LineExtensionAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxExclusiveAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.subtotal.toFixed(2))
    .up()
    .ele('cbc:TaxInclusiveAmount', { currencyID: CURRENCY_CODE })
    .txt(invoice.total.toFixed(2))
    .up()
    .ele('cbc:PayableAmount', { currencyID: CURRENCY_CODE })
    .up();

  return doc.end({ prettyPrint: true });
}
