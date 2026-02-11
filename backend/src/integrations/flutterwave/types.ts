/**
 * Flutterwave API Types
 * @see https://developer.flutterwave.com/docs
 */

export interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  secretHash: string;
  encryptionKey: string;
  baseUrl: string;
}

// --- Initialize Payment ---

export interface FlutterwaveInitializeRequest {
  tx_ref: string;
  amount: number; // In Naira
  currency: string;
  redirect_url?: string;
  customer: {
    email: string;
    name?: string;
    phonenumber?: string;
  };
  meta?: Record<string, any>;
  payment_options?: string; // "card,banktransfer,ussd,mobilemoney"
  customizations?: {
    title?: string;
    description?: string;
    logo?: string;
  };
}

export interface FlutterwaveInitializeResponse {
  status: string; // "success"
  message: string;
  data: {
    link: string; // Checkout URL
  };
}

// --- Verify Transaction ---

export interface FlutterwaveVerifyResponse {
  status: string; // "success"
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    charged_amount: number;
    status: 'successful' | 'failed' | 'pending';
    payment_type: string; // "card", "banktransfer", etc.
    created_at: string;
    customer: {
      id: number;
      email: string;
      name: string;
      phone_number: string;
    };
    card?: {
      type: string;
      last_4digits: string;
      issuer: string;
      expiry: string;
    };
    meta?: Record<string, any>;
  };
}

// --- Webhook Event ---

export interface FlutterwaveWebhookEvent {
  event: string; // "charge.completed"
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    customer: {
      email: string;
      name: string;
      phone_number: string;
    };
    card?: {
      type: string;
      last_4digits: string;
    };
  };
}

// --- Common result types ---

export interface FlutterwaveInitResult {
  success: boolean;
  reference?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface FlutterwaveVerifyResult {
  status: 'successful' | 'failed' | 'pending';
  amount?: number;
  reference?: string;
  flwRef?: string;
  channel?: string;
  paidAt?: string;
  cardType?: string;
  last4?: string;
  error?: string;
}
