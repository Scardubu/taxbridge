import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

// Mock database to avoid AsyncStorage issues in tests
jest.mock('../services/database', () => ({
  initDB: jest.fn().mockResolvedValue(undefined),
  saveInvoice: jest.fn().mockResolvedValue(undefined),
  getInvoices: jest.fn().mockResolvedValue([]),
  getPendingInvoices: jest.fn().mockResolvedValue([]),
  markInvoiceSynced: jest.fn().mockResolvedValue(undefined),
  updateInvoiceStatus: jest.fn().mockResolvedValue(undefined),
  getSetting: jest.fn().mockResolvedValue(null),
  getApiBaseUrl: jest.fn().mockResolvedValue('http://localhost'),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

// Mock AnimatedButton to a simple pressable for testing
jest.mock('../components/AnimatedButton', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Text, Pressable } = require('react-native');
  return function MockAnimatedButton(props: any) {
    const testID = props.testID || `button-${props.title}`;
    return React.createElement(
      Pressable,
      { onPress: props.onPress, disabled: props.disabled, testID },
      React.createElement(Text, null, props.title)
    );
  };
});

import CreateInvoiceScreen from '../screens/CreateInvoiceScreen';

// Mock OCR service so we can assert it was called
jest.mock('../services/ocr', () => ({
  extractReceiptData: jest.fn().mockResolvedValue({ amount: 1200, date: new Date().toISOString(), items: [], confidence: 0.85 }),
  validateOCRResult: jest.requireActual('../services/ocr').validateOCRResult,
}));

describe('CreateInvoiceScreen', () => {
  it('renders the wizard-style interface', () => {
    const navigation: any = { navigate: jest.fn() };
    const { getByText, getByPlaceholderText } = render(<CreateInvoiceScreen navigation={navigation} />);

    // Step 1 shows customer information by default
    expect(getByText('create.title')).toBeTruthy();
    expect(getByText('create.customer')).toBeTruthy();
    
    // Customer placeholder should be visible
    const customerInput = getByPlaceholderText('e.g. Aisha Mohammed');
    expect(customerInput).toBeTruthy();
    
    // Continue button should be present
    expect(getByText('Continue to Items →')).toBeTruthy();
  });

  it('navigates through wizard steps', async () => {
    const navigation: any = { navigate: jest.fn() };
    const { getByText, getByPlaceholderText, queryByText } = render(<CreateInvoiceScreen navigation={navigation} />);

    // Start on Step 1: Customer
    expect(getByText('create.customer')).toBeTruthy();
    
    // Navigate to Step 2: Items
    await act(async () => {
      fireEvent.press(getByText('Continue to Items →'));
    });

    // Step 2 should show item input fields
    await waitFor(() => {
      // Check for item-related content (description placeholder)
      expect(getByPlaceholderText('e.g. Rice bag (50kg)')).toBeTruthy();
    });
  });

  it('allows adding items in the items step', async () => {
    const navigation: any = { navigate: jest.fn() };
    const { getByText, getByPlaceholderText, getByTestId, queryAllByTestId } = render(<CreateInvoiceScreen navigation={navigation} />);

    // Navigate to Items step
    await act(async () => {
      fireEvent.press(getByText('Continue to Items →'));
    });

    await waitFor(() => {
      expect(getByPlaceholderText('e.g. Rice bag (50kg)')).toBeTruthy();
    });

    // Fill in item details
    const descInput = getByPlaceholderText('e.g. Rice bag (50kg)');
    
    await act(async () => {
      fireEvent.changeText(descInput, 'Rice');
    });

    // Add item button should work
    const addItemButton = getByTestId('button-+ Add Item');
    expect(addItemButton).toBeTruthy();
  });
});
