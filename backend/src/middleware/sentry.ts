import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';

import { remitaClient } from '../integrations/remita';
import { generateUBL, InvoiceData } from '../lib/ubl/generator';
import { analyzeMandatoryFields } from '../lib/ubl/mandatoryFields';
import { validateUblXml } from '../lib/ubl/validate';
import { metrics } from '../services/metrics';

let initialized = false;

export interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'error';
  provider: 'digitax' | 'duplo' | 'remita';
  latency?: number | null;
  timestamp: string;
  mode?: 'mock';
  error?: string;
}

export interface UblValidationSnapshot {
  status: 'valid' | 'invalid' | 'error';
  missingFields: string[];
  xsdValid: boolean;
  timestamp: string;
  error?: string;
}

export function setupSentry(app: FastifyInstance): boolean {
  if (initialized || !process.env.SENTRY_DSN) {
    return initialized;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.VERSION || process.env.npm_package_version || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration({ breadcrumbs: true }),
      Sentry.postgresIntegration(),
      Sentry.fastifyIntegration()
    ],
    beforeSend(event, hint) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
      }

      if (event.request?.url?.includes('/health')) {
        return null;
      }

      const errorMessage = hint?.originalException instanceof Error ? hint.originalException.message : undefined;
      if (errorMessage?.toLowerCase().includes('digitax')) {
        event.tags = { ...event.tags, integration: 'digitax' };
      } else if (errorMessage?.includes('Duplo')) {
        event.tags = { ...event.tags, integration: 'duplo' };
      }
      if (errorMessage?.includes('Remita')) {
        event.tags = { ...event.tags, integration: 'remita' };
      }

      return event;
    },
    initialScope: scope => {
      scope.setTag('service', 'backend');
      return scope;
    }
  });

  Sentry.setupFastifyErrorHandler(app);

  app.addHook('onRequest', (request, _reply, done) => {
    const routePath = (request as any).routerPath || request.url;
    const scope = Sentry.getCurrentScope();
    if (scope) {
      scope.setTag('request_id', String(request.id));
      scope.setTag('route', `${request.method} ${routePath}`);
    }

    done();
  });

  initialized = true;
  return true;
}

export function captureWithSentry(error: unknown, request?: FastifyRequest, reply?: FastifyReply): void {
  if (!initialized) {
    return;
  }

  Sentry.withScope(scope => {
    if (request) {
      scope.setContext('request', {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        query: request.query
      });
    }

    if (reply) {
      scope.setTag('response_status', String(reply.statusCode));
    }

    Sentry.captureException(error);
  });
}

export async function checkDuploHealth(): Promise<IntegrationHealth> {
  const mockMode = String(process.env.DIGITAX_MOCK_MODE || 'false').toLowerCase() === 'true';
  if (mockMode) {
    return {
      status: 'healthy',
      provider: 'digitax',
      mode: 'mock',
      latency: 1,
      timestamp: new Date().toISOString()
    };
  }

  try {
    const digitaxUrl = (process.env.DIGITAX_API_URL || '').trim();
    if (!digitaxUrl) {
      return {
        status: 'error',
        provider: 'digitax',
        latency: null,
        error: 'Missing DIGITAX_API_URL',
        timestamp: new Date().toISOString()
      };
    }

    const controller = new AbortController();
    const start = Date.now();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(digitaxUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;

    return {
      status: response.ok || response.status === 302 ? 'healthy' : response.status >= 500 ? 'error' : 'degraded',
      provider: 'digitax',
      latency,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    if (initialized) {
      Sentry.captureException(error);
    }

    return {
      status: 'error',
      provider: 'digitax',
      latency: null,
      error: error?.message || 'DigiTax health check failed',
      timestamp: new Date().toISOString()
    };
  }
}

export async function checkRemitaHealth(): Promise<IntegrationHealth> {
  try {
    const result = await remitaClient.checkHealth();
    return {
      status: result.status,
      provider: 'remita',
      latency: result.latency ?? null,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    if (initialized) {
      Sentry.captureException(error);
    }

    return {
      status: 'error',
      provider: 'remita',
      latency: null,
      error: error?.message || 'Remita health check failed',
      timestamp: new Date().toISOString()
    };
  }
}

export async function validateSampleUBL(): Promise<UblValidationSnapshot> {
  try {
    const items = [
      { description: 'Health Check Item', quantity: 1, unitPrice: 10000 }
    ];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vat = +(subtotal * 0.075).toFixed(2);
    const total = +(subtotal + vat).toFixed(2);

    const invoice: InvoiceData = {
      id: 'HEALTH-CHECK',
      issueDate: new Date().toISOString().split('T')[0],
      supplierTIN: '1234567890',
      supplierName: 'Health Check Supplier',
      customerName: 'Health Check Buyer',
      items,
      subtotal,
      vat,
      total
    };

    const xml = generateUBL(invoice);
    const analysis = analyzeMandatoryFields(xml);
    const xsdPath = process.env.UBL_XSD_PATH || path.join(process.cwd(), 'lib', 'ubl-invoice-2.1.xsd');
    const validation = validateUblXml(xml, xsdPath);

    const valid = validation.ok && analysis.missingFields.length === 0;
    metrics.recordUBLValidation({ valid, missingCount: analysis.missingFields.length });

    if (!valid && initialized) {
      Sentry.captureMessage('UBL validation health check failed', 'warning');
    }

    return {
      status: valid ? 'valid' : 'invalid',
      missingFields: analysis.missingFields,
      xsdValid: Boolean(validation.ok),
      timestamp: new Date().toISOString(),
      error: validation.error
    };
  } catch (error: any) {
    metrics.recordUBLValidation({ valid: false, missingCount: 55 });
    if (initialized) {
      Sentry.captureException(error);
    }

    return {
      status: 'error',
      missingFields: [],
      xsdValid: false,
      timestamp: new Date().toISOString(),
      error: error?.message || 'UBL validation failed'
    };
  }
}

export function isSentryEnabled(): boolean {
  return initialized;
}
