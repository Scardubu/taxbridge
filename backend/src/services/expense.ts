/**
 * Expense Service (Phase 5)
 *
 * CRUD operations for business expenses with:
 * - Category detection and VAT eligibility
 * - OCR receipt integration
 * - Approval workflow (pending → approved/rejected)
 * - Statistics and reporting
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createLogger } from '../lib/logger';
import { VAT_RATE } from '../lib/constants';

const log = createLogger('expense-service');

// =============================================================================
// Types
// =============================================================================

export type ExpenseCategory =
  | 'office-supplies'
  | 'travel'
  | 'meals'
  | 'utilities'
  | 'rent'
  | 'fuel'
  | 'maintenance'
  | 'professional-services'
  | 'telecommunications'
  | 'insurance'
  | 'marketing'
  | 'equipment'
  | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'office-supplies',
  'travel',
  'meals',
  'utilities',
  'rent',
  'fuel',
  'maintenance',
  'professional-services',
  'telecommunications',
  'insurance',
  'marketing',
  'equipment',
  'other',
];

export interface CreateExpenseInput {
  businessId: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string; // ISO date string
  vatAmount?: number;
  vatEligible?: boolean;
  receiptImage?: string; // base64 or URL
  ocrData?: Record<string, unknown>;
}

export interface UpdateExpenseInput {
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
  date?: string;
  vatAmount?: number;
  vatEligible?: boolean;
  receiptImage?: string;
}

export interface ExpenseFilters {
  businessId: string;
  category?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  totalVatRecoverable: number;
  byCategory: Array<{ category: string; count: number; total: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byMonth: Array<{ month: string; count: number; total: number }>;
}

// =============================================================================
// Category Detection Rules
// =============================================================================

const CATEGORY_RULES: Array<{ keywords: string[]; category: ExpenseCategory }> = [
  // More specific categories first to avoid ambiguous matches
  { keywords: ['rent', 'lease', 'warehouse', 'office space'], category: 'rent' },
  { keywords: ['fuel', 'petrol', 'filling station', 'nnpc', 'oando', 'conoil'], category: 'fuel' },
  { keywords: ['flight', 'hotel', 'uber', 'taxi', 'bolt', 'transport', 'airfare', 'accommodation', 'travel'], category: 'travel' },
  { keywords: ['restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'catering', 'meal', 'snack'], category: 'meals' },
  { keywords: ['electricity', 'water bill', 'nepa', 'phcn', 'ekedc', 'ikedc', 'aedc', 'generator'], category: 'utilities' },
  { keywords: ['office', 'stationery', 'paper', 'printer', 'pen', 'ink', 'toner', 'desk', 'chair'], category: 'office-supplies' },
  { keywords: ['repair', 'maintenance', 'plumber', 'electrician', 'fix'], category: 'maintenance' },
  { keywords: ['consultant', 'legal', 'accounting', 'audit', 'lawyer', 'solicitor', 'professional'], category: 'professional-services' },
  { keywords: ['internet', 'mtn', 'airtel', 'glo', 'etisalat', '9mobile', 'broadband', 'wifi', 'data plan'], category: 'telecommunications' },
  { keywords: ['insurance', 'premium', 'policy', 'cover', 'indemnity'], category: 'insurance' },
  { keywords: ['advert', 'marketing', 'promotion', 'billboard', 'social media', 'google ads', 'facebook'], category: 'marketing' },
  { keywords: ['laptop', 'computer', 'equipment', 'machinery', 'hardware', 'server'], category: 'equipment' },
];

// VAT-exempt categories per Nigerian tax law
const VAT_EXEMPT_CATEGORIES: ExpenseCategory[] = ['rent', 'insurance'];

// VAT-exempt merchant keywords
const VAT_EXEMPT_MERCHANTS = ['hospital', 'clinic', 'school', 'university', 'church', 'mosque', 'pharmacy'];

// =============================================================================
// Service Class
// =============================================================================

export class ExpenseService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new expense
   */
  async create(userId: string, input: CreateExpenseInput) {
    // Verify business ownership
    const business = await this.prisma.business.findFirst({
      where: { id: input.businessId, ownerId: userId },
    });
    if (!business) {
      throw new Error('Business not found or access denied');
    }

    // Auto-detect VAT eligibility if not explicitly set
    const vatEligible = input.vatEligible ?? this.isVATEligible(input.category, input.description);
    const vatAmount = input.vatAmount ?? (vatEligible ? Math.round(input.amount * VAT_RATE * 100) / 100 : 0);

    const expense = await this.prisma.expense.create({
      data: {
        businessId: input.businessId,
        amount: input.amount,
        category: input.category,
        description: input.description,
        date: new Date(input.date),
        vatAmount,
        vatEligible,
        receiptImage: input.receiptImage || null,
        ocrData: input.ocrData ? (input.ocrData as any) : null,
        status: 'pending',
      },
    });

    log.info('Expense created', { expenseId: expense.id, businessId: input.businessId, amount: input.amount });
    return expense;
  }

  /**
   * Get expense by ID (with ownership check)
   */
  async getById(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    });

    if (!expense) return null;
    if (expense.business.ownerId !== userId) return null;

    return expense;
  }

  /**
   * List expenses with filters and pagination
   */
  async list(userId: string, filters: ExpenseFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    // Verify business ownership
    const business = await this.prisma.business.findFirst({
      where: { id: filters.businessId, ownerId: userId },
    });
    if (!business) {
      throw new Error('Business not found or access denied');
    }

    const where: any = {
      businessId: filters.businessId,
    };

    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = new Date(filters.fromDate);
      if (filters.toDate) where.date.lte = new Date(filters.toDate);
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update an expense (only pending expenses can be updated)
   */
  async update(userId: string, expenseId: string, input: UpdateExpenseInput) {
    const expense = await this.getById(userId, expenseId);
    if (!expense) throw new Error('Expense not found or access denied');
    if (expense.status !== 'pending') throw new Error('Only pending expenses can be updated');

    const category = input.category || (expense.category as ExpenseCategory);
    const description = input.description || expense.description;
    const amount = input.amount ?? Number(expense.amount);

    const vatEligible = input.vatEligible ?? this.isVATEligible(category, description);
    const vatAmount = input.vatAmount ?? (vatEligible ? Math.round(amount * VAT_RATE * 100) / 100 : 0);

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.category && { category: input.category }),
        ...(input.description && { description: input.description }),
        ...(input.date && { date: new Date(input.date) }),
        ...(input.receiptImage !== undefined && { receiptImage: input.receiptImage }),
        vatAmount,
        vatEligible,
      },
    });

    log.info('Expense updated', { expenseId, businessId: expense.businessId });
    return updated;
  }

  /**
   * Delete an expense (only pending expenses can be deleted)
   */
  async delete(userId: string, expenseId: string) {
    const expense = await this.getById(userId, expenseId);
    if (!expense) throw new Error('Expense not found or access denied');
    if (expense.status !== 'pending') throw new Error('Only pending expenses can be deleted');

    await this.prisma.expense.delete({ where: { id: expenseId } });
    log.info('Expense deleted', { expenseId, businessId: expense.businessId });
    return { deleted: true };
  }

  /**
   * Approve an expense
   */
  async approve(userId: string, expenseId: string) {
    const expense = await this.getById(userId, expenseId);
    if (!expense) throw new Error('Expense not found or access denied');
    if (expense.status !== 'pending') throw new Error('Only pending expenses can be approved');

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    log.info('Expense approved', { expenseId, approvedBy: userId });
    return updated;
  }

  /**
   * Reject an expense
   */
  async reject(userId: string, expenseId: string) {
    const expense = await this.getById(userId, expenseId);
    if (!expense) throw new Error('Expense not found or access denied');
    if (expense.status !== 'pending') throw new Error('Only pending expenses can be rejected');

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: { status: 'rejected' },
    });

    log.info('Expense rejected', { expenseId });
    return updated;
  }

  /**
   * Get expense statistics for a business
   */
  async getStats(userId: string, businessId: string): Promise<ExpenseStats> {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    if (!business) throw new Error('Business not found or access denied');

    const [allExpenses, byCategory, byStatus] = await Promise.all([
      this.prisma.expense.findMany({
        where: { businessId },
        select: { amount: true, vatAmount: true, vatEligible: true, category: true, status: true, date: true },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { businessId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['status'],
        where: { businessId },
        _count: { id: true },
      }),
    ]);

    const totalAmount = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalVatRecoverable = allExpenses
      .filter(e => e.vatEligible && e.status === 'approved')
      .reduce((sum, e) => sum + Number(e.vatAmount), 0);

    // Group by month
    const monthMap = new Map<string, { count: number; total: number }>();
    for (const e of allExpenses) {
      const month = e.date.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(e.amount);
      monthMap.set(month, existing);
    }

    return {
      totalExpenses: allExpenses.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalVatRecoverable: Math.round(totalVatRecoverable * 100) / 100,
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.id,
        total: Number(c._sum.amount || 0),
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count.id,
      })),
      byMonth: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, data]) => ({ month, ...data })),
    };
  }

  /**
   * Create expense from OCR data (receipt scan)
   */
  async createFromOCR(
    userId: string,
    businessId: string,
    ocrResult: { amount?: number; date?: string; items?: Array<{ description: string; quantity: number; unitPrice: number }>; confidence: number },
    receiptImage?: string
  ) {
    // Build description from OCR items
    let description = 'Receipt scan';
    if (ocrResult.items && ocrResult.items.length > 0) {
      description = ocrResult.items.map(i => i.description).filter(Boolean).join(', ') || 'Receipt scan';
    }

    // Detect category from OCR text
    const category = this.detectCategory(description);

    // Use OCR amount or sum of items
    let amount = ocrResult.amount || 0;
    if (!amount && ocrResult.items) {
      amount = ocrResult.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    }

    const date = ocrResult.date || new Date().toISOString();

    return this.create(userId, {
      businessId,
      amount,
      category,
      description,
      date,
      receiptImage,
      ocrData: ocrResult as unknown as Record<string, unknown>,
    });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Detect expense category from description text
   */
  detectCategory(text: string): ExpenseCategory {
    const lower = text.toLowerCase();
    let bestCategory: ExpenseCategory = 'other';
    let bestScore = 0;

    for (const rule of CATEGORY_RULES) {
      const matchCount = rule.keywords.filter(kw => lower.includes(kw)).length;
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestCategory = rule.category;
      }
    }

    return bestCategory;
  }

  /**
   * Determine if an expense is VAT-eligible
   */
  isVATEligible(category: ExpenseCategory, description: string): boolean {
    if (VAT_EXEMPT_CATEGORIES.includes(category)) return false;

    const lower = description.toLowerCase();
    if (VAT_EXEMPT_MERCHANTS.some(m => lower.includes(m))) return false;

    return true;
  }
}
