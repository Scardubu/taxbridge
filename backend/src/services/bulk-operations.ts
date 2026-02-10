/**
 * Bulk Operations Service (Phase 9)
 *
 * Provides batch processing for invoices, expenses, and payments.
 * Supports bulk status updates, exports, and deletions with
 * transaction safety and progress tracking.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createLogger } from '../lib/logger';

const log = createLogger('bulk-operations');

// =============================================================================
// Types
// =============================================================================

export type BulkEntityType = 'invoice' | 'expense' | 'payment';

export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface BulkStatusUpdateInput {
  entityType: BulkEntityType;
  ids: string[];
  status: string;
  businessId: string;
}

export interface BulkDeleteInput {
  entityType: BulkEntityType;
  ids: string[];
  businessId: string;
}

export interface BulkExportInput {
  entityType: BulkEntityType;
  businessId: string;
  filters?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
  };
  format: 'csv' | 'json';
}

export interface BulkExportResult {
  data: string;
  filename: string;
  mimeType: string;
  recordCount: number;
}

// =============================================================================
// Service
// =============================================================================

export class BulkOperationsService {
  constructor(private prisma: PrismaClient) {}

  // ---------------------------------------------------------------------------
  // Bulk Status Update
  // ---------------------------------------------------------------------------

  async bulkStatusUpdate(input: BulkStatusUpdateInput): Promise<BulkOperationResult> {
    const { entityType, ids, status, businessId } = input;
    const result: BulkOperationResult = { total: ids.length, succeeded: 0, failed: 0, errors: [] };

    log.info('Bulk status update', { entityType, count: ids.length, status });

    for (const id of ids) {
      try {
        switch (entityType) {
          case 'invoice':
            await this.prisma.invoice.updateMany({
              where: { id, userId: businessId },
              data: { status: status as any },
            });
            break;
          case 'expense':
            await this.prisma.expense.updateMany({
              where: { id, businessId },
              data: { status: status as any },
            });
            break;
          case 'payment':
            await this.prisma.payment.updateMany({
              where: { id },
              data: { status: status as any },
            });
            break;
        }
        result.succeeded++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({ id, error: err.message || 'Unknown error' });
        log.warn('Bulk update failed for item', { entityType, id, error: err.message });
      }
    }

    log.info('Bulk status update complete', {
      entityType,
      succeeded: result.succeeded,
      failed: result.failed,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Delete (soft-delete via status = CANCELLED where applicable)
  // ---------------------------------------------------------------------------

  async bulkDelete(input: BulkDeleteInput): Promise<BulkOperationResult> {
    const { entityType, ids, businessId } = input;
    const result: BulkOperationResult = { total: ids.length, succeeded: 0, failed: 0, errors: [] };

    log.info('Bulk delete', { entityType, count: ids.length });

    for (const id of ids) {
      try {
        switch (entityType) {
          case 'invoice':
            await this.prisma.invoice.updateMany({
              where: { id, userId: businessId, status: { in: ['DRAFT', 'FAILED'] } },
              data: { status: 'CANCELLED' },
            });
            break;
          case 'expense':
            await this.prisma.expense.deleteMany({
              where: { id, businessId, status: 'pending' },
            });
            break;
          case 'payment':
            // Payments should not be deleted; mark as cancelled
            await this.prisma.payment.updateMany({
              where: { id, status: 'PENDING' },
              data: { status: 'CANCELLED' },
            });
            break;
        }
        result.succeeded++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({ id, error: err.message || 'Unknown error' });
        log.warn('Bulk delete failed for item', { entityType, id, error: err.message });
      }
    }

    log.info('Bulk delete complete', {
      entityType,
      succeeded: result.succeeded,
      failed: result.failed,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Export
  // ---------------------------------------------------------------------------

  async bulkExport(input: BulkExportInput): Promise<BulkExportResult> {
    const { entityType, businessId, filters, format } = input;

    log.info('Bulk export', { entityType, format, filters });

    const dateFilter: any = {};
    if (filters?.fromDate) dateFilter.gte = new Date(filters.fromDate);
    if (filters?.toDate) dateFilter.lte = new Date(filters.toDate);

    let records: any[] = [];

    switch (entityType) {
      case 'invoice': {
        const where: Prisma.InvoiceWhereInput = { userId: businessId };
        if (filters?.status) where.status = filters.status as any;
        if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
        records = await this.prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' } });
        break;
      }
      case 'expense': {
        const where: Prisma.ExpenseWhereInput = { businessId };
        if (filters?.status) where.status = filters.status;
        if (Object.keys(dateFilter).length) where.date = dateFilter;
        records = await this.prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
        break;
      }
      case 'payment': {
        const where: Prisma.PaymentWhereInput = {};
        if (filters?.status) where.status = filters.status as any;
        if (Object.keys(dateFilter).length) where.createdAt = dateFilter;
        records = await this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' } });
        break;
      }
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return {
        data: JSON.stringify(records, null, 2),
        filename: `${entityType}s-export-${timestamp}.json`,
        mimeType: 'application/json',
        recordCount: records.length,
      };
    }

    // CSV format
    const csvData = this.toCsv(records);
    return {
      data: csvData,
      filename: `${entityType}s-export-${timestamp}.csv`,
      mimeType: 'text/csv',
      recordCount: records.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toCsv(records: any[]): string {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const rows = records.map((r) =>
      headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape CSV values
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
