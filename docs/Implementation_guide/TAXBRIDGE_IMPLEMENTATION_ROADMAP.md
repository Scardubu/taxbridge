# 🗺️ TAXBRIDGE IMPLEMENTATION ROADMAP
## Direct File-Level Implementation Guide

This document provides specific, actionable steps mapped to the TaxBridge repository structure. Use this as your execution guide alongside the master prompt.

---

## 📋 DIRECTORY STRUCTURE OVERVIEW

Based on analysis of both documentation sources and standard monorepo patterns, here's the expected TaxBridge structure:

```
taxbridge/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-backend.yml
│       ├── deploy-admin.yml
│       └── test.yml
├── mobile/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── contexts/
│   │   │   └── SyncContext.tsx
│   │   ├── services/
│   │   │   ├── sqlite/
│   │   │   ├── api/
│   │   │   └── ocr/
│   │   ├── tax/
│   │   │   └── engine.ts
│   │   ├── utils/
│   │   └── types/
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── environment.ts
│   │   │   ├── database.ts
│   │   │   └── redis.ts
│   │   ├── integrations/
│   │   │   ├── paystack/
│   │   │   │   ├── paystack.service.ts
│   │   │   │   ├── paystack.types.ts
│   │   │   │   └── paystack.test.ts
│   │   │   ├── remita/
│   │   │   ├── digitax/
│   │   │   ├── firs/
│   │   │   ├── flutterwave/
│   │   │   └── youverify/
│   │   ├── modules/
│   │   │   ├── business/
│   │   │   │   ├── business.service.ts
│   │   │   │   ├── business.controller.ts
│   │   │   │   ├── business.routes.ts
│   │   │   │   └── business.test.ts
│   │   │   ├── invoice/
│   │   │   ├── payment/
│   │   │   ├── tax/
│   │   │   ├── expense/
│   │   │   └── payroll/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── ratelimit.middleware.ts
│   │   │   └── audit.middleware.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── encryption.ts
│   │   │   └── validators.ts
│   │   ├── jobs/
│   │   │   ├── sync.queue.ts
│   │   │   ├── compliance-alerts.ts
│   │   │   └── pdf-cleanup.ts
│   │   ├── webhooks/
│   │   │   ├── paystack.webhook.ts
│   │   │   ├── remita.webhook.ts
│   │   │   └── flutterwave.webhook.ts
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── templates/
│   │   ├── invoices/
│   │   │   ├── retail.hbs
│   │   │   ├── service.hbs
│   │   │   └── wholesale.hbs
│   │   └── emails/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── logs/
│   ├── uploads/
│   ├── package.json
│   └── tsconfig.json
├── admin-dashboard/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── lib/
│   │   └── styles/
│   ├── package.json
│   └── next.config.js
├── ml/
│   ├── models/
│   └── training/
├── shared/
│   ├── types/
│   ├── utils/
│   └── constants/
├── docs/
│   ├── api/
│   ├── architecture/
│   └── user-guides/
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.admin
│   │   └── Dockerfile.ml
│   ├── kubernetes/
│   └── terraform/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
├── turbo.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 🎯 PHASE 1: FOUNDATION & INFRASTRUCTURE

### 1.1 Initialize Project Structure

**If starting fresh:**
```bash
# In repository root
mkdir -p backend/src/{config,integrations/{paystack,remita,digitax,firs,flutterwave,youverify},modules/{business,invoice,payment,tax,expense,payroll},middleware,utils,jobs,webhooks,types}
mkdir -p backend/{prisma,tests/{unit,integration,e2e},templates/{invoices,emails},logs,uploads}
mkdir -p mobile/src/{components,screens,contexts,services/{sqlite,api,ocr},tax,utils,types}
mkdir -p admin-dashboard/src/{app,components/ui,lib,styles}
mkdir -p shared/{types,utils,constants}
mkdir -p docs/{api,architecture,user-guides}
mkdir -p infrastructure/{docker,kubernetes,terraform}
mkdir -p ml/{models,training}
```

**If repository exists:**
- Review existing structure
- Identify gaps in the structure above
- Create missing directories only
- Document existing deviations

### 1.2 Configure TypeScript

**File**: `backend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "baseUrl": ".",
    "paths": {
      "@config/*": ["src/config/*"],
      "@modules/*": ["src/modules/*"],
      "@integrations/*": ["src/integrations/*"],
      "@utils/*": ["src/utils/*"],
      "@middleware/*": ["src/middleware/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**File**: `mobile/tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@screens/*": ["src/screens/*"],
      "@services/*": ["src/services/*"],
      "@contexts/*": ["src/contexts/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

### 1.3 Set Up Environment Configuration

**File**: `backend/src/config/environment.ts`
```typescript
import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default('v1'),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(10),
  
  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  
  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('24h'),
  
  // Encryption
  TAX_ID_ENCRYPTION_KEY: Joi.string().length(64).required(),
  
  // Paystack
  PAYSTACK_SECRET_KEY: Joi.string().required(),
  PAYSTACK_PUBLIC_KEY: Joi.string().required(),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().required(),
  
  // Remita
  REMITA_MERCHANT_ID: Joi.string().required(),
  REMITA_API_KEY: Joi.string().required(),
  REMITA_SERVICE_TYPE_ID: Joi.string().required(),
  
  // Digitax
  DIGITAX_API_KEY: Joi.string().required(),
  DIGITAX_BASE_URL: Joi.string().uri().required(),
  
  // FIRS
  FIRS_API_KEY: Joi.string().required(),
  FIRS_TIN: Joi.string().required(),
  FIRS_BASE_URL: Joi.string().uri().required(),
  
  // Youverify
  YOUVERIFY_API_KEY: Joi.string().required(),
  YOUVERIFY_SANDBOX: Joi.boolean().default(true),
  
  // Flutterwave
  FLW_PUBLIC_KEY: Joi.string().required(),
  FLW_SECRET_KEY: Joi.string().required(),
  FLW_SECRET_HASH: Joi.string().required(),
  
  // Monitoring
  SENTRY_DSN: Joi.string().uri().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    apiVersion: env.API_VERSION,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
  },
  database: {
    url: env.DATABASE_URL,
    poolMin: env.DB_POOL_MIN,
    poolMax: env.DB_POOL_MAX,
  },
  redis: {
    url: env.REDIS_URL,
    password: env.REDIS_PASSWORD,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiration: env.JWT_EXPIRATION,
  },
  encryption: {
    taxIdKey: env.TAX_ID_ENCRYPTION_KEY,
  },
  paystack: {
    secretKey: env.PAYSTACK_SECRET_KEY,
    publicKey: env.PAYSTACK_PUBLIC_KEY,
    webhookSecret: env.PAYSTACK_WEBHOOK_SECRET,
  },
  remita: {
    merchantId: env.REMITA_MERCHANT_ID,
    apiKey: env.REMITA_API_KEY,
    serviceTypeId: env.REMITA_SERVICE_TYPE_ID,
  },
  digitax: {
    apiKey: env.DIGITAX_API_KEY,
    baseUrl: env.DIGITAX_BASE_URL,
  },
  firs: {
    apiKey: env.FIRS_API_KEY,
    tin: env.FIRS_TIN,
    baseUrl: env.FIRS_BASE_URL,
  },
  youverify: {
    apiKey: env.YOUVERIFY_API_KEY,
    sandbox: env.YOUVERIFY_SANDBOX,
  },
  flutterwave: {
    publicKey: env.FLW_PUBLIC_KEY,
    secretKey: env.FLW_SECRET_KEY,
    secretHash: env.FLW_SECRET_HASH,
  },
  monitoring: {
    sentryDsn: env.SENTRY_DSN,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
};
```

### 1.4 Define Database Schema

**File**: `backend/prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum BusinessStatus {
  PENDING
  VERIFIED
  ACTIVE
  SUSPENDED
  INACTIVE
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  REFUNDED
}

enum TaxType {
  PIT
  VAT
  CIT
  CGT
  WHT
  PAYE
}

enum RemittanceStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
}

model Business {
  id            String          @id @default(uuid())
  name          String
  cacNumber     String?         @unique
  tin           String          @unique
  bvn           String?
  email         String          @unique
  phone         String
  address       Json
  businessType  String
  status        BusinessStatus  @default(PENDING)
  verifiedAt    DateTime?
  
  invoices      Invoice[]
  payments      Payment[]
  taxRemittances TaxRemittance[]
  auditLogs     AuditLog[]
  employees     Employee[]
  expenses      Expense[]
  
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  
  @@index([tin])
  @@index([email])
  @@index([status])
}

model Invoice {
  id              String         @id @default(uuid())
  invoiceNumber   String         @unique
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id])
  
  customer        Json
  items           Json
  
  subtotal        Decimal        @db.Decimal(15, 2)
  vatAmount       Decimal        @db.Decimal(15, 2)
  total           Decimal        @db.Decimal(15, 2)
  
  dueDate         DateTime
  status          InvoiceStatus  @default(DRAFT)
  
  // NRS Compliance
  nrsCompliant    Boolean        @default(false)
  firsCSID        String?
  firsIRN         String?        @unique
  qrCode          String?        @db.Text
  
  payments        Payment[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([businessId])
  @@index([invoiceNumber])
  @@index([status])
  @@index([firsIRN])
}

model Payment {
  id              String         @id @default(uuid())
  invoiceId       String
  invoice         Invoice        @relation(fields: [invoiceId], references: [id])
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id])
  
  amount          Decimal        @db.Decimal(15, 2)
  paymentMethod   String
  gateway         String         // paystack, remita, flutterwave
  reference       String         @unique
  
  status          PaymentStatus  @default(PENDING)
  paidAt          DateTime?
  
  metadata        Json?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([invoiceId])
  @@index([businessId])
  @@index([reference])
  @@index([status])
}

model TaxRemittance {
  id              String            @id @default(uuid())
  businessId      String
  business        Business          @relation(fields: [businessId], references: [id])
  
  taxType         TaxType
  amount          Decimal           @db.Decimal(15, 2)
  period          String            // YYYY-MM format
  
  remitaRRR       String?           @unique
  firsReference   String?
  
  status          RemittanceStatus  @default(PENDING)
  remittedAt      DateTime?
  
  metadata        Json?
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  @@index([businessId])
  @@index([taxType])
  @@index([period])
  @@index([status])
}

model AuditLog {
  id              String         @id @default(uuid())
  businessId      String?
  business        Business?      @relation(fields: [businessId], references: [id])
  
  userId          String?
  action          String
  resource        String
  
  requestData     Json?
  responseData    Json?
  
  ipAddress       String?
  userAgent       String?
  
  status          String
  errorMessage    String?
  
  createdAt       DateTime       @default(now())
  
  @@index([businessId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}

model WebhookEvent {
  id              String         @id @default(uuid())
  source          String         // paystack, remita, flutterwave
  eventType       String
  
  payload         Json
  signature       String?
  
  processed       Boolean        @default(false)
  processedAt     DateTime?
  
  errorMessage    String?
  retryCount      Int            @default(0)
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([source])
  @@index([eventType])
  @@index([processed])
  @@index([createdAt])
}

model Employee {
  id              String         @id @default(uuid())
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id])
  
  name            String
  email           String
  phone           String
  
  grossSalary     Decimal        @db.Decimal(15, 2)
  allowances      Json
  taxReliefs      Json
  
  startDate       DateTime
  status          String         @default("active")
  
  payslips        Payslip[]
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([businessId])
  @@index([email])
}

model Payslip {
  id              String         @id @default(uuid())
  employeeId      String
  employee        Employee       @relation(fields: [employeeId], references: [id])
  
  period          String         // YYYY-MM format
  
  grossIncome     Decimal        @db.Decimal(15, 2)
  totalAllowances Decimal        @db.Decimal(15, 2)
  taxableIncome   Decimal        @db.Decimal(15, 2)
  taxDue          Decimal        @db.Decimal(15, 2)
  pensionContribution Decimal    @db.Decimal(15, 2)
  nhfContribution Decimal        @db.Decimal(15, 2)
  netPay          Decimal        @db.Decimal(15, 2)
  
  breakdown       Json
  
  pdfUrl          String?
  
  createdAt       DateTime       @default(now())
  
  @@index([employeeId])
  @@index([period])
  @@unique([employeeId, period])
}

model Expense {
  id              String         @id @default(uuid())
  businessId      String
  business        Business       @relation(fields: [businessId], references: [id])
  
  amount          Decimal        @db.Decimal(15, 2)
  category        String
  description     String
  date            DateTime
  
  vatAmount       Decimal        @db.Decimal(15, 2) @default(0)
  vatEligible     Boolean        @default(false)
  
  receiptImage    String?
  ocrData         Json?
  
  status          String         @default("pending")
  approvedBy      String?
  approvedAt      DateTime?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@index([businessId])
  @@index([category])
  @@index([status])
  @@index([date])
}
```

### 1.5 Set Up Logging Infrastructure

**File**: `backend/src/utils/logger.ts`
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@config/environment';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [];

// Console transport (all environments)
if (config.app.isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
    })
  );
}

