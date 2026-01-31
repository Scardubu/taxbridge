# TaxBridge Performance & Maintainability Optimizations

## Overview

This document outlines recommended optimizations for TaxBridge to improve performance, maintainability, and scalability beyond MVP launch.

---

## 🚀 Performance Optimizations

### Backend API Optimizations

#### 1. Database Query Optimization

**Current State**: Prisma ORM with basic queries
**Recommended Improvements**:

```typescript
// Before: N+1 query problem
const invoices = await prisma.invoice.findMany();
for (const invoice of invoices) {
  const payment = await prisma.payment.findFirst({ where: { invoiceId: invoice.id } });
}

// After: Use include to fetch related data
const invoices = await prisma.invoice.findMany({
  include: {
    payments: true,
    syncQueue: true
  }
});

// Add database indexes for frequently queried fields
// In prisma/schema.prisma
model Invoice {
  @@index([status])
  @@index([userId])
  @@index([createdAt])
  @@index([supplierTIN])
}
```

**Impact**: 60-80% reduction in query time for list operations

#### 2. Caching Strategy

**Implement Redis caching for**:

```typescript
// Cache UBL templates
const getCachedUBL = async (invoiceId: string) => {
  const cached = await redis.get(`ubl:${invoiceId}`);
  if (cached) return JSON.parse(cached);
  
  const ubl = generateUBL(invoice);
  await redis.setex(`ubl:${invoiceId}`, 3600, JSON.stringify(ubl));
  return ubl;
};

// Cache Duplo OAuth tokens
const getCachedToken = async () => {
  const cached = await redis.get('duplo:token');
  if (cached) return cached;
  
  const token = await duploAdapter.authenticate();
  await redis.setex('duplo:token', 3300, token); // 55 min TTL
  return token;
};

// Cache payment status checks
const getCachedPaymentStatus = async (invoiceId: string) => {
  const cached = await redis.get(`payment:${invoiceId}`);
  if (cached) return JSON.parse(cached);
  
  const status = await remitaAdapter.verifyPayment(rrr, orderId);
  await redis.setex(`payment:${invoiceId}`, 300, JSON.stringify(status)); // 5 min TTL
  return status;
};
```

**Impact**: 50-70% reduction in API response time for repeated requests

#### 3. Queue Processing Optimization

**Current State**: Single queue worker
**Recommended Improvements**:

```typescript
// Implement priority queues
const highPriorityQueue = new Queue('high-priority', { redis });
const normalPriorityQueue = new Queue('normal-priority', { redis });
const lowPriorityQueue = new Queue('low-priority', { redis });

// Priority assignment
const prioritize = (invoice: Invoice) => {
  if (invoice.total > 1000000) return 'high'; // >1M Naira
  if (invoice.status === 'pending') return 'normal';
  return 'low';
};

// Batch processing for efficiency
const processBatch = async (jobs: Job[]) => {
  const invoices = jobs.map(j => j.data);
  
  // Generate UBL for all invoices in parallel
  const ubls = await Promise.all(
    invoices.map(inv => generateUBL(inv))
  );
  
  // Submit to Duplo in batch (if supported)
  const results = await duploAdapter.submitBatch(ubls);
  
  return results;
};
```

**Impact**: 3-5x throughput improvement for invoice processing

#### 4. Connection Pooling

**Configure optimal pool sizes**:

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Optimize connection pool
  connection_limit = 20
  pool_timeout = 10
  statement_cache_size = 100
}

// Redis connection pooling
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  keepAlive: 30000,
  // Connection pool
  connectionPoolSize: 10
});
```

**Impact**: Better resource utilization, fewer connection errors

#### 5. Response Compression

```typescript
// Enable compression in Fastify
import fastifyCompress from '@fastify/compress';

await app.register(fastifyCompress, {
  global: true,
  threshold: 1024, // Compress responses > 1KB
  encodings: ['gzip', 'deflate']
});
```

**Impact**: 60-80% bandwidth reduction for JSON responses

### Mobile App Optimizations

#### 1. Image Optimization

```typescript
// Optimize OCR image before upload
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const optimizeImage = async (uri: string) => {
  return await manipulateAsync(
    uri,
    [
      { resize: { width: 1200 } }, // Max width 1200px
      { rotate: 0 } // Normalize orientation
    ],
    {
      compress: 0.8,
      format: SaveFormat.JPEG,
      base64: true
    }
  );
};
```

**Impact**: 70-80% reduction in image upload size

#### 2. List Virtualization

```typescript
// Use FlatList with optimizations for invoice list
import { FlatList } from 'react-native';

<FlatList
  data={invoices}
  renderItem={({ item }) => <InvoiceCard invoice={item} />}
  keyExtractor={item => item.id}
  
  // Performance optimizations
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
  removeClippedSubviews={true}
  
  // Memoize item rendering
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index
  })}
