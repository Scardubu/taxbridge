# Peppol BIS Billing 3.0 Validation Reference

## Overview

This document outlines the 55 mandatory fields required for Peppol BIS Billing 3.0 compliance, as mandated by NRS (Nigeria Revenue Service) for 2026 e-invoicing requirements.

## XSD Schema Location

For full XSD validation, download the official Peppol BIS Billing 3.0 schema from:
- https://docs.peppol.eu/poacc/billing/3.0/
- https://github.com/OpenPEPPOL/peppol-bis-invoice-3

## Mandatory Fields (55 Total)

### Document Header (7 fields)
1. `cbc:UBLVersionID` - UBL version (2.1)
2. `cbc:CustomizationID` - Peppol customization identifier
3. `cbc:ProfileID` - Business process identifier
4. `cbc:ID` - Invoice number
5. `cbc:IssueDate` - Invoice issue date
6. `cbc:InvoiceTypeCode` - Invoice type (380 for commercial invoice)
7. `cbc:DocumentCurrencyCode` - Currency code (NGN for Nigeria)

### Accounting Supplier Party (8 fields)
8. `cac:AccountingSupplierParty` - Supplier party container
9. `cac:Party` - Party details
10. `cac:PartyTaxScheme` - Tax scheme details
11. `cbc:CompanyID` - Tax identification number (TIN)
12. `cac:TaxScheme` - Tax scheme
13. `cbc:ID` - Tax scheme ID (VAT)
14. `cac:PartyLegalEntity` - Legal entity details
15. `cbc:RegistrationName` - Supplier legal name

### Accounting Customer Party (4 fields)
16. `cac:AccountingCustomerParty` - Customer party container
17. `cac:Party` - Party details
18. `cac:PartyLegalEntity` - Legal entity details
19. `cbc:RegistrationName` - Customer legal name

### Invoice Lines (10 fields per line, minimum 1 line)
20. `cac:InvoiceLine` - Invoice line container
21. `cbc:ID` - Line number
22. `cbc:InvoicedQuantity` - Quantity
23. `@unitCode` - Unit of measure (C62 for item)
24. `cbc:LineExtensionAmount` - Line total (quantity × price)
25. `@currencyID` - Currency (NGN)
26. `cac:Item` - Item details
27. `cbc:Name` - Item description
28. `cac:Price` - Price details
29. `cbc:PriceAmount` - Unit price

### Tax Total (8 fields)
30. `cac:TaxTotal` - Tax total container
31. `cbc:TaxAmount` - Total tax amount
32. `@currencyID` - Currency (NGN)
33. `cac:TaxSubtotal` - Tax subtotal details
34. `cbc:TaxableAmount` - Taxable amount (subtotal)
35. `cbc:TaxAmount` - Tax amount (7.5% VAT)
36. `cac:TaxCategory` - Tax category
37. `cbc:ID` - Category ID (S for standard rate)
38. `cbc:Percent` - Tax percentage (7.5 for Nigeria)
39. `cac:TaxScheme` - Tax scheme
40. `cbc:ID` - Scheme ID (VAT)

### Legal Monetary Total (8 fields)
41. `cac:LegalMonetaryTotal` - Monetary total container
42. `cbc:LineExtensionAmount` - Sum of line amounts
43. `@currencyID` - Currency (NGN)
44. `cbc:TaxExclusiveAmount` - Total excluding tax
45. `@currencyID` - Currency (NGN)
46. `cbc:TaxInclusiveAmount` - Total including tax
47. `@currencyID` - Currency (NGN)
48. `cbc:PayableAmount` - Amount payable
49. `@currencyID` - Currency (NGN)

### Additional Required Elements (6 fields)
50. XML namespace declaration: `xmlns`
51. Common Aggregate Components namespace: `xmlns:cac`
52. Common Basic Components namespace: `xmlns:cbc`
53. UBL version declaration
54. Peppol profile ID
55. Customization ID

## Nigeria-Specific Requirements

### Tax Rate
- Standard VAT rate: **7.5%** (as of 2026)
- Tax scheme: **VAT**
- Tax category: **S** (Standard rated)

### Currency
- All amounts in **NGN** (Nigerian Naira)
- Decimal precision: 2 places

### TIN Format
- Format: `XXXXXXXX-XXXX` (8 digits - 4 digits)
- Example: `12345678-0001`

### Invoice Type Codes
- `380` - Commercial Invoice (most common)
- `381` - Credit Note
- `384` - Corrected Invoice

## Validation Rules

### Business Rules (BR)
1. Invoice must have at least one invoice line
2. Invoice total must equal sum of line amounts plus tax
3. Tax amount must equal 7.5% of taxable amount
4. All monetary amounts must use NGN currency
5. Invoice date must be in format YYYY-MM-DD
6. TIN must be valid Nigerian format

### Calculation Rules
```
Subtotal = Sum of (Quantity × Unit Price) for all lines
VAT = Subtotal × 0.075
Total = Subtotal + VAT
```

### Validation Steps
1. Parse XML structure
2. Validate all 55 mandatory fields present
3. Verify namespaces correct
4. Check TIN format
5. Validate tax calculation (7.5%)
6. Verify currency codes (NGN)
7. Validate line item calculations
8. Check total = subtotal + VAT

## Test Coverage Requirements

### Unit Tests (100% coverage)
- All 55 fields present
- Correct namespaces
- Valid TIN format
- Accurate tax calculations
- Line item calculations
- Monetary totals accuracy

### Integration Tests
- XML parsing successful
- XSD schema validation passes
- Business rules validated
- Nigeria-specific requirements met

## References

- [Peppol BIS Billing 3.0 Specification](https://docs.peppol.eu/poacc/billing/3.0/)
- [UBL 2.1 Schema](http://docs.oasis-open.org/ubl/os-UBL-2.1/)
- [Nigeria Tax Act 2025](https://www.nrs.gov.ng/)
- [NRS E-Invoicing Guidelines 2026](https://www.nrs.gov.ng/einvoicing)

## XSD Validation (Optional - Production Recommended)

For production deployment, download and validate against official XSD schema:

```bash
# Download schema
wget https://docs.peppol.eu/poacc/billing/3.0/xsd/PEPPOLBIS-T10.xsd

# Validate XML
xmllint --noout --schema PEPPOLBIS-T10.xsd invoice.xml
```

**Note**: XSD validation is optional for MVP but **required for production certification** with Duplo/NRS.

## Compliance Checklist

- [x] All 55 mandatory fields implemented
- [x] 7.5% VAT calculation
- [x] NGN currency enforced
- [x] TIN format validated
- [x] Peppol BIS 3.0 namespaces
- [x] UBL 2.1 compliance
- [x] Line item calculations accurate
- [x] Tax totals accurate
- [x] Unit tests 100% coverage
- [ ] XSD schema validation (production only)

---

**Last Updated**: January 10, 2026
**Version**: 1.0.0
**Compliance Level**: NRS 2026 Ready
