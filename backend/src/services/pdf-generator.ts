/**
 * Invoice PDF Generator
 *
 * Generates professional PDF invoices using HTML templates.
 * Supports multiple templates: professional, retail, service, wholesale.
 * Includes NRS compliance badges, QR codes, and branding.
 *
 * Note: Uses a lightweight HTML-to-text approach for MVP.
 * For production, consider puppeteer or wkhtmltopdf for full HTML→PDF.
 */

import { createLogger } from '../lib/logger';
import { CURRENCY_CODE } from '../lib/constants';

const log = createLogger('pdf-generator');

// =============================================================================
// Types
// =============================================================================

export interface InvoicePDFData {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  template: string;

  // Supplier
  supplierName: string;
  supplierTIN?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;

  // Customer
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerTIN?: string | null;
  customerAddress?: string | null;

  // Items
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatApplicable?: boolean;
    total: number;
    vatAmount: number;
  }>;

  // Totals
  subtotal: number;
  vatAmount: number;
  total: number;

  // NRS Compliance
  nrsCompliant: boolean;
  firsIRN?: string | null;
  firsCSID?: string | null;
  nrsReference?: string | null;
  qrCode?: string | null;

  // Notes
  notes?: string | null;
}

export interface PDFGenerationResult {
  html: string;
  fileName: string;
}

// =============================================================================
// Currency Formatter
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// HTML Template Generator
// =============================================================================