/>
```

**Impact**: Smooth scrolling even with 1000+ invoices

#### 3. Database Query Optimization

```typescript
// Use indexes for faster queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_invoices_synced ON invoices(synced);
`);

// Paginate large result sets
const getPaginatedInvoices = async (page = 0, limit = 20) => {
  const offset = page * limit;
  const result = await db.getAllAsync(
    'SELECT * FROM invoices ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  return result;
};
```

**Impact**: 80-90% faster query times for large datasets

#### 4. Offline Sync Optimization

```typescript
// Implement differential sync
const syncPendingInvoices = async () => {
  // Only sync changed invoices
  const pending = await db.getAllAsync(
    'SELECT * FROM invoices WHERE synced = 0 OR updatedAt > lastSyncedAt'
  );
  
  // Batch sync in chunks of 10
  const chunks = chunkArray(pending, 10);
  for (const chunk of chunks) {
    await syncBatch(chunk);
  }
};

// Implement conflict resolution
const resolveConflict = (local: Invoice, remote: Invoice) => {
  // Server wins for status changes
  if (remote.status !== local.status) return remote;
  
  // Latest timestamp wins for other fields
  return remote.updatedAt > local.updatedAt ? remote : local;
};
```

**Impact**: 50-60% reduction in sync time and data transfer

---

## 🛠️ Code Maintainability Improvements

### 1. Error Handling Standardization

**Create centralized error handler**:

```typescript
// lib/errors.ts
export class TaxBridgeError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public retriable: boolean = false
  ) {
    super(message);
    this.name = 'TaxBridgeError';
  }
}

export class ValidationError extends TaxBridgeError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400, false);
  }
}

export class DuploError extends TaxBridgeError {
  constructor(message: string, retriable: boolean = true) {
    super('DUPLO_ERROR', message, 502, retriable);
  }
}

// Use in routes
app.post('/api/v1/invoices', async (req, reply) => {
  try {
    const result = await createInvoice(req.body);
    return result;
  } catch (error) {
    if (error instanceof TaxBridgeError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        retriable: error.retriable
      });
    }
    throw error;
  }
});
```

**Impact**: Consistent error handling, better debugging

### 2. Type Safety Improvements

**Add runtime validation with Zod**:

```typescript
// types/invoice.schema.ts
import { z } from 'zod';

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().positive().int(),
  unitPrice: z.number().positive().multipleOf(0.01)
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  issueDate: z.string().datetime(),
  supplierTIN: z.string().regex(/^\d{8}-\d{4}$/),
  supplierName: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200).optional(),
  items: z.array(InvoiceItemSchema).min(1).max(100),
  subtotal: z.number().positive(),
  vat: z.number().nonnegative(),
  total: z.number().positive()
});

// Use in API routes
app.post('/api/v1/invoices', async (req, reply) => {
  const parsed = InvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ 
      error: 'Validation failed', 
      details: parsed.error.flatten() 
    });
  }
  
  const invoice = parsed.data;
  // Process validated invoice
});
```

**Impact**: Catch validation errors early, prevent runtime errors

### 3. Logging Standardization

**Implement structured logging**:

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Use throughout application
logger.info({ invoiceId, status: 'created' }, 'Invoice created successfully');
logger.error({ error, invoiceId }, 'Failed to submit invoice to Duplo');
logger.warn({ queueSize }, 'Queue backlog growing');
```

**Impact**: Better observability, easier debugging

### 4. Configuration Management

**Centralize configuration**:

```typescript
// config/index.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.string().transform(Number).pipe(z.number().positive()),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // Duplo
  DUPLO_CLIENT_ID: z.string().min(1),
  DUPLO_CLIENT_SECRET: z.string().min(1),
  DUPLO_API_URL: z.string().url(),
  
  // Remita
  REMITA_MERCHANT_ID: z.string().min(1),
  REMITA_API_KEY: z.string().min(1),
  REMITA_SERVICE_TYPE_ID: z.string().min(1),
  REMITA_API_URL: z.string().url()
});

export const config = ConfigSchema.parse(process.env);
```

**Impact**: Type-safe configuration, catch missing env vars early

### 5. Testing Infrastructure Improvements

**Add contract testing**:

```typescript
// __tests__/contracts/duplo.contract.test.ts
import { Pact } from '@pact-foundation/pact';

describe('Duplo API Contract', () => {
  const provider = new Pact({
    consumer: 'TaxBridge',
    provider: 'Duplo',
    port: 8080
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  test('should submit invoice and receive IRN', async () => {
    await provider.addInteraction({
      state: 'invoice ready for submission',
      uponReceiving: 'a request to submit invoice',
      withRequest: {
        method: 'POST',
        path: '/v1/einvoice/submit',
        headers: { 'Content-Type': 'application/xml' }
      },
      willRespondWith: {
        status: 200,
        body: {
          nrsReference: Matchers.string('NRS-123'),
          irn: Matchers.string('IRN-456')
        }
      }
    });

    const result = await duploAdapter.submit(ublXml);
    expect(result.irn).toBeDefined();
  });
});
```

**Impact**: Catch API breaking changes early

---

## 📊 Monitoring & Observability Improvements

### 1. Custom Metrics

```typescript
// lib/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const invoiceCounter = new Counter({
  name: 'taxbridge_invoices_total',
  help: 'Total number of invoices created',
  labelNames: ['status']
});

