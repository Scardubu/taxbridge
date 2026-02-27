# TaxBridge Complete Setup & Implementation Guide

## 📋 Prerequisites Checklist

Before starting, ensure you have:

### Development Environment
- [ ] **Node.js 18 LTS** or higher installed ([Download](https://nodejs.org/))
- [ ] **npm 9+** or **pnpm 8+** package manager
- [ ] **Git** version control ([Download](https://git-scm.com/))
- [ ] **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- [ ] **PostgreSQL 15** (or use Docker)
- [ ] **Redis 7** (or use Docker)
- [ ] **VS Code** or preferred IDE with extensions:
  - ESLint
  - Prettier
  - Prisma
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense

### Required Accounts & API Keys
- [ ] **GitHub Account** (for repository access)
- [ ] **Paystack Account** → Get keys from [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer)
- [ ] **Remita Developer Account** → Register at [Remita](https://remita.net/)
- [ ] **DigiTax API Access** → Contact DigiTax for credentials
- [ ] **FIRS API Access** → Apply at FIRS developer portal
- [ ] **Sentry Account** (optional, for error tracking)

### Mobile Development (Optional)
- [ ] **Expo CLI** installed globally: `npm install -g expo-cli`
- [ ] **Android Studio** (for Android emulator) or **Xcode** (for iOS simulator on Mac)
- [ ] **Expo Go App** on physical device for testing

---

## 🚀 Initial Repository Setup

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Verify structure
ls -la
# Expected: backend/, mobile/, admin-dashboard/, shared/, docs/, etc.

# Check current branch
git branch -a

# Create development branch
git checkout -b development
```

### Step 2: Install Global Dependencies

```bash
# Install Turbo (monorepo orchestrator)
npm install -g turbo

# Install Prisma CLI globally (optional but recommended)
npm install -g prisma

# Verify installations
turbo --version
node --version
npm --version
```

### Step 3: Install All Dependencies

```bash
# From root directory, install all workspace dependencies
npm install

# This installs dependencies for:
# - Root workspace
# - backend/
# - mobile/
# - admin-dashboard/
# - shared/

# Verify no errors
# Expected output: "added XXX packages" with no errors
```

### Step 4: Environment Configuration

#### Root Environment File
Create `.env` in root directory:

```bash
# .env (root)
NODE_ENV=development

# Database
DATABASE_URL=postgresql://taxbridge_user:secure_password@localhost:5432/taxbridge_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
API_PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

#### Backend Environment File
Create `backend/.env`:

```bash
# backend/.env

# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://taxbridge_user:secure_password@localhost:5432/taxbridge_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-change-in-production
JWT_EXPIRES_IN=7d

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Paystack
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret

# Remita
REMITA_API_KEY=your_remita_api_key
REMITA_MERCHANT_ID=your_merchant_id
REMITA_SERVICE_TYPE_ID=your_service_type_id

# Flutterwave (optional)
FLW_PUBLIC_KEY=FLWPUBK_TEST-your_key
FLW_SECRET_KEY=FLWSECK_TEST-your_secret
FLW_ENCRYPTION_KEY=FLWSECK_TEST-your_encryption_key
FLW_WEBHOOK_SECRET=your_webhook_secret

# DigiTax
DIGITAX_API_KEY=your_digitax_api_key
DIGITAX_BASE_URL=https://api.digitax.ng

# FIRS
FIRS_API_KEY=your_firs_api_key
FIRS_TIN=your_company_tin
FIRS_BASE_URL=https://api.firs.gov.ng

# Youverify (optional)
YOUVERIFY_API_KEY=your_youverify_key
YOUVERIFY_SANDBOX=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring (optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Email (future feature)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

#### Mobile Environment File
Create `mobile/.env`:

```bash
# mobile/.env

# API Endpoints
API_URL=http://localhost:3000/api/v1
API_TIMEOUT=30000

# Paystack
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# Feature Flags
ENABLE_OCR=true
ENABLE_BIOMETRIC_AUTH=true
ENABLE_CRYPTO_TAX=true

# Analytics (optional)
ENABLE_ANALYTICS=false
```

#### Admin Dashboard Environment File
Create `admin-dashboard/.env.local`:

```bash
# admin-dashboard/.env.local

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Paystack
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# Application
NEXT_PUBLIC_APP_NAME=TaxBridge
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Feature Flags
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_OFFLINE_MODE=false
```

**Security Note**: 
```bash
# NEVER commit real credentials to Git
# Add .env files to .gitignore (should already be there)

# Verify .env files are ignored
cat .gitignore | grep .env

# Expected output:
# .env
# .env.local
# .env*.local
```

---

## 🗄️ Database Setup

### Option 1: Local PostgreSQL Installation

#### Install PostgreSQL (Ubuntu/Debian)
```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

#### Install PostgreSQL (macOS)
```bash
# Using Homebrew
brew install postgresql@15

# Start service
brew services start postgresql@15

# Verify
psql --version
```

#### Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Inside PostgreSQL shell:
CREATE DATABASE taxbridge_dev;
CREATE USER taxbridge_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE taxbridge_dev TO taxbridge_user;

# Grant schema privileges
\c taxbridge_dev
GRANT ALL ON SCHEMA public TO taxbridge_user;

# Exit
\q
```

#### Test Connection
```bash
# Test database connection
psql -h localhost -U taxbridge_user -d taxbridge_dev

# If successful, you'll see:
# taxbridge_dev=>

# Exit
\q
```

### Option 2: Docker PostgreSQL & Redis (Recommended)

Create `docker-compose.dev.yml` in root:

```yaml
# docker-compose.dev.yml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: taxbridge-postgres-dev
    environment:
      POSTGRES_DB: taxbridge_dev
      POSTGRES_USER: taxbridge_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taxbridge_user -d taxbridge_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - taxbridge-dev

  redis:
    image: redis:7-alpine
    container_name: taxbridge-redis-dev
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - taxbridge-dev

  # Optional: Database Admin UI
  pgadmin:
    image: dpage/pgadmin4
    container_name: taxbridge-pgadmin-dev
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@taxbridge.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - taxbridge-dev

  # Optional: Redis Admin UI
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: taxbridge-redis-commander-dev
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    networks:
      - taxbridge-dev

volumes:
  postgres_dev_data:
  redis_dev_data:

networks:
  taxbridge-dev:
    driver: bridge
```

#### Start Services
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Check status
docker-compose -f docker-compose.dev.yml ps

# Expected output:
# NAME                        STATUS
# taxbridge-postgres-dev      Up (healthy)
# taxbridge-redis-dev         Up (healthy)
# taxbridge-pgadmin-dev       Up
# taxbridge-redis-commander   Up

# View logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.dev.yml down -v
```

#### Access Admin UIs
- **pgAdmin**: http://localhost:5050
  - Email: `admin@taxbridge.local`
  - Password: `admin`
  - Add server: Host=`postgres`, Port=`5432`, Username=`taxbridge_user`, Password=`secure_password`

- **Redis Commander**: http://localhost:8081

### Step 5: Initialize Database Schema

```bash
# Navigate to backend
cd backend

# Generate Prisma Client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init

# Expected output:
# ✔ Generated Prisma Client
# ✔ Applied 1 migration

# Verify schema
npx prisma studio
# Opens browser at http://localhost:5555
# You should see all tables: Business, Invoice, Payment, etc.

# Seed database with test data (optional)
npx prisma db seed
```

#### Create Database Seed File
Create `backend/prisma/seed.ts`:

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test business
  const testBusiness = await prisma.business.upsert({
    where: { tin: '12345678-0001' },
    update: {},
    create: {
      name: 'TechVentures Nigeria Ltd',
      cacNumber: 'RC123456',
      tin: '12345678-0001',
      email: 'admin@techventures.ng',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    },
  });

  console.log('✅ Created test business:', testBusiness.name);

  // Create test user
  const passwordHash = await bcrypt.hash('Password123!', 12);
  
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@techventures.ng' },
    update: {},
    create: {
      email: 'admin@techventures.ng',
      passwordHash,
      name: 'John Doe',
      role: 'ADMIN',
      businessId: testBusiness.id,
    },
  });

  console.log('✅ Created test user:', testUser.email);

  // Create sample invoices
  const invoices = [];
  for (let i = 1; i <= 5; i++) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(i).padStart(5, '0')}`,
        businessId: testBusiness.id,
        amount: 100000 * i,
        taxAmount: 7500 * i,
        total: 107500 * i,
        status: i <= 3 ? 'PAID' : 'PENDING',
        items: JSON.stringify([
          {
            description: `Consulting Services - Package ${i}`,
            quantity: 1,
            unitPrice: 100000 * i,
            amount: 100000 * i,
            vatApplicable: true,
            vatAmount: 7500 * i,
          },
        ]),
        paidAt: i <= 3 ? new Date() : null,
        createdAt: new Date(2026, 0, i * 5), // Spread across January
      },
    });
    invoices.push(invoice);
  }

  console.log(`✅ Created ${invoices.length} sample invoices`);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Update `backend/package.json`:

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Install ts-node:
```bash
npm install -D ts-node

# Run seed
npx prisma db seed
```

---

## 🔧 Backend Setup & Development

### Step 1: Verify Backend Structure

```bash
cd backend

# Check TypeScript configuration
cat tsconfig.json

# Check package.json scripts
cat package.json | grep scripts -A 20

# Expected scripts:
# "dev": "nodemon src/server.ts"
# "build": "tsc"
# "start": "node dist/server.js"
# "test": "jest"
# "typecheck": "tsc --noEmit"
```

### Step 2: Create Server Entry Point

Create `backend/src/server.ts`:

```typescript
// backend/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/environment';
import { errorHandler } from './middleware/error.middleware';
import { auditLog } from './middleware/audit.middleware';
import { initDatabase } from './config/database';
import { initializeCronJobs } from './config/cron';
import { logger, logInfo, logError } from './utils/logger';

// Import routes
import { healthRoutes } from './routes/health.routes';
import { authRoutes } from './routes/auth.routes';
import { businessRoutes } from './routes/business.routes';
import { invoiceRoutes } from './routes/invoice.routes';
import { paymentRoutes } from './routes/payment.routes';
import { taxRoutes } from './routes/tax.routes';
import { expenseRoutes } from './routes/expense.routes';
import { webhookRoutes } from './routes/webhook.routes';

async function start() {
  const fastify = Fastify({
    logger: config.app.isDevelopment ? true : false,
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  try {
    // Register plugins
    await fastify.register(cors, {
      origin: config.app.isDevelopment
        ? ['http://localhost:3001', 'http://localhost:19006'] // Admin + Mobile
        : [process.env.FRONTEND_URL || ''],
      credentials: true,
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: config.app.isProduction,
    });

    await fastify.register(rateLimit, {
      max: config.rateLimit.maxRequests,
      timeWindow: config.rateLimit.windowMs,
      redis: config.redis,
    });

    // Global error handler
    fastify.setErrorHandler(errorHandler);

    // Register routes
    await fastify.register(healthRoutes, { prefix: '/health' });
    await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
    await fastify.register(businessRoutes, { prefix: '/api/v1/businesses' });
    await fastify.register(invoiceRoutes, { prefix: '/api/v1/invoices' });
    await fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });
    await fastify.register(taxRoutes, { prefix: '/api/v1/tax' });
    await fastify.register(expenseRoutes, { prefix: '/api/v1/expenses' });
    await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

    // Initialize database
    await initDatabase();

    // Initialize cron jobs
    if (config.app.isProduction) {
      initializeCronJobs();
    }

    // Start server
    await fastify.listen({
      port: config.app.port,
      host: '0.0.0.0',
    });

    logInfo('Server started', {
      port: config.app.port,
      environment: config.app.env,
      version: config.app.apiVersion,
    });

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logInfo('Shutting down gracefully...');
        await fastify.close();
        process.exit(0);
      });
    });
  } catch (error) {
    logError('Server startup failed', error as Error);
    process.exit(1);
  }
}