function generateItemRows(items: InvoicePDFData['items']): string {
  return items
    .map(
      (item, index) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB;">${index + 1}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB;">${escapeHtml(item.description)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.vatAmount)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">${formatCurrency(item.total + item.vatAmount)}</td>
    </tr>`
    )
    .join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTemplateColor(template: string): { primary: string; accent: string } {
  switch (template) {
    case 'retail':
      return { primary: '#0EA5E9', accent: '#38BDF8' };
    case 'service':
      return { primary: '#8B5CF6', accent: '#A78BFA' };
    case 'wholesale':
      return { primary: '#F59E0B', accent: '#FBBF24' };
    case 'professional':
    default:
      return { primary: '#16A34A', accent: '#22C55E' };
  }
}

/**
 * Generate invoice HTML for PDF rendering
 */
export function generateInvoiceHTML(data: InvoicePDFData): string {
  const colors = getTemplateColor(data.template);

  const nrsBadge = data.nrsCompliant
    ? `<div style="display: inline-block; background: #ECFDF5; color: #065F46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #A7F3D0;">
        ✓ NRS Compliant
      </div>`
    : '';

  const qrCodeSection = data.qrCode
    ? `<div style="text-align: center; margin-top: 24px;">
        <img src="${data.qrCode}" alt="Invoice QR Code" style="width: 150px; height: 150px;" />
        <p style="font-size: 11px; color: #6B7280; margin-top: 8px;">Scan to verify invoice</p>
      </div>`
    : '';

  const nrsSection =
    data.firsIRN || data.nrsReference
      ? `<div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin-top: 24px;">
        <h4 style="margin: 0 0 8px 0; color: #166534; font-size: 14px;">NRS Compliance Details</h4>
        ${data.firsIRN ? `<p style="margin: 4px 0; font-size: 13px;"><strong>NRS IRN:</strong> ${escapeHtml(data.firsIRN)}</p>` : ''}
        ${data.firsCSID ? `<p style="margin: 4px 0; font-size: 13px;"><strong>NRS CSID:</strong> ${escapeHtml(data.firsCSID)}</p>` : ''}
        ${data.nrsReference ? `<p style="margin: 4px 0; font-size: 13px;"><strong>NRS Reference:</strong> ${escapeHtml(data.nrsReference)}</p>` : ''}
      </div>`
      : '';

  const dueDateSection = data.dueDate
    ? `<tr>
        <td style="padding: 4px 0; color: #6B7280; font-size: 14px;">Due Date:</td>
        <td style="padding: 4px 0; font-weight: 600; font-size: 14px;">${formatDate(data.dueDate)}</td>
      </tr>`
    : '';

  const notesSection = data.notes
    ? `<div style="margin-top: 24px; padding: 16px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
        <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">Notes</h4>
        <p style="margin: 0; color: #6B7280; font-size: 13px; white-space: pre-wrap;">${escapeHtml(data.notes)}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${escapeHtml(data.invoiceNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.5; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; padding: 40px;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
      <div>
        <h1 style="font-size: 32px; font-weight: 700; color: ${colors.primary}; margin-bottom: 4px;">INVOICE</h1>
        <p style="font-size: 16px; color: #6B7280;">${escapeHtml(data.invoiceNumber)}</p>
        ${nrsBadge}
      </div>
      <div style="text-align: right;">
        <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(data.supplierName)}</h2>
        ${data.supplierTIN ? `<p style="font-size: 13px; color: #6B7280;">TIN: ${escapeHtml(data.supplierTIN)}</p>` : ''}
        ${data.supplierEmail ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.supplierEmail)}</p>` : ''}
        ${data.supplierPhone ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.supplierPhone)}</p>` : ''}
        ${data.supplierAddress ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.supplierAddress)}</p>` : ''}
      </div>
    </div>

    <!-- Invoice Details -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 32px;">
      <div>
        <h3 style="font-size: 14px; font-weight: 600; color: #6B7280; text-transform: uppercase; margin-bottom: 8px;">Bill To</h3>
        <p style="font-weight: 600; font-size: 16px; color: #111827;">${escapeHtml(data.customerName)}</p>
        ${data.customerTIN ? `<p style="font-size: 13px; color: #6B7280;">TIN: ${escapeHtml(data.customerTIN)}</p>` : ''}
        ${data.customerEmail ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.customerEmail)}</p>` : ''}
        ${data.customerPhone ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.customerPhone)}</p>` : ''}
        ${data.customerAddress ? `<p style="font-size: 13px; color: #6B7280;">${escapeHtml(data.customerAddress)}</p>` : ''}
      </div>
      <div style="text-align: right;">
        <table style="border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 16px 4px 0; color: #6B7280; font-size: 14px;">Issue Date:</td>
            <td style="padding: 4px 0; font-weight: 600; font-size: 14px;">${formatDate(data.issueDate)}</td>
          </tr>
          ${dueDateSection}
          <tr>
            <td style="padding: 4px 16px 4px 0; color: #6B7280; font-size: 14px;">Currency:</td>
            <td style="padding: 4px 0; font-weight: 600; font-size: 14px;">${CURRENCY_CODE}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: ${colors.primary}; color: white;">
          <th style="padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 600;">#</th>
          <th style="padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 600;">Description</th>
          <th style="padding: 12px 16px; text-align: center; font-size: 13px; font-weight: 600;">Qty</th>
          <th style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 600;">Unit Price</th>
          <th style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 600;">VAT</th>
          <th style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 600;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${generateItemRows(data.items)}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
      <table style="border-collapse: collapse; min-width: 300px;">
        <tr>
          <td style="padding: 8px 24px 8px 0; color: #6B7280; font-size: 14px;">Subtotal:</td>
          <td style="padding: 8px 0; text-align: right; font-size: 14px;">${formatCurrency(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 24px 8px 0; color: #6B7280; font-size: 14px;">VAT (7.5%):</td>
          <td style="padding: 8px 0; text-align: right; font-size: 14px;">${formatCurrency(data.vatAmount)}</td>
        </tr>
        <tr style="border-top: 2px solid ${colors.primary};">
          <td style="padding: 12px 24px 12px 0; font-weight: 700; font-size: 18px; color: ${colors.primary};">Total:</td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: ${colors.primary};">${formatCurrency(data.total)}</td>
        </tr>
      </table>
    </div>

    ${notesSection}
    ${nrsSection}
    ${qrCodeSection}

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #E5E7EB; text-align: center;">
      <p style="font-size: 12px; color: #9CA3AF;">Generated by TaxBridge — Nigerian Tax Compliance Platform</p>
      <p style="font-size: 11px; color: #D1D5DB; margin-top: 4px;">This is a computer-generated invoice. No signature required.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate PDF data for an invoice
 * Returns HTML that can be rendered to PDF by the client or a headless browser
 */
export function generateInvoicePDF(data: InvoicePDFData): PDFGenerationResult {
  const html = generateInvoiceHTML(data);
  const safeNumber = (data.invoiceNumber || 'draft').replace(/[/\\]/g, '-');
  const fileName = `invoice-${safeNumber}.html`;

  log.info('Invoice PDF generated', {
    invoiceNumber: data.invoiceNumber,
    template: data.template,
    nrsCompliant: data.nrsCompliant,
  });

  return { html, fileName };
}
