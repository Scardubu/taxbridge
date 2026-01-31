// __tests__/screens/CreateInvoiceScreen.test.tsx
import React from 'react';
import { View } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CreateInvoiceScreen from '../../src/screens/CreateInvoiceScreen';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('../../src/contexts/FeatureFlagContext', () => ({
  useFeatureFlag: () => false,
  FeatureFlagProvider: ({ children }: any) => children,
}));

describe('CreateInvoiceScreen', () => {
  it('should add and edit items correctly', async () => {
    const { getByText, getByPlaceholderText, getAllByText, getByLabelText } = render(
      <CreateInvoiceScreen navigation={mockNavigation} />
    );
    
    // Navigate to items step
    fireEvent.press(getByText('common.continueItems'));
    
    // Add first item
    fireEvent.changeText(getByPlaceholderText('common.itemPlaceholder'), 'Product A');
    fireEvent.changeText(getByLabelText('create.quantity'), '2');
    fireEvent.changeText(getByLabelText('create.unitPrice'), '100');
    fireEvent.press(getByText('common.addItem'));
    
    // Verify item was added
    expect(getByText('Product A')).toBeTruthy();
    
    // Edit the item
    const editButtons = getAllByText('✎');
    fireEvent.press(editButtons[0]);
    
    // Verify edit mode
    expect(getByText('create.editingItem')).toBeTruthy();
    expect(getByPlaceholderText('common.itemPlaceholder').props.value).toBe('Product A');
    
    // Update item
    fireEvent.changeText(getByPlaceholderText('common.itemPlaceholder'), 'Product B');
    fireEvent.press(getByText('common.updateItem'));
    
    // Verify update
    expect(getByText('Product B')).toBeTruthy();
  });

  it('should save and restore drafts', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await require('@react-native-async-storage/async-storage').setItem(
      'invoice_draft',
      JSON.stringify({ customerName: 'John Doe', items: [], timestamp: Date.now() })
    );

    render(<CreateInvoiceScreen navigation={mockNavigation} />);
    
    // Should show draft restoration prompt
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'create.draftFound',
        expect.any(String),
        expect.any(Array)
      );
    });
  });

  it('should provide haptic feedback on interactions', () => {
    // Mock Haptics
    const mockHaptics = jest.spyOn(require('expo-haptics'), 'impactAsync');
    
    const { getByText } = render(
      <CreateInvoiceScreen navigation={mockNavigation} />
    );
    
    // Click continue button
    fireEvent.press(getByText('common.continueItems'));
    
    // Verify haptic feedback was triggered
    expect(mockHaptics).toHaveBeenCalled();
  });
});