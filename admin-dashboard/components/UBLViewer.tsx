'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import xml2js from 'xml2js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminI18n } from '@/lib/i18n';

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

type MandatoryField = {
  path: string;
  description: string;
};

export function UBLViewer({ xml }: UBLViewerProps) {
  const { t } = useAdminI18n();
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [validation, setValidation] = useState<FieldValidation[]>([]);
  const previousXmlRef = useRef<string>('');

  const mandatoryFields = useMemo<MandatoryField[]>(() => [
    { path: 'cbc:ID', description: t('ubl.field.invoiceId') },
    { path: 'cbc:IssueDate', description: t('ubl.field.issueDate') },
    { path: 'cbc:InvoiceTypeCode', description: t('ubl.field.invoiceTypeCode') },
    { path: 'cbc:ProfileID', description: t('ubl.field.profileId') },
    { path: 'cbc:DocumentCurrencyCode', description: t('ubl.field.currencyCode') },
    { path: 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID', description: t('ubl.field.supplierTin') },
    { path: 'cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name', description: t('ubl.field.supplierName') },
    { path: 'cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID', description: t('ubl.field.customerTin') },
    { path: 'cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name', description: t('ubl.field.customerName') },
    { path: 'cac:InvoiceLine/cbc:ID', description: t('ubl.field.lineId') },
    { path: 'cac:InvoiceLine/cbc:InvoicedQuantity', description: t('ubl.field.quantity') },
    { path: 'cac:InvoiceLine/cbc:LineExtensionAmount', description: t('ubl.field.lineAmount') },
    { path: 'cac:InvoiceLine/cac:Item/cbc:Description', description: t('ubl.field.itemDescription') },
    { path: 'cac:InvoiceLine/cac:Price/cbc:PriceAmount', description: t('ubl.field.unitPrice') },
    { path: 'cac:TaxTotal/cbc:TaxAmount', description: t('ubl.field.totalTaxAmount') },
    { path: 'cac:LegalMonetaryTotal/cbc:LineExtensionAmount', description: t('ubl.field.subtotal') },
    { path: 'cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount', description: t('ubl.field.taxExclusiveAmount') },
    { path: 'cac:LegalMonetaryTotal/cbc:TaxInclusiveAmount', description: t('ubl.field.taxInclusiveAmount') },
    { path: 'cac:LegalMonetaryTotal/cbc:PayableAmount', description: t('ubl.field.amountPayable') },
  ], [t]);

  const getNestedValue = useCallback((obj: ParsedInvoice | null, path: string): unknown => {
    if (!obj) return null;
    return path.split('/').reduce((o: unknown, p: string) => {
      if (!o || typeof o !== 'object') return null;
      const record = o as Record<string, unknown>;
      return record[p];
    }, obj as unknown);
  }, []);

  const validateFields = useCallback((invoiceData: ParsedInvoice): FieldValidation[] => {
    return mandatoryFields.map(field => {
      const value = getNestedValue(invoiceData, field.path);
      return {
        field: field.path,
        present: !!value,
        value: value ? (Array.isArray(value) ? value[0] : value) : undefined,
        description: field.description
      };
    });
  }, [getNestedValue, mandatoryFields]);

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
            {t('ubl.compliance.title')}
            <Badge variant={completionRate === 100 ? 'default' : 'secondary'}>
              {t('ubl.compliance.complete', { percent: completionRate.toFixed(1) })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {t('ubl.compliance.summary', { present: presentFields, total: validation.length })}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="validation" className="w-full">
        <TabsList>
          <TabsTrigger value="validation">{t('ubl.tabs.validation')}</TabsTrigger>
          <TabsTrigger value="xml">{t('ubl.tabs.xml')}</TabsTrigger>
          <TabsTrigger value="parsed">{t('ubl.tabs.parsed')}</TabsTrigger>
        </TabsList>

        <TabsContent value="validation" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('ubl.validation.title')}</CardTitle>
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
                          {t('ubl.validation.valueLabel')} {typeof field.value === 'object' ? JSON.stringify(field.value) : field.value}
                        </div>
                      )}
                    </div>
                    <Badge variant={field.present ? 'default' : 'destructive'}>
                      {field.present ? t('ubl.validation.present') : t('ubl.validation.missing')}
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
