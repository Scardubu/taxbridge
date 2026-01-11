import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { submitToDigiTax } from '../integrations/digitax/adapter';
import { remitaAdapter } from '../integrations/remita/adapter';
import { generateUBL } from '../lib/ubl/generator';
import { validateUblXml } from '../lib/ubl/validate';
import { createLogger } from '../lib/logger';

const logger = createLogger('chatbot-service');

interface FAQ {
  id: string;
  question_en: string;
  question_pidgin: string;
  answer_en: string;
  answer_pidgin: string;
  tags: string[];
}

interface ChatResponse {
  answer: string;
  confidence: number;
  source: string;
  apiAction?: string;
  apiData?: any;
}

export class TaxChatbot {
  private faqs: FAQ[] = [];
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.loadFAQs();
  }

  private loadFAQs(): void {
    try {
      const faqPath = join(__dirname, '../data/tax_faqs.json');
      const faqData = readFileSync(faqPath, 'utf-8');
      this.faqs = JSON.parse(faqData);
      logger.info(`Loaded ${this.faqs.length} FAQs for chatbot`);
    } catch (error) {
      logger.error('Failed to load FAQs:', { err: error });
      this.faqs = [];
    }
  }

  private findRelevantFAQ(query: string, language: 'en' | 'pidgin' = 'en'): FAQ | null {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simple keyword matching for now - can be upgraded to vector RAG
    const scoredFAQs = this.faqs.map(faq => {
      const questionField = language === 'en' ? faq.question_en : faq.question_pidgin;
      const answerField = language === 'en' ? faq.answer_en : faq.answer_pidgin;
      
      const questionScore = this.calculateScore(normalizedQuery, questionField.toLowerCase());
      const answerScore = this.calculateScore(normalizedQuery, answerField.toLowerCase());
      const tagScore = faq.tags.some(tag => normalizedQuery.includes(tag.toLowerCase())) ? 0.3 : 0;
      
      return {
        faq,
        score: questionScore + answerScore + tagScore
      };
    });

    const bestMatch = scoredFAQs.sort((a, b) => b.score - a.score)[0];
    return bestMatch && bestMatch.score > 0.3 ? bestMatch.faq : null;
  }

  private calculateScore(query: string, text: string): number {
    const queryWords = query.split(' ').filter(w => w.length > 2);
    const textWords = text.split(' ');
    
    let matches = 0;
    queryWords.forEach(word => {
      if (textWords.some(textWord => textWord.includes(word) || word.includes(textWord))) {
        matches++;
      }
    });
    
    return matches / queryWords.length;
  }

  async getResponse(
    query: string, 
    language: 'en' | 'pidgin' = 'en', 
    userId?: string
  ): Promise<ChatResponse> {
    try {
      // Log the query for analytics
      if (userId) {
        await this.logQuery(userId, query, language);
      }

      const faq = this.findRelevantFAQ(query, language);
      
      if (faq) {
        let answer = language === 'en' ? faq.answer_en : faq.answer_pidgin;
        let apiAction: string | undefined;
        let apiData: any;

        // Handle API integrations based on query intent
        if (this.isEInvoiceQuery(query) || faq.tags.includes('einvoice')) {
          const eInvoiceResult = await this.handleEInvoiceAction(userId, language);
          if (eInvoiceResult) {
            answer += eInvoiceResult.message;
            apiAction = 'einvoice_submit';
            apiData = eInvoiceResult.data;
          }
        }

        if (this.isPaymentQuery(query) || faq.tags.includes('remita')) {
          const paymentResult = await this.handlePaymentAction(userId, language);
          if (paymentResult) {
            answer += paymentResult.message;
            apiAction = 'payment_generate';
            apiData = paymentResult.data;
          }
        }

        return {
          answer,
          confidence: 0.95,
          source: 'faq_api',
          apiAction,
          apiData
        };
      }

      // Fallback response
      const fallbackMessage = language === 'en' 
        ? "I don't have specific information about that. For complex tax matters, please consult a tax professional or visit tax.nirs.gov.ng"
        : "I no get information about that one. For complex tax matter, better talk to tax professional or visit tax.nirs.gov.ng";

      return {
        answer: fallbackMessage,
        confidence: 0.3,
        source: 'fallback'
      };

    } catch (error) {
      logger.error('Chatbot error:', { err: error });
      return {
        answer: language === 'en' 
          ? "Sorry, I'm experiencing technical difficulties. Please try again later."
          : "Sorry, system get problem. Try again later.",
        confidence: 0,
        source: 'error'
      };
    }
  }

  private isEInvoiceQuery(query: string): boolean {
    const eInvoiceKeywords = [
      'submit invoice', 'e-invoice', 'einvoicing', 'ubl', 'duplo',
      'submit invoice', 'create invoice', 'invoice submission'
    ];
    return eInvoiceKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  private isPaymentQuery(query: string): boolean {
    const paymentKeywords = [
      'pay tax', 'payment', 'rrr', 'remita', 'make payment',
      'pay vat', 'tax payment', 'generate rrr'
    ];
    return paymentKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );
  }

  private async handleEInvoiceAction(
    userId?: string, 
    language: 'en' | 'pidgin' = 'en'
  ): Promise<{ message: string; data?: any } | null> {
    if (!userId) {
      return {
        message: language === 'en' 
          ? "\n\nPlease log in to submit e-invoices."
          : "\n\nAbeg login first to submit e-invoice."
      };
    }

    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.tin) {
        return {
          message: language === 'en'
            ? "\n\nPlease complete your TIN registration to submit e-invoices."
            : "\n\nAbeg register your TIN first to submit e-invoice."
        };
      }

      // For demo purposes, create a sample UBL invoice
      const sampleInvoice = {
        id: `INV-${Date.now()}`,
        issueDate: new Date().toISOString().split('T')[0],
        supplierTin: user.tin,
        supplierName: user.name || 'TaxBridge User',
        customerTin: '12345678901', // Sample customer
        customerName: 'Sample Customer',
        items: [
          {
            description: 'Consulting Services',
            quantity: 1,
            unitPrice: 100000,
            taxRate: 7.5
          }
        ],
        currency: 'NGN'
      };

      // Generate UBL XML
      const subtotal = sampleInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const vat = subtotal * 0.075; // 7.5% VAT
      const total = subtotal + vat;
      
      const invoiceData = {
        id: sampleInvoice.id,
        issueDate: sampleInvoice.issueDate,
        supplierTIN: sampleInvoice.supplierTin,
        supplierName: sampleInvoice.supplierName,
        customerName: sampleInvoice.customerName,
        items: sampleInvoice.items,
        subtotal,
        vat,
        total
      };
      
      const ublXml = generateUBL(invoiceData);
      
      // Validate UBL
      const validation = validateUblXml(ublXml, 'path/to/ubl.xsd');
      if (!validation.ok) {
        return {
          message: language === 'en'
            ? `\n\nInvoice validation failed: ${validation.error}`
            : `\n\nInvoice validation fail: ${validation.error}`
        };
      }

      // Submit to DigiTax
      const submission = await submitToDigiTax(
        {
          invoiceId: sampleInvoice.id,
          ublXml
        },
        {
          apiUrl: process.env.DIGITAX_API_URL || 'https://api.digitax.ng',
          apiKey: process.env.DIGITAX_API_KEY || '',
          hmacSecret: process.env.DIGITAX_HMAC_SECRET,
          mockMode: process.env.NODE_ENV !== 'production'
        }
      );

      // Store invoice record
      await this.prisma.invoice.create({
        data: {
          userId,
          customerName: sampleInvoice.customerName,
          status: 'stamped',
          subtotal: subtotal * 100, // Convert to cents for decimal
          vat: vat * 100,
          total: total * 100,
          items: sampleInvoice.items as any,
          ublXml,
          nrsReference: submission.nrsReference,
          qrCode: submission.qrCode
        }
      });

      const successMessage = language === 'en'
        ? `\n\n✅ E-invoice submitted successfully!\nIRN: ${submission.irn}\nNRS Reference: ${submission.nrsReference}`
        : `\n\n✅ E-invoice submit successfully!\nIRN: ${submission.irn}\nNRS Reference: ${submission.nrsReference}`;

      return {
        message: successMessage,
        data: {
          invoiceId: sampleInvoice.id,
          irn: submission.irn,
          nrsReference: submission.nrsReference
        }
      };

    } catch (error) {
      logger.error('E-invoice action error:', { err: error });
      return {
        message: language === 'en'
          ? "\n\nFailed to submit e-invoice. Please try again or contact support."
          : "\n\nE-invoice submission fail. Try again or contact support."
      };
    }
  }

  private async handlePaymentAction(
    userId?: string, 
    language: 'en' | 'pidgin' = 'en'
  ): Promise<{ message: string; data?: any } | null> {
    if (!userId) {
      return {
        message: language === 'en'
          ? "\n\nPlease log in to generate payment RRR."
          : "\n\nAbeg login first to generate payment RRR."
      };
    }

    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          message: language === 'en'
            ? "\n\nUser not found. Please log in again."
            : "\n\nUser no found. Abeg login again."
        };
      }

      // Generate sample RRR for VAT payment
      const rrrData = await remitaAdapter.generateRRR({
        amount: 7500, // Sample VAT amount
        payerName: user.name || 'TaxBridge User',
        payerEmail: user.phone || 'user@taxbridge.ng',
        payerPhone: user.phone || '08012345678',
        description: 'VAT Payment - TaxBridge',
        orderId: `VAT-${Date.now()}`
      });

      if (rrrData.success && rrrData.rrr) {
        // Store payment record
        await this.prisma.payment.create({
          data: {
            invoiceId: '00000000-0000-0000-0000-000000000000', // Default UUID for chatbot payments
            rrr: rrrData.rrr,
            amount: 7500 * 100, // Convert to cents
            status: 'pending',
            payerName: user.name || 'TaxBridge User',
            payerEmail: user.phone || 'user@taxbridge.ng',
            payerPhone: user.phone || '08012345678'
          }
        });

        const paymentMessage = language === 'en'
          ? `\n\n💳 RRR Generated Successfully!\nRRR: ${rrrData.rrr}\nAmount: NGN 7,500\nPay: ${rrrData.paymentUrl}`
          : `\n\n💳 RRR Generate Successfully!\nRRR: ${rrrData.rrr}\nAmount: NGN 7,500\nPay: ${rrrData.paymentUrl}`;

        return {
          message: paymentMessage,
          data: {
            rrr: rrrData.rrr,
            amount: 7500,
            paymentUrl: rrrData.paymentUrl
          }
        };
      } else {
        return {
          message: language === 'en'
            ? `\n\nFailed to generate RRR: ${rrrData.error}`
            : `\n\nRRR generation fail: ${rrrData.error}`
        };
      }

    } catch (error) {
      logger.error('Payment action error:', { err: error });
      return {
        message: language === 'en'
          ? "\n\nFailed to generate payment RRR. Please try again."
          : "\n\nPayment RRR generation fail. Try again."
      };
    }
  }

  private async logQuery(userId: string, query: string, language: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'chatbot_query',
          metadata: {
            query,
            language,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      logger.error('Failed to log chatbot query:', { err: error });
    }
  }

  // Method to get analytics data
  async getAnalytics(userId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const whereClause: any = {
      action: 'chatbot_query'
    };

    if (userId) {
      whereClause.userId = userId;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const totalQueries = await this.prisma.auditLog.count({ where: whereClause });
    
    const queriesByLanguage = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: whereClause,
      _count: true
    });

    return {
      totalQueries,
      queriesByLanguage,
      period: {
        startDate,
        endDate
      }
    };
  }
}

export default TaxChatbot;