// File transports (production and staging)
if (!config.app.isDevelopment) {
  // Combined log
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    })
  );

  // Error log
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      format: logFormat,
    })
  );

  // HTTP log
  transports.push(
    new DailyRotateFile({
      filename: 'logs/http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxSize: '20m',
      maxFiles: '7d',
      format: logFormat,
    })
  );
}

export const logger = winston.createLogger({
  level: config.app.isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Helper functions
export const logInfo = (message: string, meta?: any) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error | any) => {
  logger.error(message, {
    error: error?.message || error,
    stack: error?.stack,
  });
};

export const logWarn = (message: string, meta?: any) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: any) => {
  logger.debug(message, meta);
};

export const logHttp = (message: string, meta?: any) => {
  logger.http(message, meta);
};
```

### 1.6 Create .env.example

**File**: `.env.example`
```bash
# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/taxbridge
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=24h

# Encryption
TAX_ID_ENCRYPTION_KEY=generate-with-openssl-rand-hex-32

# Paystack
PAYSTACK_SECRET_KEY=sk_test_your_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_key_here
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# Remita
REMITA_MERCHANT_ID=your_merchant_id
REMITA_API_KEY=your_api_key
REMITA_SERVICE_TYPE_ID=your_service_type_id

# Digitax (FIRS E-Invoicing)
DIGITAX_API_KEY=your_api_key
DIGITAX_BASE_URL=https://digitax.firs.gov.ng

