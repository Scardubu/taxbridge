export const PEPPOL_MANDATORY_FIELDS = [
  'cbc:ID',
  'cbc:IssueDate',
  'cbc:InvoiceTypeCode',
  'cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID',
  'cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName',
  'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:StreetName',
  'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cbc:CityName',
  'cac:AccountingSupplierParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode',
  'cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID',
  'cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName',
  'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cbc:StreetName',
  'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cbc:CityName',
  'cac:AccountingCustomerParty/cac:Party/cac:PostalAddress/cac:Country/cbc:IdentificationCode',
  'cac:InvoiceLine/cbc:ID',
  'cac:InvoiceLine/cbc:InvoicedQuantity',
  'cac:InvoiceLine/cbc:LineExtensionAmount',
  'cac:InvoiceLine/cac:Item/cbc:Description',
  'cac:InvoiceLine/cac:Item/cbc:Name',
  'cac:InvoiceLine/cac:Price/cbc:PriceAmount',
  'cac:InvoiceLine/cac:TaxTotal/cbc:TaxAmount',
  'cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount',
  'cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount',
  'cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID',
  'cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent',
  'cac:InvoiceLine/cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID',
  'cac:TaxTotal/cbc:TaxAmount',
  'cac:TaxTotal/cac:TaxSubtotal/cbc:TaxableAmount',
  'cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount',
  'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:ID',
  'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cbc:Percent',
  'cac:TaxTotal/cac:TaxSubtotal/cac:TaxCategory/cac:TaxScheme/cbc:ID',
  'cac:LegalMonetaryTotal/cbc:LineExtensionAmount',
  'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount',
  'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount',
  'cac:LegalMonetaryTotal/cbc:PayableAmount'
] as const;

export interface MandatoryFieldAnalysis {
  missingFields: string[];
  presentFields: string[];
  totalRequired: number;
  hasNigeriaCurrency: boolean;
  hasVatRate: boolean;
}

export function analyzeMandatoryFields(xml: string): MandatoryFieldAnalysis {
  const presentFields: string[] = [];
  const missingFields: string[] = [];

  for (const field of PEPPOL_MANDATORY_FIELDS) {
    const leaf = field.split('/').pop() || field;
    const normalized = leaf.replace('cbc:', '').replace('cac:', '');
    const regex = new RegExp(`<(?:cbc|cac):${normalized}[^>]*>`, 'i');

    if (regex.test(xml)) {
      presentFields.push(field);
    } else {
      missingFields.push(field);
    }
  }

  return {
    missingFields,
    presentFields,
    totalRequired: PEPPOL_MANDATORY_FIELDS.length,
    hasNigeriaCurrency: xml.includes('currencyID="NGN"'),
    hasVatRate: xml.includes('<cbc:Percent>7.5</cbc:Percent>')
  };
}
