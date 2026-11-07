'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import xml2js from 'xml2js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminI18n } from '@/lib/i18n';
import { formatCurrencyNGN, safeDate } from '@/lib/utils';
import {
  Copy, Check, Download, AlertTriangle, ShieldCheck,
  FileCode, Layers, Info, History, Search, FileX
} from 'lucide-react';

const MAX_XML_SIZE_BYTES = 1_048_576; // 1 MB limit for safe in-browser parsing

export interface InvoiceMetadata {
  id?: string;
  status?: 'queued' | 'processing' | 'stamped' | 'failed' | string;
  customerName?: string | null;
  customerTIN?: string | null;
  supplierName?: string | null;
  supplierTIN?: string | null;
  nrsReference?: string | null;
  createdAt?: string;
  updatedAt?: string;
  subtotal?: number;
  vat?: number;
  total?: number;
  errorReason?: string;
}

export interface UBLViewerProps {
  xml: string;
  metadata?: InvoiceMetadata;
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

interface ParsedLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export function UBLViewer({ xml, metadata }: UBLViewerProps) {
  const { t } = useAdminI18n();
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<FieldValidation[]>([]);
  const [xmlSearch, setXmlSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRawOnParseError, setShowRawOnParseError] = useState(false);
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
        value: value ? (Array.isArray(value) ? String(value[0]) : String(value)) : undefined,
        description: field.description
      };
    });
  }, [getNestedValue, mandatoryFields]);

  // Security Check & Parsing
  useEffect(() => {
    if (xml === previousXmlRef.current) return;
    previousXmlRef.current = xml;

    if (!xml || !xml.trim()) {
      setParsed(null);
      setValidation([]);
      setParseError(null);
      return;
    }

    // XXE and size protection
    if (xml.length > MAX_XML_SIZE_BYTES) {
      setParseError(`XML payload exceeds maximum size limit of ${MAX_XML_SIZE_BYTES / 1024} KB`);
      setParsed(null);
      return;
    }

    if (/<!DOCTYPE\s+[^>]*SYSTEM/i.test(xml) || /<!ENTITY/i.test(xml)) {
      setParseError('Potential XXE construct detected. Parsing blocked for security.');
      setParsed(null);
      return;
    }

    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      trim: true,
    });

    parser.parseString(xml, (err: Error | null, result: Record<string, unknown>) => {
      if (err) {
        setParseError(`Malformed XML syntax: ${err.message}`);
        setParsed(null);
        setValidation([]);
      } else if (!result || !result.Invoice) {
        setParseError('Invalid UBL Document: Missing root <Invoice> element');
        setParsed(null);
        setValidation([]);
      } else {
        const invoice = result.Invoice as ParsedInvoice;
        setParseError(null);
        setParsed(invoice);
        setValidation(validateFields(invoice));
      }
    });
  }, [xml, validateFields]);

  const presentFields = validation.filter(f => f.present).length;
  const completionRate = validation.length > 0 ? (presentFields / validation.length) * 100 : 0;

  // Extracted overview values
  const invoiceId = metadata?.id || (getNestedValue(parsed, 'cbc:ID') as string) || 'N/A';
  const issueDate = (getNestedValue(parsed, 'cbc:IssueDate') as string) || metadata?.createdAt || 'N/A';
  const currency = (getNestedValue(parsed, 'cbc:DocumentCurrencyCode') as string) || 'NGN';
  const supplierName = (getNestedValue(parsed, 'cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name') as string) || metadata?.supplierName || 'N/A';
  const supplierTin = (getNestedValue(parsed, 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID') as string) || metadata?.supplierTIN || 'N/A';
  const customerName = (getNestedValue(parsed, 'cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name') as string) || metadata?.customerName || 'N/A';
  const customerTin = (getNestedValue(parsed, 'cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID') as string) || metadata?.customerTIN || 'N/A';
  const subtotal = Number((getNestedValue(parsed, 'cac:LegalMonetaryTotal/cbc:LineExtensionAmount') as string) || metadata?.subtotal || 0);
  const vatAmount = Number((getNestedValue(parsed, 'cac:TaxTotal/cbc:TaxAmount') as string) || metadata?.vat || 0);
  const totalAmount = Number((getNestedValue(parsed, 'cac:LegalMonetaryTotal/cbc:PayableAmount') as string) || metadata?.total || 0);
  const nrsRef = metadata?.nrsReference || 'None';
  const stampingStatus = metadata?.status || (nrsRef !== 'None' ? 'stamped' : 'unverified');

  // Extract Line Items for Parsed view
  const lineItems = useMemo<ParsedLineItem[]>(() => {
    if (!parsed) return [];
    const linesRaw = parsed['cac:InvoiceLine'];
    if (!linesRaw) return [];
    const list = Array.isArray(linesRaw) ? linesRaw : [linesRaw];
    return list.map((l: any, idx: number) => ({
      id: l['cbc:ID'] || String(idx + 1),
      description: l['cac:Item']?.['cbc:Description'] || l['cac:Item']?.['cbc:Name'] || 'Item',
      quantity: Number(l['cbc:InvoicedQuantity']?._ || l['cbc:InvoicedQuantity'] || 1),
      unitPrice: Number(l['cac:Price']?.['cbc:PriceAmount'] || 0),
      lineAmount: Number(l['cbc:LineExtensionAmount'] || 0),
    }));
  }, [parsed]);

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadXml = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceId}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Malformed or Rejected XML Error State
  if (parseError) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
        <CardHeader>
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <FileX className="h-5 w-5" />
            <CardTitle className="text-base font-semibold">UBL XML Parsing Error</CardTitle>
          </div>
          <CardDescription className="text-xs text-rose-600 dark:text-rose-300">
            {parseError}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRawOnParseError(!showRawOnParseError)}
            >
              {showRawOnParseError ? 'Hide Raw XML' : 'Inspect Raw XML'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyXml}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {showRawOnParseError && (
            <pre className="mt-2 max-h-64 overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-200">
              {xml}
            </pre>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Top Compliance Banner ── */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <CardTitle className="text-base">{t('ubl.compliance.title')}</CardTitle>
                <CardDescription className="text-xs">
                  {t('ubl.compliance.summary', { present: presentFields, total: validation.length })}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={completionRate === 100 ? 'default' : 'secondary'} className="font-mono text-xs">
                {t('ubl.compliance.complete', { percent: completionRate.toFixed(1) })}
              </Badge>
              <Badge
                variant="outline"
                className={
                  stampingStatus === 'stamped'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }
              >
                {stampingStatus === 'stamped' ? 'NRS Stamped' : 'Structural Only'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Tabs Navigation ── */}
      <Tabs defaultValue="validation" className="w-full">
        <TabsList className="grid w-full grid-cols-5 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <TabsTrigger value="validation" className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('ubl.tabs.validation')}</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs">
            <Info className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="parsed" className="flex items-center gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('ubl.tabs.parsed')}</span>
          </TabsTrigger>
          <TabsTrigger value="xml" className="flex items-center gap-1.5 text-xs">
            <FileCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('ubl.tabs.xml')}</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Validation Tab ── */}
        <TabsContent value="validation" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">{t('ubl.validation.title')}</CardTitle>
              <CardDescription className="text-xs">
                Audited against 19 key mandatory fields of NRS 2026 E-Invoicing standard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {validation.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                  >
                    <div className="flex-1 pr-3">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{field.description}</div>
                      <div className="font-mono text-[11px] text-slate-400">{field.field}</div>
                      {field.value && (
                        <div className="mt-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                          {field.value}
                        </div>
                      )}
                    </div>
                    <Badge variant={field.present ? 'default' : 'destructive'} className="text-[10px]">
                      {field.present ? t('ubl.validation.present') : t('ubl.validation.missing')}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 1. Invoice Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4 pt-2">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">Invoice ID</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{invoiceId}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">Issue Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{safeDate(issueDate)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">Currency</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{currency}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-xs font-medium text-slate-500">Total Payable</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrencyNGN(totalAmount)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supplier (Seller)</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{supplierName}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">TIN: {supplierTin}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Customer (Buyer)</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">TIN: {customerTin}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500">NRS Statutory Reference</p>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">{nrsRef}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-xs text-slate-500">Subtotal</p>
                      <p className="text-sm font-semibold">{formatCurrencyNGN(subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">VAT (7.5%)</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatCurrencyNGN(vatAmount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Parsed Invoice Tab ── */}
        <TabsContent value="parsed" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Invoice Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                        <th className="py-2">#</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Quantity</th>
                        <th className="py-2 text-right">Unit Price</th>
                        <th className="py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="py-2.5 font-mono text-slate-500">{item.id}</td>
                          <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">{item.description}</td>
                          <td className="py-2.5 text-right font-mono">{item.quantity}</td>
                          <td className="py-2.5 text-right font-mono">{formatCurrencyNGN(item.unitPrice)}</td>
                          <td className="py-2.5 text-right font-mono font-semibold">{formatCurrencyNGN(item.lineAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-slate-500">No structured line items found in UBL.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 4. XML Source Tab ── */}
        <TabsContent value="xml" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search XML..."
                value={xmlSearch}
                onChange={(e) => setXmlSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyXml} className="h-8 text-xs">
                {copied ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy XML'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadXml} className="h-8 text-xs">
                <Download className="mr-1 h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>
          <Card>
            <CardContent className="p-4">
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400">
                {xmlSearch
                  ? xml.split('\n').filter(line => line.toLowerCase().includes(xmlSearch.toLowerCase())).join('\n')
                  : xml}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. Operational History Tab ── */}
        <TabsContent value="history" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Lifecycle and Submission Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-slate-200 pl-4 space-y-4 dark:border-slate-800">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Invoice Created</p>
                  <p className="text-[11px] text-slate-500">{safeDate(metadata?.createdAt || issueDate)}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">UBL 2.1 Generated & Locally Validated</p>
                  <p className="text-[11px] text-slate-500">Checked against 19 mandatory fields</p>
                </div>
                <div className="relative">
                  <div className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                    stampingStatus === 'stamped' ? 'bg-emerald-500' : stampingStatus === 'failed' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {stampingStatus === 'stamped' ? 'NRS Stamped' : stampingStatus === 'failed' ? 'Stamping Rejected' : 'Queued for Submission'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {stampingStatus === 'stamped'
                      ? `Assigned IRN: ${nrsRef}`
                      : stampingStatus === 'failed'
                      ? metadata?.errorReason || 'Transmission or verification error'
                      : 'Pending dispatch via BullMQ worker'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