# FIRS
FIRS_API_KEY=your_api_key
FIRS_TIN=your_tin
FIRS_BASE_URL=https://api.firs.gov.ng

# Youverify
YOUVERIFY_API_KEY=your_api_key
YOUVERIFY_SANDBOX=true

# Flutterwave
FLW_PUBLIC_KEY=FLWPUBK_TEST-your_key_here
FLW_SECRET_KEY=FLWSECK_TEST-your_key_here
FLW_SECRET_HASH=your_secret_hash

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🎯 PHASE 2: CORE TAX ENGINE

### 2.1 Implement Tax Calculation Engine

**File**: `backend/src/modules/tax/tax.constants.ts`
```typescript
export const NTA_2025_RULES = {
  PIT: {
    brackets: [
      { min: 0, max: 300000, rate: 0.07 },
      { min: 300000, max: 600000, rate: 0.11 },
      { min: 600000, max: 1100000, rate: 0.15 },
      { min: 1100000, max: 1600000, rate: 0.19 },
      { min: 1600000, max: 3200000, rate: 0.21 },
      { min: 3200000, max: Infinity, rate: 0.24 },
    ],
    reliefs: {
      consolidated: 200000,
      pensionRate: 0.08,
      nhfRate: 0.025,
      lifeInsuranceRate: 0.20,
      lifeInsuranceMax: 0.07,
    },
  },
  VAT: {
    standard: 0.075,
    zero: ['exports', 'basic-food-items', 'books', 'medical-services'],
    exempt: ['rent', 'land', 'financial-services'],
  },
  CIT: {
    small: { threshold: 25000000, rate: 0 },
    medium: { threshold: 100000000, rate: 0.20 },
    large: { rate: 0.30 },
  },
  CGT: {
    rate: 0.10,
    assets: ['crypto', 'NFTs', 'stocks', 'bonds', 'property'],
  },
  WHT: {
    dividend: 0.10,
    interest: 0.10,
    rent: 0.10,
    royalty: 0.10,
    consultancy: 0.10,
    construction: 0.05,
  },
  penalties: {
    underDeduction: { base: 0.10, interest: 0.05 },
    lateRemittance: 0.10,
    lateReturn: 25000,
    nonRemittance: 0.10,
  },
};
```

