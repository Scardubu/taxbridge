import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewInvoiceInput } from '../types/invoice';

export type CreateInvoiceResponse = {
  invoiceId: string;
  status: string;
};

const API_BASE_URL_KEY = 'taxbridge_api_base_url';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const customUrl = await AsyncStorage.getItem(API_BASE_URL_KEY);
    if (customUrl) {
      return customUrl;
    }
  } catch (error) {
    console.warn('Failed to load custom API URL:', error);
  }
  
  // Default for development - works with emulator
  return __DEV__ ? 'http://10.0.2.2:3000' : 'https://api.taxbridge.ng';
}

export async function setApiBaseUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(API_BASE_URL_KEY, url);
  } catch (error) {
    console.error('Failed to save API URL:', error);
    throw error;
  }
}

export async function createInvoice(input: NewInvoiceInput): Promise<CreateInvoiceResponse> {
  const baseUrl = await getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customerName: input.customerName,
      items: input.items
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return (await res.json()) as CreateInvoiceResponse;
}

async function request(method: string, path: string, body?: any) {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  post: (path: string, body?: any) => request('POST', path, body),
  get: (path: string) => request('GET', path)
};
