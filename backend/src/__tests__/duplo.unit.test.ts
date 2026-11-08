import axios from 'axios';
import { DuploClient } from '../integrations/duplo';
import { FlutterwaveAdapter } from '../integrations/flutterwave/adapter';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Duplo and Provider Configuration Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.DUPLO_API_URL;
    delete process.env.DIGITAX_API_URL;
    delete process.env.DUPLO_CLIENT_ID;
    delete process.env.DUPLO_CLIENT_SECRET;
    delete process.env.DIGITAX_MOCK_MODE;
    delete process.env.NRS_MOCK_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Duplo URL Configuration Reconciliation', () => {
    it('consumes process.env.DUPLO_API_URL when set', () => {
      process.env.DUPLO_API_URL = 'https://custom-duplo.example.com';
      const client = new DuploClient();
      expect(client.getBaseURL()).toBe('https://custom-duplo.example.com');
    });

    it('falls back to process.env.DIGITAX_API_URL when DUPLO_API_URL is unset', () => {
      process.env.DIGITAX_API_URL = 'https://api.digitax.ng';
      const client = new DuploClient();
      expect(client.getBaseURL()).toBe('https://api.digitax.ng');
    });

    it('strips trailing slashes from configured provider URL', () => {
      process.env.DUPLO_API_URL = 'https://api.duplo.co/';
      const client = new DuploClient();
      expect(client.getBaseURL()).toBe('https://api.duplo.co');
    });
  });

  describe('Duplo Provider Health Check States', () => {
    it('returns unconfigured status when credentials are missing and not in mock mode', async () => {
      const client = new DuploClient();
      const health = await client.checkHealth();
      expect(health.status).toBe('unconfigured');
      expect(health.latency).toBeNull();
    });

    it('returns mock status when NRS_MOCK_MODE is enabled', async () => {
      process.env.NRS_MOCK_MODE = 'true';
      process.env.DUPLO_CLIENT_ID = 'id';
      process.env.DUPLO_CLIENT_SECRET = 'sec';
      const client = new DuploClient();
      const health = await client.checkHealth();
      expect(health.status).toBe('mock');
      expect(health.latency).toBeNull();
    });

    it('returns mock status when DIGITAX_MOCK_MODE is enabled', async () => {
      process.env.DIGITAX_MOCK_MODE = 'true';
      const client = new DuploClient();
      const health = await client.checkHealth();
      expect(health.status).toBe('mock');
      expect(health.latency).toBeNull();
    });
  });

  describe('Flutterwave Adapter Base URL and Webhook Signature', () => {
    it('normalizes base URL to strip trailing slash and double /v3', () => {
      const adapter1 = new FlutterwaveAdapter({
        publicKey: 'pub',
        secretKey: 'sec',
        secretHash: 'hash123',
        baseUrl: 'https://api.flutterwave.com/v3/',
      });
      // Test webhook signature verification with constant-time comparison
      expect(adapter1.verifyWebhookSignature('hash123')).toBe(true);
      expect(adapter1.verifyWebhookSignature('wronghash')).toBe(false);
      expect(adapter1.verifyWebhookSignature('')).toBe(false);
    });
  });
});
