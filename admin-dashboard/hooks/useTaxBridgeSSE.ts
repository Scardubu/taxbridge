'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getTaxBridgeSseUrl, getStableAdminDeviceId, TAXBRIDGE_API_VERSION } from '@/lib/api-contract';

export interface TaxBridgeSSEOptions {
  enabled?: boolean;
  url?: string | null;
  eventTypes?: string[];
  onEvent?: (event: MessageEvent<string>, eventType: string) => void;
  onOpen?: () => void;
  onError?: () => void;
}

export interface TaxBridgeSSEState {
  connected: boolean;
  lastEventAt: string | null;
  transport: 'sse' | 'disabled' | 'unavailable';
}

export function useTaxBridgeSSE(options: TaxBridgeSSEOptions = {}): TaxBridgeSSEState {
  const {
    enabled = true,
    url,
    eventTypes = [],
    onEvent,
    onOpen,
    onError,
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const resolvedUrl = useMemo(() => {
    const baseUrl = url ?? getTaxBridgeSseUrl();
    if (!baseUrl) {
      return null;
    }

    const nextUrl = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
    nextUrl.searchParams.set('deviceId', getStableAdminDeviceId());
    nextUrl.searchParams.set('version', TAXBRIDGE_API_VERSION);
    nextUrl.searchParams.set('platform', 'admin');
    return nextUrl.toString();
  }, [url]);

  useEffect(() => {
    if (!enabled || !resolvedUrl || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      setConnected(false);
      return;
    }

    const source = new EventSource(resolvedUrl, { withCredentials: false });
    sourceRef.current = source;

    const handleOpen = () => {
      setConnected(true);
      onOpen?.();
    };

    const handleError = () => {
      setConnected(false);
      onError?.();
    };

    const handleNamedEvent = (eventType: string) => (event: MessageEvent<string>) => {
      setLastEventAt(new Date().toISOString());
      onEvent?.(event, eventType);
    };

    source.addEventListener('open', handleOpen as EventListener);
    source.addEventListener('error', handleError as EventListener);

    const handlers = eventTypes.map((eventType) => {
      const handler = handleNamedEvent(eventType);
      source.addEventListener(eventType, handler as EventListener);
      return { eventType, handler };
    });

    source.onmessage = (event) => {
      setLastEventAt(new Date().toISOString());
      onEvent?.(event, 'message');
    };

    return () => {
      source.removeEventListener('open', handleOpen as EventListener);
      source.removeEventListener('error', handleError as EventListener);
      handlers.forEach(({ eventType, handler }) => {
        source.removeEventListener(eventType, handler as EventListener);
      });
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [enabled, eventTypes, onError, onEvent, onOpen, resolvedUrl]);

  return {
    connected,
    lastEventAt,
    transport: enabled ? (resolvedUrl ? 'sse' : 'unavailable') : 'disabled',
  };
}
