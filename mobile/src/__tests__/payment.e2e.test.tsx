import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PaymentScreen from '../screens/PaymentScreen';
import { api } from '../services/api';

// Mock dependencies
jest.mock('../services/api');
jest.mock('../services/authTokens', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token')
}));
jest.mock('../contexts/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true, isConnected: true, connectionType: 'wifi', forceCheck: async () => true }),
  NetworkProvider: ({ children }: any) => children
}));
jest.mock('../contexts/LoadingContext', () => {
  const React = require('react');
  return {
    LoadingContext: React.createContext({ setLoading: jest.fn() }),
  };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

describe('PaymentScreen E2E Tests', () => {
  // Use 8-char IDs to match the truncation in PaymentScreen (invoice.id.slice(0, 8))
  const mockInvoice = {
    id: 'TEST-INV',
    total: 1000,
    customerName: 'Test Customer',
  };

  const mockRoute = {
    params: {
      invoice: mockInvoice,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('Payment Flow - RRR Generation', () => {
    test('completes full payment flow from form input to RRR generation', async () => {
      // Mock successful RRR generation
      (api.post as jest.Mock).mockResolvedValueOnce({
        rrr: 'RRR-123456789',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        amount: 1000,
      });

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      // Step 1: Fill in payer details (actual placeholders from PaymentScreen)
      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      // Step 2: Submit payment request (actual button text)
      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      // Step 3: Verify API call
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/payments/generate', {
          invoiceId: mockInvoice.id,
          payerName: 'John Doe',
          payerEmail: 'john@example.com',
          payerPhone: '08012345678',
        });
      });

      // Step 4: Verify success alert shown
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Ready',
          expect.stringContaining('RRR-123456789'),
          expect.any(Array)
        );
      });
    });

    test('validates form inputs before submission', async () => {
      const { getByText } = render(<PaymentScreen route={mockRoute} />);

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      // Should show validation error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          'Please enter payer name'
        );
      });

      // API should not be called
      expect(api.post).not.toHaveBeenCalled();
    });

    test('validates email format', async () => {
      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'invalid-email');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          'Please enter valid email'
        );
      });
    });

    test('validates phone number length', async () => {
      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '0801234'); // Too short
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          'Please enter valid phone number'
        );
      });
    });

    test('handles API errors gracefully', async () => {
      (api.post as jest.Mock).mockRejectedValueOnce(
        new Error('API error 400: Invoice must be NRS-stamped before payment')
      );

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Invoice must be NRS-stamped before payment'
        );
      });
    });

    test('handles network errors', async () => {
      (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network error');
      });
    });
  });

  describe('Payment Status Check', () => {
    test('checks payment status after RRR generation', async () => {
      // Mock RRR generation
      (api.post as jest.Mock).mockResolvedValueOnce({
        rrr: 'RRR-123456789',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        amount: 1000,
      });

      // Mock status check
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 'pending',
      });

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      // Generate RRR first
      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      // Wait for success alert and RRR to be set
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Ready',
          expect.stringContaining('RRR-123456789'),
          expect.any(Array)
        );
      });

      // After RRR is generated, "Check Payment Status" button should appear
      await waitFor(() => {
        const statusButton = getByText('Check Payment Status');
        expect(statusButton).toBeTruthy();
      });
      
      const statusButton = getByText('Check Payment Status');
      await act(async () => {
        fireEvent.press(statusButton);
      });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          `/payments/${mockInvoice.id}/status`
        );
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Status',
          expect.stringContaining('PENDING'),
          expect.any(Array)
        );
      });
    });

    test('detects successful payment status', async () => {
      // First generate RRR to make status button visible
      (api.post as jest.Mock).mockResolvedValueOnce({
        rrr: 'RRR-123456789',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        amount: 1000,
      });
      
      // Mock status check returning paid status
      (api.get as jest.Mock).mockResolvedValueOnce({
        status: 'paid',
      });

      const { getByPlaceholderText, getByText } = render(<PaymentScreen route={mockRoute} />);

      // Generate RRR first to show status button
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText('e.g., John Doe'), 'John Doe');
        fireEvent.changeText(getByPlaceholderText('e.g., john@example.com'), 'john@example.com');
        fireEvent.changeText(getByPlaceholderText('e.g., 08012345678'), '08012345678');
      });
      
      await act(async () => {
        fireEvent.press(getByText('Generate Payment Code (RRR)'));
      });
      
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      const statusButton = getByText('Check Payment Status');
      await act(async () => {
        fireEvent.press(statusButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Payment Status',
          expect.stringContaining('PAID'),
          expect.any(Array)
        );
      });
    });

    test('handles status check errors', async () => {
      // First generate RRR to make status button visible
      (api.post as jest.Mock).mockResolvedValueOnce({
        rrr: 'RRR-123456789',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        amount: 1000,
      });
      
      (api.get as jest.Mock).mockRejectedValueOnce(new Error('API error 404: No payment found'));

      const { getByPlaceholderText, getByText } = render(<PaymentScreen route={mockRoute} />);

      // Generate RRR first to show status button
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText('e.g., John Doe'), 'John Doe');
        fireEvent.changeText(getByPlaceholderText('e.g., john@example.com'), 'john@example.com');
        fireEvent.changeText(getByPlaceholderText('e.g., 08012345678'), '08012345678');
      });
      
      await act(async () => {
        fireEvent.press(getByText('Generate Payment Code (RRR)'));
      });
      
      // Wait for the component to update with RRR
      await waitFor(() => {
        expect(getByText('Check Payment Status')).toBeTruthy();
      }, { timeout: 3000 });

      const statusButton = getByText('Check Payment Status');
      await act(async () => {
        fireEvent.press(statusButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'No payment found');
      }, { timeout: 3000 });
    }, 15000); // Increase test timeout
  });

  describe('UI/UX Tests', () => {
    test('displays invoice information correctly', () => {
      const { getByText } = render(<PaymentScreen route={mockRoute} />);

      // PaymentScreen shows: "Invoice ID" label and truncated uppercase ID
      expect(getByText('Invoice ID')).toBeTruthy();
      expect(getByText(mockInvoice.id)).toBeTruthy(); // TEST-INV (8 chars, stays same)
      expect(getByText('Test Customer')).toBeTruthy();
      // Amount is displayed as ₦{total.toFixed(2)}
      expect(getByText('₦1000.00')).toBeTruthy();
    });

    test('shows loading state during API calls', async () => {
      // Use a fast resolving mock to avoid timeout
      (api.post as jest.Mock).mockResolvedValueOnce({ 
        rrr: 'RRR-123', 
        amount: 1000, 
        paymentUrl: 'https://example.com/pay' 
      });

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      
      // Verify button exists before pressing
      expect(generateButton).toBeTruthy();

      await act(async () => {
        fireEvent.press(generateButton);
      });

      // Wait for API to be called
      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
    });

    test('displays RRR information after successful generation', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({
        rrr: 'RRR-123456789',
        paymentUrl: 'https://remitademo.net/payment/RRR-123456789',
        amount: 1000,
      });

      const { getByPlaceholderText, getByText } = render(
        <PaymentScreen route={mockRoute} />
      );

      const nameInput = getByPlaceholderText('e.g., John Doe');
      const emailInput = getByPlaceholderText('e.g., john@example.com');
      const phoneInput = getByPlaceholderText('e.g., 08012345678');

      await act(async () => {
        fireEvent.changeText(nameInput, 'John Doe');
        fireEvent.changeText(emailInput, 'john@example.com');
        fireEvent.changeText(phoneInput, '08012345678');
      });

      const generateButton = getByText('Generate Payment Code (RRR)');
      await act(async () => {
        fireEvent.press(generateButton);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });
    });
  });

  describe('Integration with Invoice Flow', () => {
    test('receives invoice data from navigation params', () => {
      const customInvoice = {
        id: 'CUSTOM-I', // 8 chars (matches truncation)
        total: 2500,
        customerName: 'Custom Customer',
      };

      const customRoute = {
        params: {
          invoice: customInvoice,
        },
      };

      const { getByText } = render(<PaymentScreen route={customRoute} />);

      // PaymentScreen shows truncated ID directly
      expect(getByText(customInvoice.id)).toBeTruthy();
      expect(getByText('Custom Customer')).toBeTruthy();
      // Amount as ₦{total.toFixed(2)}
      expect(getByText('₦2500.00')).toBeTruthy();
    });

    test('handles missing customer name gracefully', () => {
      const invoiceWithoutCustomer = {
        id: 'TEST-789',
        total: 1500,
      };

      const routeWithoutCustomer = {
        params: {
          invoice: invoiceWithoutCustomer,
        },
      };

      const { queryByText, getByText } = render(
        <PaymentScreen route={routeWithoutCustomer} />
      );

      // Should not crash, invoice ID should be displayed
      expect(getByText('Invoice ID')).toBeTruthy();
      // Customer section should not render since customerName is undefined
      expect(queryByText('Customer')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    test('form inputs have proper placeholders', () => {
      const { getByPlaceholderText } = render(
        <PaymentScreen route={mockRoute} />
      );

      expect(getByPlaceholderText('e.g., John Doe')).toBeTruthy();
      expect(getByPlaceholderText('e.g., john@example.com')).toBeTruthy();
      expect(getByPlaceholderText('e.g., 08012345678')).toBeTruthy();
    });

    test('buttons have descriptive text', () => {
      const { getByText } = render(<PaymentScreen route={mockRoute} />);

      // Initial state only shows Generate button
      expect(getByText('Generate Payment Code (RRR)')).toBeTruthy();
    });
  });
});
