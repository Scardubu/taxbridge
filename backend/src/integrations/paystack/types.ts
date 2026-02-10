/**
 * Paystack API Types
 * @see https://paystack.com/docs/api/
 */

export interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
  webhookSecret: string;
}

// --- Initialize Transaction ---

export interface PaystackInitializeRequest {
  amount: number; // In kobo (₦1 = 100 kobo)
  email: string;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, any>;
  channels?: ('card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer')[];
  currency?: string;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

// --- Verify Transaction ---

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number; // In kobo
    currency: string;
    channel: string;
    paid_at: string | null;
    created_at: string;
    customer: {
      email: string;
      customer_code: string;
      first_name: string | null;
      last_name: string | null;
    };
    authorization?: {
      authorization_code: string;
      card_type: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      bin: string;
      bank: string;
      channel: string;
      reusable: boolean;
      country_code: string;
    };
    metadata?: Record<string, any>;
  };
}

// --- Webhook Event ---

export interface PaystackWebhookEvent {
  event: string; // e.g. 'charge.success'
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string | null;
    customer: {
      email: string;
      customer_code: string;
    };
    authorization?: {
      card_type: string;
      last4: string;
      bank: string;
      channel: string;
    };
    metadata?: Record<string, any>;
  };
}

// --- Common result types ---

export interface PaystackInitResult {
  success: boolean;
  reference?: string;
  authorizationUrl?: string;
  accessCode?: string;
  error?: string;
}

export interface PaystackVerifyResult {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  amount?: number; // In Naira
  reference?: string;
  channel?: string;
  paidAt?: string;
  cardType?: string;
  last4?: string;
  bank?: string;
  error?: string;
}