start();
```

### Step 3: Create Essential Configuration Files

#### Database Configuration
Create `backend/src/config/database.ts`:

```typescript
// backend/src/config/database.ts
import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '@/utils/logger';

export const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Query logging in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logInfo('Database Query', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Error logging
prisma.$on('error', (e: any) => {
  logError('Database Error', new Error(e.message));
});

export async function initDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logInfo('Database connected successfully');

    // Test query
    await prisma.$queryRaw`SELECT 1`;
    logInfo('Database health check passed');
  } catch (error) {
    logError('Database connection failed', error as Error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
  logInfo('Database disconnected');
}
```

#### Queue Configuration
Create `backend/src/config/queues.ts`:

```typescript
// backend/src/config/queues.ts
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { config } from './environment';
import { logInfo, logError } from '@/utils/logger';

const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

// FIRS Submission Queue
export const firsSubmissionQueue = new Queue('firs-submission', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// FIRS Submission Worker
const firsWorker = new Worker(
  'firs-submission',
  async (job) => {
    logInfo('Processing FIRS submission', { invoiceId: job.data.invoiceId });
    
    const { FIRSService } = await import('@/integrations/firs/firs.service');
    const { InvoiceService } = await import('@/modules/invoice/invoice.service');
    
    const firsService = new FIRSService();
    const invoiceService = new InvoiceService();
    
    const invoice = await invoiceService.getInvoiceById(job.data.invoiceId);
    const result = await firsService.submitInvoice(invoice);
    
    if (!result.success) {
      throw new Error(`FIRS submission failed: ${result.message}`);
    }
    
    return result;
  },
  { connection }
);

firsWorker.on('completed', (job) => {
  logInfo('FIRS submission completed', { jobId: job.id });
});

firsWorker.on('failed', (job, err) => {
  logError('FIRS submission failed', err, { jobId: job?.id });
});

// Email Queue (future feature)
export const emailQueue = new Queue('email', { connection });

// Payment Reconciliation Queue
export const reconciliationQueue = new Queue('reconciliation', { connection });

logInfo('Background job queues initialized');
```

### Step 4: Create Health Check Routes

Create `backend/src/routes/health.routes.ts`:

```typescript
// backend/src/routes/health.routes.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/config/database';
import Redis from 'ioredis';
import { config } from '@/config/environment';

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness check (includes dependencies)
  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    const checks = {
      database: false,
      redis: false,
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      // Database not ready
    }

    // Check Redis
    try {
      const redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      checks.redis = true;
      await redis.quit();
    } catch (error) {
      // Redis not ready
    }

    const isReady = checks.database && checks.redis;

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // Metrics endpoint (Prometheus format)
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = {
      process_uptime_seconds: process.uptime(),
      process_memory_bytes: process.memoryUsage(),
      nodejs_version: process.version,
    };

    return reply.send(metrics);
  });
}
```

### Step 5: Start Backend Server

```bash
# From backend directory
cd backend