export const duploLatency = new Histogram({
  name: 'taxbridge_duplo_latency_seconds',
  help: 'Duplo API request duration',
  buckets: [0.1, 0.5, 1, 2, 5]
});

export const remitaLatency = new Histogram({
  name: 'taxbridge_remita_latency_seconds',
  help: 'Remita API request duration',
  buckets: [0.1, 0.5, 1, 3, 5]
});

// Expose metrics endpoint
app.get('/metrics', async (req, reply) => {
  reply.type('text/plain');
  return register.metrics();
});
```

### 2. Distributed Tracing

```typescript
// Install OpenTelemetry
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyInstrumentation()
  ]
});

// Traces will show full request flow: API → Database → Duplo → Remita
```

### 3. Health Checks Enhancement

```typescript
// Enhanced health endpoint
app.get('/health', async (req, reply) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkDuplo(),
    checkRemita()
  ]);

  const status = checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded';
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
      redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
      duplo: checks[2].status === 'fulfilled' ? 'ok' : 'error',
      remita: checks[3].status === 'fulfilled' ? 'ok' : 'error'
    }
  };
});
```

---

## 🔒 Security Hardening

### 1. Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

await app.register(rateLimit, {
  max: 100, // Max 100 requests
  timeWindow: '1 minute',
  cache: 10000, // Cache 10K rate limit states
  allowList: ['127.0.0.1'], // Whitelist localhost
  redis // Store rate limits in Redis
});
```

### 2. Request Signing

```typescript
// Verify request signatures
const verifySignature = (req: FastifyRequest) => {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const body = JSON.stringify(req.body);
  
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(timestamp + body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
};
```

### 3. Input Sanitization

```typescript
import validator from 'validator';

const sanitizeInput = (input: string) => {
  return validator.escape(
    validator.trim(input)
  );
};

// Use before storing in database
const createInvoice = async (data: InvoiceInput) => {
  const sanitized = {
    ...data,
    customerName: sanitizeInput(data.customerName),
    supplierName: sanitizeInput(data.supplierName),
    items: data.items.map(item => ({
      ...item,
      description: sanitizeInput(item.description)
    }))
  };
  
  return prisma.invoice.create({ data: sanitized });
};
```

---

## 📱 Mobile Performance Improvements

### 1. Code Splitting

```typescript
// Lazy load screens
const HomeScreen = React.lazy(() => import('./screens/HomeScreen'));
const PaymentScreen = React.lazy(() => import('./screens/PaymentScreen'));

// Use Suspense for loading states
<Suspense fallback={<LoadingSpinner />}>
  <Stack.Screen name="Payment" component={PaymentScreen} />
</Suspense>
```

### 2. Image Caching

```typescript
// Use expo-image for better caching
import { Image } from 'expo-image';

<Image
  source={{ uri: qrCodeDataUrl }}
  style={styles.qrCode}
  cachePolicy="memory-disk" // Cache both in memory and disk
  transition={200}
/>
```

### 3. Memoization

```typescript
// Memoize expensive calculations
const calculateTotal = useMemo(() => {
  return items.reduce((sum, item) => 
    sum + (item.quantity * item.unitPrice), 0
  );
}, [items]);

// Memoize components
const InvoiceCard = React.memo(({ invoice }) => {
  return (
    <View>
      <Text>{invoice.id}</Text>
      <Text>{invoice.total}</Text>
    </View>
  );
});
```

---

## 🎯 Implementation Priority

### High Priority (Week 1-2)
1. ✅ Database query optimization with indexes
2. ✅ Redis caching for OAuth tokens
3. ✅ Connection pooling configuration
4. ✅ Response compression
5. ✅ Structured logging

### Medium Priority (Week 3-4)
1. Error handling standardization
2. Rate limiting
3. Custom metrics endpoint
4. Enhanced health checks
5. Mobile list virtualization

### Low Priority (Month 2+)
1. Distributed tracing
2. Contract testing
3. Code splitting
4. Advanced caching strategies
5. Image optimization

---

## 📈 Expected Impact

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Database indexes | 60-80% query time reduction | Low |
| Redis caching | 50-70% response time reduction | Medium |
| Connection pooling | 30-40% resource efficiency | Low |
| Response compression | 60-80% bandwidth reduction | Low |
| Queue batching | 3-5x throughput improvement | Medium |
| List virtualization | Smooth scrolling with 1000+ items | Medium |
| Image optimization | 70-80% upload size reduction | Low |
| Rate limiting | Prevent abuse, improve stability | Low |
| Structured logging | Faster debugging | Low |

**Total Expected Performance Improvement**: 50-70% overall

---

**TaxBridge Performance & Maintainability Optimizations v1.0.0**
**Status**: Ready for Implementation
**Last Updated**: January 10, 2026
