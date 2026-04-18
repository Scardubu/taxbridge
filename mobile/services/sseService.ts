import EventSource from 'react-native-sse';
import * as Sentry from '@sentry/react-native';
import { logComplianceEvent } from './complianceEventService';
import { TokenService } from './tokenService';

export type SSEEventName =
  | 'tin_verified'
  | 'tin_failed'
  | 'vat_registered'
  | 'einvoice_alert'
  | 'compliance_deadline'
  | 'payment_confirmed'
  | 'invoice_submitted'
  | 'admin_alert'
  | 'obligation_override'
  | 'tin_manual_verify'
  | 'receipt_processed'
  | 'receipt_flagged'
  | 'vat_return_accepted'
  | 'tax_assessment_issued';

type EventHandler = (payload: Record<string, unknown>) => void;
type SSEPayload = { type?: SSEEventName; payload?: Record<string, unknown> };

class SSEService {
  private source: EventSource<string> | null = null;
  private readonly handlers = new Map<SSEEventName, Set<EventHandler>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 8;
  private static readonly BASE_DELAY_MS = 2000;

  connect(token: string) {
    this.token = token;
    if (this.source) return;
    this.reconnectAttempts = 0;

    this.source = new EventSource(`${process.env.EXPO_PUBLIC_API_URL ?? 'https://api.taxbridge.ng'}/api/v1/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-TaxBridge-Version': '13',
      },
    });

    const handleEvent = (event: { data?: string | null }) => {
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
      } catch (err) {
        Sentry.captureException(err, { tags: { source: 'sse_parse' } });
      }
    };

    const addListener = (name: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.source?.addEventListener(name as any, handleEvent as any);
    ['message', 'tin_verified', 'tin_failed', 'vat_registered',
      'einvoice_alert', 'compliance_deadline', 'payment_confirmed', 'invoice_submitted',
      'admin_alert', 'obligation_override', 'tin_manual_verify', 'receipt_processed',
      'receipt_flagged', 'vat_return_accepted', 'tax_assessment_issued',
    ].forEach(addListener);
    this.source.addEventListener('error', () => {
      this.source?.close();
      this.source = null;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      if (this.reconnectAttempts >= SSEService.MAX_RECONNECT_ATTEMPTS) {
        Sentry.captureMessage('SSE max reconnect attempts reached — giving up', 'warning');
        return;
      }
      const jitter = Math.random() * 1000;
      const delay = Math.min(SSEService.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts), 60000) + jitter;
      this.reconnectAttempts++;
      this.reconnectTimeout = setTimeout(() => {
        void (async () => {
          const freshToken = await TokenService.getAccessToken();
          if (freshToken) {
            this.token = freshToken;
            this.source = null;
            this.connect(freshToken);
          }
        })();
      }, delay);
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