**File**: `backend/src/modules/tax/tax.service.ts`
```typescript
import { NTA_2025_RULES } from './tax.constants';
import { logInfo, logError } from '@utils/logger';

export interface TaxCalculationResult {
  taxableIncome: number;
  taxAmount: number;
  effectiveRate: number;
  breakdown: Array<{
    bracket: string;
    rate: number;
    amount: number;
  }>;
  reliefs: {
    cra: number;
    pension: number;
    nhf: number;
    lifeInsurance: number;
  };
  netIncome: number;
}

export interface TaxReliefs {
  cra?: boolean;
  pension?: number;
  nhf?: number;
  lifeInsurance?: number;
}

export class TaxService {
  /**
   * Calculate Personal Income Tax (PIT) with progressive brackets
   */
  calculatePIT(grossIncome: number, reliefs?: TaxReliefs): TaxCalculationResult {
    logInfo('Calculating PIT', { grossIncome, reliefs });

    // Calculate total reliefs
    const craRelief = reliefs?.cra ? NTA_2025_RULES.PIT.reliefs.consolidated : 0;
    const pensionRelief = reliefs?.pension || 0;
    const nhfRelief = reliefs?.nhf || 0;
    const lifeInsuranceRelief = reliefs?.lifeInsurance || 0;

    const totalReliefs = craRelief + pensionRelief + nhfRelief + lifeInsuranceRelief;
    const taxableIncome = Math.max(0, grossIncome - totalReliefs);

    // Calculate tax using progressive brackets
    let taxAmount = 0;
    const breakdown: Array<{ bracket: string; rate: number; amount: number }> = [];

    for (const bracket of NTA_2025_RULES.PIT.brackets) {
      if (taxableIncome <= bracket.min) break;

      const bracketAmount = Math.min(taxableIncome, bracket.max) - bracket.min;
      const bracketTax = bracketAmount * bracket.rate;

      taxAmount += bracketTax;
      breakdown.push({
        bracket: `₦${bracket.min.toLocaleString()} - ₦${bracket.max === Infinity ? '∞' : bracket.max.toLocaleString()}`,
        rate: bracket.rate,
        amount: bracketTax,
      });
    }

    const effectiveRate = grossIncome > 0 ? taxAmount / grossIncome : 0;
    const netIncome = grossIncome - taxAmount;

    const result: TaxCalculationResult = {
      taxableIncome,
      taxAmount,
      effectiveRate,
      breakdown,
      reliefs: {
        cra: craRelief,
        pension: pensionRelief,
        nhf: nhfRelief,
        lifeInsurance: lifeInsuranceRelief,
      },
      netIncome,
    };

    logInfo('PIT calculation complete', result);
    return result;
  }

  /**
   * Calculate Value Added Tax (VAT)
   */
  calculateVAT(
    amount: number,
    category: 'standard' | 'zero' | 'exempt'
  ): number {
    if (category === 'exempt') return 0;
    if (category === 'zero') return 0;
    
    const vatRate = NTA_2025_RULES.VAT.standard;
    const vatAmount = amount * vatRate;
    
    logInfo('VAT calculation', { amount, category, vatAmount });
    return vatAmount;
  }

  /**
   * Calculate Company Income Tax (CIT)
   */
  calculateCIT(revenue: number, expenses: number): TaxCalculationResult {
    const profit = revenue - expenses;
    let taxRate = 0;
    let category = '';

    if (revenue <= NTA_2025_RULES.CIT.small.threshold) {
      taxRate = NTA_2025_RULES.CIT.small.rate;
      category = 'Small Company (≤₦25M)';
    } else if (revenue <= NTA_2025_RULES.CIT.medium.threshold) {
      taxRate = NTA_2025_RULES.CIT.medium.rate;
      category = 'Medium Company (≤₦100M)';
    } else {
      taxRate = NTA_2025_RULES.CIT.large.rate;
      category = 'Large Company (>₦100M)';
    }

    const taxAmount = Math.max(0, profit * taxRate);
    const effectiveRate = revenue > 0 ? taxAmount / revenue : 0;

    return {
      taxableIncome: profit,
      taxAmount,
      effectiveRate,
      breakdown: [
        {
          bracket: category,
          rate: taxRate,
          amount: taxAmount,
        },
      ],
      reliefs: {
        cra: 0,
        pension: 0,
        nhf: 0,
        lifeInsurance: 0,
      },
      netIncome: profit - taxAmount,
    };
  }

  /**
   * Calculate Capital Gains Tax (CGT) for digital assets
   */
  calculateCGT(proceeds: number, costBasis: number, assetType: string): number {
    if (!NTA_2025_RULES.CGT.assets.includes(assetType)) {
      throw new Error(`Asset type ${assetType} not subject to CGT`);
    }

    const capitalGain = Math.max(0, proceeds - costBasis);
    const taxAmount = capitalGain * NTA_2025_RULES.CGT.rate;

    logInfo('CGT calculation', { proceeds, costBasis, assetType, taxAmount });
    return taxAmount;
  }

  /**
   * Calculate Withholding Tax (WHT)
   */
  calculateWHT(amount: number, type: keyof typeof NTA_2025_RULES.WHT): number {
    const rate = NTA_2025_RULES.WHT[type];
    if (!rate) {
      throw new Error(`Invalid WHT type: ${type}`);
    }

    const whtAmount = amount * rate;
    logInfo('WHT calculation', { amount, type, rate, whtAmount });
    return whtAmount;
  }
}
```

Continue in next section...

---

## 📝 QUICK REFERENCE COMMANDS

### Development
```bash
# Start all services
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

### Database
```bash
# Create migration
npx prisma migrate dev --name migration-name

# Apply migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Seed database
npx prisma db seed

# Reset database (development only)
npx prisma migrate reset
```

### Docker
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Clean up
docker-compose down -v --remove-orphans
```

---

This roadmap will be continued in additional sections for complete implementation coverage. The next document will cover Phases 3-8 with same level of detail.
