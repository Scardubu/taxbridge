// __tests__/screens/CreateInvoiceScreen.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CreateInvoiceScreen from '../CreateInvoiceScreen';

describe('CreateInvoiceScreen', () => {
  it('should add and edit items correctly', async () => {
    const { getByText, getByPlaceholder, getAllByText } = render(
      <CreateInvoiceScreen navigation={mockNavigation} />
    );
    
    // Navigate to items step
    fireEvent.press(getByText('Continue'));
    
    // Add first item
    fireEvent.changeText(getByPlaceholder('Item description'), 'Product A');
    fireEvent.changeText(getByPlaceholder('Quantity'), '2');
    fireEvent.changeText(getByPlaceholder('Unit price'), '100');
    fireEvent.press(getByText('Add Item'));
    
    // Verify item was added
    expect(getByText('Product A')).toBeTruthy();
    
    // Edit the item
    const editButtons = getAllByText('✎');
    fireEvent.press(editButtons[0]);
    
    // Verify edit mode
    expect(getByText('Editing Item')).toBeTruthy();
    expect(getByPlaceholder('Item description').value).toBe('Product A');
    
    // Update item
    fireEvent.changeText(getByPlaceholder('Item description'), 'Product B');
    fireEvent.press(getByText('Update Item'));
    
    // Verify update
    expect(getByText('Product B')).toBeTruthy();
  });

  it('should save and restore drafts', async () => {
    const { getByPlaceholder, getByText, rerender } = render(
      <CreateInvoiceScreen navigation={mockNavigation} />
    );
    
    // Add customer name
    fireEvent.changeText(getByPlaceholder('Customer name'), 'John Doe');
    
    // Wait for debounced auto-save
    await waitFor(() => {
      // Draft should be saved
    }, { timeout: 3000 });
    
    // Unmount component (simulate app close)
    rerender(<View />);
    
    // Remount component
    rerender(<CreateInvoiceScreen navigation={mockNavigation} />);
    
    // Should show draft restoration prompt
    await waitFor(() => {
      expect(getByText('Draft Found')).toBeTruthy();
    });
  });

  it('should provide haptic feedback on interactions', () => {
    // Mock Haptics
    const mockHaptics = jest.spyOn(require('expo-haptics'), 'impactAsync');
    
    const { getByText } = render(
      <CreateInvoiceScreen navigation={mockNavigation} />
    );
    
    // Click continue button
    fireEvent.press(getByText('Continue'));
    
    // Verify haptic feedback was triggered
    expect(mockHaptics).toHaveBeenCalled();
  });
});