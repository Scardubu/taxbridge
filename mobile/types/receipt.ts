export const ExpenseCategories = [
  'raw_materials',
  'professional_svc',
  'utilities',
  'equipment',
  'rent',
  'transport',
  'other',
] as const;

export type ExpenseCategory = typeof ExpenseCategories[number];

export interface DraftReceipt {
  vendorName: string;
  vendorTin: string | null;
  amountNgn: number;
  vatAmountNgn: number;
  date: string;
  category: ExpenseCategory;
  rawOcrText: string | null;
  imageHash: string | null;
  capturedAt: string;
}

export interface ReceiptRecord extends DraftReceipt {
  id: string;
  serverId: string | null;
  businessId: string;
  status: 'pending' | 'synced' | 'duplicate' | 'flagged';
  vatCreditId: string | null;
  createdAt: string;
  updatedAt: string;
}
