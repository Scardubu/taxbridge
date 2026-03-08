/**
 * Custom Tax Calculation Templates Service (Phase 9 - G3)
 *
 * Allows businesses to create, manage, and apply custom tax calculation
 * templates for recurring scenarios (e.g. specific industry deductions,
 * custom WHT rates, sector-specific VAT exemptions).
 */

import { PrismaClient } from '@prisma/client';
import {
  VAT_RATE,
  WHT_CONSTRUCTION_RATE,
  WHT_DIVIDEND_RATE,
  WHT_PROFESSIONAL_RATE,
} from '@taxbridge/contracts';
import { createLogger } from '../lib/logger';

const log = createLogger('tax-templates');

// =============================================================================
// Types
// =============================================================================

export type TaxTemplateType = 'PIT' | 'VAT' | 'CIT' | 'WHT' | 'PAYE' | 'CUSTOM';

export interface TaxTemplateRule {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in';
  value: number | string | number[] | string[];
  rate?: number;
  fixedAmount?: number;
  description: string;
}

export interface TaxTemplate {
  id: string;
  businessId: string;
  name: string;
  description: string;
  type: TaxTemplateType;
  version: number;
  isActive: boolean;
  rules: TaxTemplateRule[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  businessId: string;
  name: string;
  description: string;
  type: TaxTemplateType;
  rules: TaxTemplateRule[];
  metadata?: Record<string, any>;
}

export interface ApplyTemplateResult {
  templateId: string;
  templateName: string;
  inputAmount: number;
  taxAmount: number;
  effectiveRate: number;
  breakdown: Array<{
    rule: string;
    amount: number;
    rate?: number;
  }>;
}

// =============================================================================
// Built-in Templates
// =============================================================================

export const BUILTIN_TEMPLATES: Omit<TaxTemplate, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Standard VAT (7.5%)',
    description: 'Standard Nigerian VAT rate for taxable goods and services',
    type: 'VAT',
    version: 1,
    isActive: true,
    rules: [
      {
        field: 'amount',
        operator: 'gt',
        value: 0,
        rate: VAT_RATE,
        description: 'Standard VAT at 7.5%',
      },
    ],
    metadata: { category: 'standard', jurisdiction: 'NG' },
  },
  {
    name: 'WHT - Professional Services (10%)',
    description: 'Withholding tax for professional services in Nigeria',
    type: 'WHT',
    version: 1,
    isActive: true,
    rules: [
      {
        field: 'amount',
        operator: 'gt',
        value: 0,
        rate: WHT_PROFESSIONAL_RATE,
        description: 'WHT on professional services at 10%',
      },
    ],
    metadata: { category: 'professional', jurisdiction: 'NG' },
  },
  {
    name: 'WHT - Rent (10%)',
    description: 'Withholding tax on rent payments',
    type: 'WHT',
    version: 1,
    isActive: true,
    rules: [
      {
        field: 'amount',
        operator: 'gt',
        value: 0,
        rate: WHT_DIVIDEND_RATE,
        description: 'WHT on rent at 10%',
      },
    ],
    metadata: { category: 'rent', jurisdiction: 'NG' },
  },
  {
    name: 'WHT - Dividends (10%)',
    description: 'Withholding tax on dividend payments',
    type: 'WHT',
    version: 1,
    isActive: true,
    rules: [
      {
        field: 'amount',
        operator: 'gt',
        value: 0,
        rate: WHT_DIVIDEND_RATE,
        description: 'WHT on dividends at 10%',
      },
    ],
    metadata: { category: 'dividends', jurisdiction: 'NG' },
  },
  {
    name: 'WHT - Contract/Supply (5%)',
    description: 'Withholding tax on contracts and supply of goods',
    type: 'WHT',
    version: 1,
    isActive: true,
    rules: [
      {
        field: 'amount',
        operator: 'gt',
        value: 0,
        rate: WHT_CONSTRUCTION_RATE,
        description: 'WHT on contracts/supply at 5%',
      },
    ],
    metadata: { category: 'contract', jurisdiction: 'NG' },
  },
];

// =============================================================================
// Service
// =============================================================================

