function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createRedisMock() {
  const store = new Map();
  const expirations = new Map();

  const isExpired = (key) => {
    const expiry = expirations.get(key);
    if (expiry && Date.now() > expiry) {
      store.delete(key);
      expirations.delete(key);
      return true;
    }
    return false;
  };

  const mock = {
    async setex(key, ttl, value) {
      store.set(key, value);
      expirations.set(key, Date.now() + ttl * 1000);
      return 'OK';
    },
    async get(key) {
      if (isExpired(key)) {
        return null;
      }
      return store.has(key) ? store.get(key) : null;
    },
    async del(...keys) {
      let removed = 0;
      keys.forEach((key) => {
        if (store.delete(key)) {
          removed += 1;
        }
        expirations.delete(key);
      });
      return removed;
    },
    async exists(key) {
      if (isExpired(key)) {
        return 0;
      }
      return store.has(key) ? 1 : 0;
    },
    async mget(...keys) {
      if (Array.isArray(keys[0])) {
        return Promise.all(keys[0].map((key) => mock.get(key)));
      }
      return Promise.all(keys.map((key) => mock.get(key)));
    },
    pipeline() {
      const commands = [];
      return {
        setex(key, ttl, value) {
          commands.push(() => mock.setex(key, ttl, value));
          return this;
        },
        exec() {
          return Promise.all(commands.map((command) => command())).then(() => []);
        }
      };
    },
    async keys(pattern) {
      const regex = new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`);
      return Array.from(store.keys()).filter((key) => regex.test(key));
    },
    async memory(command, key) {
      if (command === 'USAGE') {
        const value = store.get(key) || '';
        return Buffer.byteLength(value.toString(), 'utf8');
      }
      return 0;
    },
    async quit() {
      store.clear();
      expirations.clear();
    },
    __reset() {
      store.clear();
      expirations.clear();
    }
  };

  return mock;
}

function createQueueMock() {
  return {
    add: jest.fn(),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    getJobs: jest.fn()
  };
}

const redisMockInstance = createRedisMock();

jest.mock('./src/queue/client', () => {
  const queueFactory = () => createQueueMock();
  return {
    getRedisConnection: () => redisMockInstance,
    getInvoiceSyncQueue: queueFactory,
    getPaymentQueue: queueFactory,
    closeInvoiceSyncQueue: jest.fn(),
    closePaymentQueue: jest.fn(),
    closeRedisConnection: jest.fn(async () => redisMockInstance.quit()),
    __redisMock: redisMockInstance
  };
});

// Mock Duplo responses
const mockDuploTokenResponse = {
  access_token: 'mock-access-token',
  token_type: 'Bearer',
  expires_in: 3600
};

const mockDuploHealthResponse = {
  status: 'ok',
  timestamp: '2026-01-15T10:00:00Z',
  version: '1.0.0'
};

const mockDuploSubmitResponse = {
  irn: 'mock-irn-12345',
  status: 'success',
  qr_code: 'mock-qr-code-data',
  timestamp: '2026-01-15T10:00:00Z'
};

const mockDuploStatusResponse = {
  irn: 'mock-irn-12345',
  status: 'stamped',
  stamp_date: '2026-01-15T10:01:00Z'
};

// Mock Remita responses
const mockRemitaRRRResponse = {
  statuscode: '025',
  RRR: 'mock-rrr-123456789',
  order: {
    orderId: 'test-order-123',
    amount: '1000.00'
  }
};

const mockRemitaStatusResponse = {
  status: 'paid',
  RRR: 'mock-rrr-123456789',
  amount: '1000.00',
  transactionDate: '2026-01-15T10:05:00Z'
};

const mockRemitaInitResponse = {
  statuscode: '025',
  RRR: 'mock-rrr-123456789',
  status: 'success'
};

// Export mocks for use in tests
exports.mockDuploTokenResponse = mockDuploTokenResponse;
exports.mockDuploHealthResponse = mockDuploHealthResponse;
exports.mockDuploSubmitResponse = mockDuploSubmitResponse;
exports.mockDuploStatusResponse = mockDuploStatusResponse;
exports.mockRemitaRRRResponse = mockRemitaRRRResponse;
exports.mockRemitaStatusResponse = mockRemitaStatusResponse;
exports.mockRemitaInitResponse = mockRemitaInitResponse;

// Create mock invoice data helper
exports.createMockInvoiceData = (overrides = {}) => ({
  id: 'test-invoice-123',
  supplierName: 'Test Supplier Ltd',
  supplierTIN: '12345678-0001',
  customerName: 'Test Customer',
  customerTIN: '87654321-0001',
  items: [
    { description: 'Test Item', quantity: 1, unitPrice: 1000 }
  ],
  subtotal: 1000,
  vat: 75,
  total: 1075,
  ...overrides
});

// Create mock payment data helper
exports.createMockPaymentData = (overrides = {}) => ({
  invoiceId: 'test-invoice-123',
  payerName: 'Test Payer',
  payerEmail: 'payer@test.com',
  payerPhone: '08012345678',
  amount: 1075,
  ...overrides
});

// Mock axios at module level
jest.mock('axios', () => ({
  post: jest.fn((url, data, config) => {
    if (url && url.includes('/oauth2/token')) {
      return Promise.resolve({ data: mockDuploTokenResponse });
    }
    if (url && url.includes('/einvoice/submit')) {
      return Promise.resolve({ data: mockDuploSubmitResponse });
    }
    if (url && url.includes('/ecomm/init.reg')) {
      return Promise.resolve({ data: mockRemitaRRRResponse });
    }
    return Promise.resolve({ data: {} });
  }),
  get: jest.fn((url, config) => {
    if (url && url.includes('/health')) {
      return Promise.resolve({ data: mockDuploHealthResponse });
    }
    if (url && url.includes('/einvoice/status/')) {
      return Promise.resolve({ data: mockDuploStatusResponse });
    }
    if (url && url.includes('/ecomm/status.reg')) {
      return Promise.resolve({ data: mockRemitaStatusResponse });
    }
    return Promise.resolve({ data: {} });
  }),
  create: jest.fn(() => ({
    post: jest.fn(),
    get: jest.fn()
  })),
  default: {
    post: jest.fn(),
    get: jest.fn()
  }
}));

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
  if (typeof redisMockInstance.__reset === 'function') {
    redisMockInstance.__reset();
  }
});

// Mock environment variables
process.env.DUPLO_CLIENT_ID = 'test-client-id';
process.env.DUPLO_CLIENT_SECRET = 'test-client-secret';
process.env.DUPLO_API_URL = 'https://api-test.duplo.co';
process.env.REMITA_API_KEY = 'test-api-key';
process.env.REMITA_MERCHANT_ID = 'test-merchant-id';
