'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import xml2js from 'xml2js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UBLViewerProps {
  xml: string;
}

interface FieldValidation {
  field: string;
  present: boolean;
  value?: string;
  description: string;
}

type ParsedInvoice = Record<string, unknown>;

// UBL 3.0 BIS Billing 3.0 mandatory fields for Nigeria NRS - moved outside component
const MANDATORY_FIELDS = [
  { path: 'cbc:ID', description: 'Invoice number' },
  { path: 'cbc:IssueDate', description: 'Invoice date (YYYY-MM-DD)' },
  { path: 'cbc:InvoiceTypeCode', description: 'Invoice type code' },
  { path: 'cbc:ProfileID', description: 'Profile ID (Peppol BIS Billing 3.0)' },
  { path: 'cbc:DocumentCurrencyCode', description: 'Currency code (NGN)' },
  { path: 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID', description: 'Supplier TIN' },
  { path: 'cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name', description: 'Supplier name' },
  { path: 'cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID', description: 'Customer TIN' },
  { path: 'cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name', description: 'Customer name' },
  { path: 'cac:InvoiceLine/cbc:ID', description: 'Line item ID' },
  { path: 'cac:InvoiceLine/cbc:InvoicedQuantity', description: 'Quantity' },
  { path: 'cac:InvoiceLine/cbc:LineExtensionAmount', description: 'Line amount' },
  { path: 'cac:InvoiceLine/cac:Item/cbc:Description', description: 'Item description' },
  { path: 'cac:InvoiceLine/cac:Price/cbc:PriceAmount', description: 'Unit price' },
  { path: 'cac:TaxTotal/cbc:TaxAmount', description: 'Total tax amount' },
  { path: 'cac:LegalMonetaryTotal/cbc:LineExtensionAmount', description: 'Subtotal' },
  { path: 'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount', description: 'Tax exclusive amount' },
  { path: 'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount', description: 'Total inclusive amount' },
  { path: 'cac:LegalMonetaryTotal/cbc:PayableAmount', description: 'Amount payable' },
] as const;

export function UBLViewer({ xml }: UBLViewerProps) {
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [validation, setValidation] = useState<FieldValidation[]>([]);
  const previousXmlRef = useRef<string>('');

  const getNestedValue = useCallback((obj: ParsedInvoice | null, path: string): unknown => {
    if (!obj) return null;
    return path.split('/').reduce((o: unknown, p: string) => {
      if (!o || typeof o !== 'object') return null;
      const record = o as Record<string, unknown>;
      return record[p];
    }, obj as unknown);
  }, []);

  const validateFields = useCallback((invoiceData: ParsedInvoice): FieldValidation[] => {
    return MANDATORY_FIELDS.map(field => {
      const value = getNestedValue(invoiceData, field.path);
      return {
        field: field.path,
        present: !!value,
        value: value ? (Array.isArray(value) ? value[0] : value) : undefined,
        description: field.description
      };
    });
  }, [getNestedValue]);

  useEffect(() => {
    // Prevent re-parsing the same XML
    if (xml === previousXmlRef.current) return;
    previousXmlRef.current = xml;

    if (!xml) {
      // Defer state updates to avoid synchronous setState in effect
      queueMicrotask(() => {
        setParsed(null);
        setValidation([]);
      });
      return;
    }

    const parser = new xml2js.Parser();
    parser.parseString(xml, (err: Error | null, result: Record<string, unknown>) => {
      if (!err && result?.Invoice) {
        const invoice = result.Invoice as ParsedInvoice;
        setParsed(invoice);
        setValidation(validateFields(invoice));
      }
    });
  }, [xml, validateFields]);

  const presentFields = validation.filter(f => f.present).length;
  const completionRate = validation.length > 0 ? (presentFields / validation.length) * 100 : 0;

  if (!parsed) {
    return (
      <Card>
        <CardContent className="p-6">
          <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-xs max-h-64">
            {xml}
          </pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compliance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            UBL 3.0 Compliance Check
            <Badge variant={completionRate === 100 ? 'default' : 'secondary'}>
              {completionRate.toFixed(1)}% Complete
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {presentFields} of {validation.length} mandatory fields present
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="validation" className="w-full">
        <TabsList>
          <TabsTrigger value="validation">Field Validation</TabsTrigger>
          <TabsTrigger value="xml">Raw XML</TabsTrigger>
          <TabsTrigger value="parsed">Parsed Structure</TabsTrigger>
        </TabsList>

        <TabsContent value="validation" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle>Mandatory Fields Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {validation.map((field, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{field.description}</div>
                      <div className="text-xs text-muted-foreground font-mono">{field.field}</div>
                      {field.value && (
                        <div className="text-xs text-blue-600 mt-1">
                          Value: {typeof field.value === 'object' ? JSON.stringify(field.value) : field.value}
                        </div>
                      )}
                    </div>
                    <Badge variant={field.present ? 'default' : 'destructive'}>
                      {field.present ? '✓ Present' : '✗ Missing'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xml">
          <Card>
            <CardContent className="p-6">
              <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto text-xs max-h-96">
                {xml}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parsed">
          <Card>
            <CardContent className="p-6">
              <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-xs max-h-96">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
