// __tests__/screens/HomeScreen.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

const mockNavigation = {
  navigate: jest.fn(),
};

describe('HomeScreen', () => {
  it('should display stats when invoices exist', async () => {
    const { getByText } = render(<HomeScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText(/Monthly Sales/i)).toBeTruthy();
    });
  });

  it('should show empty state when no invoices', async () => {
    require('../services/database').getInvoices.mockResolvedValue([]);
    
    const { getByText } = render(<HomeScreen navigation={mockNavigation} />);
    
    await waitFor(() => {
      expect(getByText(/No Invoices Yet/i)).toBeTruthy();
    });
  });
});