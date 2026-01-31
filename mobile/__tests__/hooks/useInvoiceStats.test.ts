// __tests__/hooks/useInvoiceStats.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useInvoiceStats } from '../../src/hooks/useAppHooks';

jest.mock('../../src/services/database');

describe('useInvoiceStats', () => {
  it('should load and calculate stats correctly', async () => {
    const mockInvoices = [
      { id: '1', synced: 1, items: '[{"quantity":2,"unitPrice":100}]', createdAt: Date.now() },
      { id: '2', synced: 0, items: '[{"quantity":1,"unitPrice":50}]', createdAt: Date.now() },
    ];
    
    require('../../src/services/database').getInvoices.mockResolvedValue(mockInvoices);

    const { result } = renderHook(() => useInvoiceStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats).toEqual({
      count: 2,
      pending: 1,
      totalSales: 250,
    });
  });
});