# Install nodemon for development
npm install -D nodemon

# Create nodemon config
cat > nodemon.json << 'EOF'
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "ts-node -r tsconfig-paths/register src/server.ts"
}
EOF

# Start development server
npm run dev

# Expected output:
# [INFO] Database connected successfully
# [INFO] Database health check passed
# [INFO] Background job queues initialized
# [INFO] Server started on port 3000
```

#### Test API Endpoints

```bash
# Open new terminal

# Test health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-06T...","uptime":5.123}

# Test readiness endpoint
curl http://localhost:3000/health/ready

# Expected response:
# {"status":"ready","checks":{"database":true,"redis":true},"timestamp":"..."}
```

---

## 📱 Mobile App Setup

### Step 1: Initialize Expo Project

```bash
cd mobile

# If mobile directory doesn't exist, create it
npx create-expo-app@latest . --template blank-typescript

# Install dependencies
npm install

# Install navigation
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs

# Install Expo dependencies
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated

# Install SQLite
npx expo install expo-sqlite

# Install other essential packages
npm install axios @tanstack/react-query date-fns
npm install react-hook-form zod @hookform/resolvers

# Install OCR (Tesseract)
npm install tesseract.js

# Install image tools
npx expo install expo-image-picker expo-image-manipulator expo-camera

