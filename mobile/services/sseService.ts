import EventSource from 'react-native-sse';
import { logComplianceEvent } from './complianceEventService';

export type SSEEventName =
  | 'tin_verified'
  | 'tin_failed'
  | 'vat_registered'
  | 'einvoice_alert'
  | 'compliance_deadline'
  | 'payment_confirmed'
  | 'invoice_submitted';

type EventHandler = (payload: Record<string, unknown>) => void;
type SSEPayload = { type?: SSEEventName; payload?: Record<string, unknown> };

class SSEService {
  private source: EventSource<string> | null = null;
  private handlers = new Map<SSEEventName, Set<EventHandler>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;

  connect(token: string) {
    this.token = token;
    if (this.source) return;

    this.source = new EventSource(`${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.taxbridge.ng'}/api/v1/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-TaxBridge-Version': '13',
      },
    });

    const handleEvent = (event: { data?: string }) => {
      try {
        const rawData = event.data;
        if (typeof rawData !== 'string') return;
        const parsed = JSON.parse(rawData) as SSEPayload;
        if (!parsed.type || !parsed.payload) return;
        const payload = parsed.payload;
        this.handlers.get(parsed.type)?.forEach((handler) => handler(payload));
        if (parsed.type === 'tin_verified') {
          logComplianceEvent('tin_verified', 'TIN verified successfully', 'info', payload).catch(() => undefined);
        }
        if (parsed.type === 'tin_failed') {
          logComplianceEvent('tin_failed', 'TIN verification failed', 'warning', payload).catch(() => undefined);
        }
        if (parsed.type === 'invoice_submitted') {
          logComplianceEvent('invoice_submitted', 'Invoice submitted successfully', 'info', payload).catch(() => undefined);
        }
      } catch {}
    };

    this.source.addEventListener('message', handleEvent);
    this.source.addEventListener('tin_verified', handleEvent);
    this.source.addEventListener('tin_failed', handleEvent);
    this.source.addEventListener('vat_registered', handleEvent);
    this.source.addEventListener('einvoice_alert', handleEvent);
    this.source.addEventListener('compliance_deadline', handleEvent);
    this.source.addEventListener('payment_confirmed', handleEvent);
    this.source.addEventListener('invoice_submitted', handleEvent);
    this.source.addEventListener('error', () => {
      this.source?.close();
      this.source = null;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      if (this.token) {
        this.reconnectTimeout = setTimeout(() => {
          if (this.token) {
            this.connect(this.token);
          }
        }, 5000);
      }
    });
  }

  on(eventName: SSEEventName, handler: EventHandler) {
    const existing = this.handlers.get(eventName) ?? new Set<EventHandler>();
    existing.add(handler);
    this.handlers.set(eventName, existing);

    return () => {
      existing.delete(handler);
      if (existing.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.source?.close();
    this.source = null;
    this.token = null;
    this.handlers.clear();
  }
}

export const sseService = new SSEService();
