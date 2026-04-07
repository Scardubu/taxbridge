import { create } from 'zustand';
import { useBusinessProfileStore } from './businessProfileStore';
import { receiptService, RECEIPT_FALLBACK_BUSINESS_ID } from '../services/receiptService';
import type { ReceiptRecord } from '../types/receipt';

interface ReceiptStats {
  count: number;
  totalAmountNgn: number;
  totalVatCreditNgn: number;
}

interface ReceiptState {
  receipts: ReceiptRecord[];
  stats: ReceiptStats;
  hydrate: (businessId: string, month: number, year: number) => Promise<void>;
  markServerConfirmed: (clientId: string, serverId: string, vatCreditNgn?: number) => Promise<void>;
  markFlagged: (clientId: string) => Promise<void>;
  addReceipt: (receipt: ReceiptRecord) => void;
}

function getResolvedBusinessId(): string {
  return useBusinessProfileStore.getState().businessId ?? RECEIPT_FALLBACK_BUSINESS_ID;
}

export const useReceiptStore = create<ReceiptState>()((set, get) => ({
  receipts: [],
  stats: { count: 0, totalAmountNgn: 0, totalVatCreditNgn: 0 },
  hydrate: async (businessId, month, year) => {
    const stats = await receiptService.getStats(businessId, month, year);
    set({ stats });
  },
  markServerConfirmed: async (clientId, serverId, vatCreditNgn) => {
    await receiptService.markServerConfirmed(clientId, serverId, vatCreditNgn);
    const now = new Date();
    await get().hydrate(getResolvedBusinessId(), now.getMonth() + 1, now.getFullYear());
  },
  markFlagged: async (clientId) => {
    await receiptService.markFlagged(clientId);
    set((state) => ({
      receipts: state.receipts.map((receipt) => (
        receipt.id === clientId ? { ...receipt, status: 'flagged' } : receipt
      )),
    }));
  },
  addReceipt: (receipt) => {
    const now = new Date();
    const receiptDate = new Date(receipt.date);
    const affectsCurrentMonth = receiptDate.getMonth() === now.getMonth() && receiptDate.getFullYear() === now.getFullYear();

    set((state) => ({
      receipts: [receipt, ...state.receipts],
      stats: affectsCurrentMonth
        ? {
            count: state.stats.count + 1,
            totalAmountNgn: state.stats.totalAmountNgn + receipt.amountNgn,
            totalVatCreditNgn: state.stats.totalVatCreditNgn + receipt.vatAmountNgn,
          }
        : state.stats,
    }));
  },
}));