# Install file system
npx expo install expo-file-system expo-sharing

# Install network info
npm install @react-native-community/netinfo

# Development dependencies
npm install -D @testing-library/react-native @testing-library/jest-native jest-expo
```

### Step 2: Configure Expo App

Update `mobile/app.json`:

```json
{
  "expo": {
    "name": "TaxBridge",
    "slug": "taxbridge",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#008751"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "ng.taxbridge.app",
      "infoPlist": {
        "NSCameraUsageDescription": "TaxBridge needs camera access to scan receipts",
        "NSPhotoLibraryUsageDescription": "TaxBridge needs photo library access to import receipts"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#008751"
      },
      "package": "ng.taxbridge.app",
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-sqlite",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow TaxBridge to scan receipts"
        }
      ]
    ]
  }
}
```

### Step 3: Setup Project Structure

```bash
# Create directory structure
mkdir -p src/{navigation,screens,components,contexts,services,utils,tax}
mkdir -p src/screens/{auth,dashboard,tax,invoices,expenses,payments,reports}
mkdir -p src/components/{shared,forms,charts}
mkdir -p src/services/{api,sqlite,ocr,notifications}

# Create placeholder files
touch src/navigation/AppNavigator.tsx
touch src/contexts/AuthContext.tsx
touch src/contexts/SyncContext.tsx
touch src/services/sqlite/database.ts
touch src/utils/logger.ts
```

### Step 4: Initialize SQLite Database

Create `mobile/src/services/sqlite/database.ts` (use code from earlier in prompt).

### Step 5: Create API Client

Create `mobile/src/services/api/client.ts`:

```typescript
// mobile/src/services/api/client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

class APIClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL || 'http://localhost:3000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.loadToken();
  }

  private async loadToken() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        this.accessToken = token;
      }
    } catch (error) {
      console.error('Failed to load token:', error);
    }
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired, try refresh
          try {
            await this.refreshToken();
            // Retry original request
            return this.client.request(error.config!);
          } catch (refreshError) {
            // Refresh failed, logout user
            await this.logout();
            throw refreshError;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async setToken(token: string) {
    this.accessToken = token;
    await AsyncStorage.setItem('access_token', token);
  }

  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const { data } = await this.client.post('/auth/refresh', {
      refreshToken,
    });

    await this.setToken(data.accessToken);
  }

  async logout() {
    this.accessToken = null;
    await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
  }

  // API Methods
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', {
      email,
      password,
    });
    
    await this.setToken(data.accessToken);
    await AsyncStorage.setItem('refresh_token', data.refreshToken);
    
    return data;
  }

  async getInvoices() {
    const { data } = await this.client.get('/invoices');
    return data.data;
  }

  async createInvoice(invoiceData: any) {
    const { data } = await this.client.post('/invoices', invoiceData);
    return data.data;
  }

  async calculatePAYE(input: any) {
    const { data } = await this.client.post('/tax/paye/calculate', input);
    return data.data;
  }
}

export const api = new APIClient();
```

### Step 6: Start Mobile App

```bash
# From mobile directory
cd mobile

# Install Expo Go on your phone (iOS/Android)

# Start development server
npx expo start

# Options:
# Press 'i' for iOS simulator
# Press 'a' for Android emulator
# Scan QR code with Expo Go app on physical device

# For web (testing only)
# Press 'w' for web browser
```

---

## 🖥️ Admin Dashboard Setup

### Step 1: Initialize Next.js Project

```bash
cd admin-dashboard

# If directory doesn't exist, create Next.js app
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"

# Install dependencies
npm install

# Install shadcn/ui
npx shadcn-ui@latest init

# When prompted:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Install essential components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add form
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
npx shadcn-ui@latest add calendar

# Install additional packages
npm install axios @tanstack/react-query
npm install react-hook-form zod @hookform/resolvers
npm install date-fns recharts
npm install next-themes
```

### Step 2: Configure Tailwind CSS

Update `admin-dashboard/tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f7ed',
          100: '#b3e6cb',
          200: '#80d4a9',
          300: '#4dc387',
          400: '#26b76f',
          500: '#008751',
          600: '#00764a',
          700: '#006440',
          800: '#005136',
          900: '#003d28',
        },
        // Add other custom colors
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

### Step 3: Create App Layout

Create `admin-dashboard/src/app/layout.tsx`:

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TaxBridge - Nigerian Tax Compliance Platform',
  description: 'Intelligent tax calculation, filing, and payment for Nigerian businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

Create providers:

```typescript
// src/components/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### Step 4: Start Admin Dashboard

```bash
# From admin-dashboard directory
cd admin-dashboard

# Start development server
npm run dev

# Open browser at http://localhost:3001
```

---

## ✅ Verification Checklist

### Backend Verification

```bash
cd backend

# 1. Type check
npm run typecheck
# Expected: No errors

