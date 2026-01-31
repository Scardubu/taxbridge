export type InvoiceStatus = 'queued' | 'processing' | 'stamped' | 'failed';

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type LocalInvoiceRow = {
  id: string;
  serverId: string | null;
  customerName: string | null;
  customerTIN: string | null;
  customerEndpointId: string | null;
  status: InvoiceStatus;
  subtotal: number;
  vat: number;
  total: number;
  items: string;
  createdAt: string;
  synced: 0 | 1;
  attempts?: number;
  nextRetry?: string | null;
};

export type NewInvoiceInput = {
  customerName?: string;
  customerTIN?: string;
  customerEndpointId?: string;
  items: InvoiceItem[];
};
