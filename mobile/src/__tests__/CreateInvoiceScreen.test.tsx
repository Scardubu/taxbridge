import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

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
  it('renders and validates', () => {
    const navigation: any = { navigate: jest.fn() };
    const { getByText, getByPlaceholderText, getByTestId } = render(<CreateInvoiceScreen navigation={navigation} />);

    // The component uses i18n which is mocked to return the key, so we look for the mocked key
    expect(getByText('create.save')).toBeTruthy();
    // add basic interactions
    const desc = getByPlaceholderText('e.g. Rice bag');
    fireEvent.changeText(desc, 'Rice');
    expect(getByTestId('button-create.addItem')).toBeTruthy();
    fireEvent.press(getByTestId('button-create.addItem'));
  });

  it('calls OCR flow when scan pressed', async () => {
    const navigation: any = { navigate: jest.fn() };
    const { getByTestId } = render(<CreateInvoiceScreen navigation={navigation} />);

    // Spy on Alert to auto-select gallery path
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert').mockImplementation((title: string, msg: string, buttons: any[]) => {
      const choose = buttons && buttons.find((b: any) => String(b.text).includes('Gallery'));
      if (choose && choose.onPress) choose.onPress();
    });

    // override image picker to return a fake uri
    const imgPicker = require('../services/ocr');
    const ImagePicker = require('expo-image-picker');
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://fake.jpg' }] });

    const scan = getByTestId('button-scanReceipt');
    fireEvent.press(scan);

    // wait for async calls
    await new Promise((r) => setTimeout(r, 50));

    expect(imgPicker.extractReceiptData).toHaveBeenCalled();
  });
});