export class TaxTemplateService {
  private templates: Map<string, TaxTemplate> = new Map();
  private nextId = 1;

  constructor(private prisma?: PrismaClient) {
    this.seedBuiltinTemplates();
  }

  private seedBuiltinTemplates(): void {
    const now = new Date().toISOString();
    for (const tpl of BUILTIN_TEMPLATES) {
      const id = `tpl_builtin_${this.nextId++}`;
      this.templates.set(id, {
        ...tpl,
        id,
        businessId: '__system__',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /**
   * Create a custom tax template.
   */
  create(input: CreateTemplateInput): TaxTemplate {
    const id = `tpl_${Date.now()}_${this.nextId++}`;
    const now = new Date().toISOString();

    const template: TaxTemplate = {
      id,
      businessId: input.businessId,
      name: input.name,
      description: input.description,
      type: input.type,
      version: 1,
      isActive: true,
      rules: input.rules,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(id, template);
    log.info('Tax template created', { id, name: input.name, type: input.type });
    return template;
  }

  /**
   * Get a template by ID.
   */
  getById(id: string): TaxTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * List templates for a business (includes built-in templates).
   */
  list(businessId: string, type?: TaxTemplateType): TaxTemplate[] {
    return Array.from(this.templates.values()).filter((t) => {
      const ownerMatch = t.businessId === businessId || t.businessId === '__system__';
      const typeMatch = !type || t.type === type;
      return ownerMatch && typeMatch && t.isActive;
    });
  }

  /**
   * Update a custom template (creates a new version).
   */
  update(id: string, businessId: string, updates: Partial<CreateTemplateInput>): TaxTemplate | null {
    const existing = this.templates.get(id);
    if (!existing || existing.businessId !== businessId) return null;

    const updated: TaxTemplate = {
      ...existing,
      ...updates,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(id, updated);
    log.info('Tax template updated', { id, version: updated.version });
    return updated;
  }

  /**
   * Deactivate a template.
   */
  deactivate(id: string, businessId: string): boolean {
    const tpl = this.templates.get(id);
    if (!tpl || tpl.businessId !== businessId) return false;

    tpl.isActive = false;
    tpl.updatedAt = new Date().toISOString();
    log.info('Tax template deactivated', { id });
    return true;
  }

  /**
   * Apply a template to calculate tax on an amount.
   */
  apply(templateId: string, amount: number): ApplyTemplateResult | null {
    const tpl = this.templates.get(templateId);
    if (!tpl || !tpl.isActive) return null;

    let totalTax = 0;
    const breakdown: ApplyTemplateResult['breakdown'] = [];

    for (const rule of tpl.rules) {
      if (!this.evaluateCondition(amount, rule)) continue;

      let ruleAmount = 0;
      if (rule.rate) {
        ruleAmount = amount * rule.rate;
      }
      if (rule.fixedAmount) {
        ruleAmount += rule.fixedAmount;
      }

      totalTax += ruleAmount;
      breakdown.push({
        rule: rule.description,
        amount: parseFloat(ruleAmount.toFixed(2)),
        rate: rule.rate,
      });
    }

    return {
      templateId: tpl.id,
      templateName: tpl.name,
      inputAmount: amount,
      taxAmount: parseFloat(totalTax.toFixed(2)),
      effectiveRate: amount > 0 ? parseFloat((totalTax / amount).toFixed(6)) : 0,
      breakdown,
    };
  }

  /**
   * Evaluate whether a rule condition matches.
   */
  private evaluateCondition(amount: number, rule: TaxTemplateRule): boolean {
    const val = typeof rule.value === 'number' ? rule.value : 0;

    switch (rule.operator) {
      case 'eq': return amount === val;
      case 'gt': return amount > val;
      case 'gte': return amount >= val;
      case 'lt': return amount < val;
      case 'lte': return amount <= val;
      case 'between': {
        const [min, max] = rule.value as number[];
        return amount >= min && amount <= max;
      }
      case 'in': {
        return (rule.value as number[]).includes(amount);
      }
      default: return false;
    }
  }
}

// Singleton
export const taxTemplateService = new TaxTemplateService();