# 2. Lint
npm run lint
# Expected: No errors

# 3. Run tests
npm test
# Expected: All tests pass

# 4. Check API health
curl http://localhost:3000/health
# Expected: {"status":"ok",...}

# 5. Check database connection
curl http://localhost:3000/health/ready
# Expected: {"status":"ready","checks":{"database":true,"redis":true}}

# 6. Test auth endpoint
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techventures.ng","password":"Password123!"}'
# Expected: {"success":true,"data":{"accessToken":"...","user":{...}}}
```

### Mobile Verification

```bash
cd mobile

# 1. Type check
npx tsc --noEmit
# Expected: No errors

# 2. Run tests
npm test
# Expected: All tests pass

# 3. Check app runs
npx expo start
# Scan QR code and verify app opens
```

### Admin Dashboard Verification

```bash
cd admin-dashboard

# 1. Type check
npx tsc --noEmit
# Expected: No errors

# 2. Build check
npm run build
# Expected: Build successful

# 3. Open in browser
npm run dev
# Navigate to http://localhost:3001
# Expected: Homepage loads
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Database Connection Failed

**Error**: `Can't reach database server at localhost:5432`

**Solutions**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or with Docker:
docker-compose -f docker-compose.dev.yml ps

# Start PostgreSQL
sudo systemctl start postgresql

# Or with Docker:
docker-compose -f docker-compose.dev.yml up -d postgres

# Test connection
psql -h localhost -U taxbridge_user -d taxbridge_dev
```

### Issue 2: Redis Connection Refused

**Error**: `Error connecting to Redis on localhost:6379`

**Solutions**:
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
sudo systemctl start redis

# Or with Docker:
docker-compose -f docker-compose.dev.yml up -d redis

# Test connection
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

### Issue 3: Prisma Migration Fails

**Error**: `Migration failed to apply cleanly`

**Solutions**:
```bash
# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or create new migration
npx prisma migrate dev --name fix_schema

# If stuck, manually drop database and recreate
dropdb -U postgres taxbridge_dev
createdb -U postgres taxbridge_dev -O taxbridge_user
npx prisma migrate deploy
```

### Issue 4: TypeScript Errors in Mobile

**Error**: `Cannot find module '@env'`

**Solution**:
```bash
# Install react-native-dotenv
npm install react-native-dotenv

# Create babel.config.js
cat > babel.config.js << 'EOF'
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
      }],
      'react-native-reanimated/plugin',
    ],
  };
};
EOF

# Create types for @env
mkdir -p src/types
cat > src/types/env.d.ts << 'EOF'
declare module '@env' {
  export const API_URL: string;
  export const PAYSTACK_PUBLIC_KEY: string;
}
EOF
```

### Issue 5: Port Already in Use

**Error**: `Port 3000 is already in use`

**Solutions**:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
# PORT=3001
```

---

## 📦 Next Steps After Setup

### 1. Implement Authentication Flow

```bash
# Create auth service
cd backend/src/modules/auth

# Follow the auth implementation in the main prompt
```

### 2. Create First Invoice

```bash
# Use Prisma Studio or API
npx prisma studio

# Or via API:
curl -X POST http://localhost:3000/api/v1/invoices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "...",
    "items": [
      {
        "description": "Consulting Services",
        "quantity": 1,
        "unitPrice": 100000,
        "vatApplicable": true
      }
    ]
  }'
```

### 3. Test Payment Flow

```bash
# Initialize Paystack payment
curl -X POST http://localhost:3000/api/v1/payments/paystack/initialize \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId": "...",
    "email": "test@example.com",
    "amount": 107500
  }'
```

### 4. Run Tax Calculations

```bash
# Calculate PAYE
curl -X POST http://localhost:3000/api/v1/tax/paye/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "grossSalary": 5000000
  }'
```

---

## 🎉 You're Ready!

Your TaxBridge development environment is now fully configured. You can:

1. ✅ Develop backend APIs
2. ✅ Build mobile app features
3. ✅ Create admin dashboard interfaces
4. ✅ Test integrations (Paystack, FIRS, DigiTax)
5. ✅ Run comprehensive tests
6. ✅ Deploy to production (using Docker guide)

**Next**: Start implementing features from Phase 1 of the implementation roadmap!