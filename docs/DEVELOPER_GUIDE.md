# 🛠️ TaxBridge Developer Guide

**Version:** 1.0.0  
**Last Updated:** February 10, 2026  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [API Development](#api-development)
6. [Testing Guidelines](#testing-guidelines)
7. [Deployment](#deployment)
8. [Contributing](#contributing)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or v20.x
- **PostgreSQL**: v15+
- **Redis**: v7+
- **Yarn**: v1.22+ (package manager)
- **Docker**: v24+ (optional, for containerized development)

### Quick Start

```bash
# Clone repository
git clone https://github.com/Scardubu/taxbridge.git
cd taxbridge

# Install dependencies
yarn install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Start PostgreSQL and Redis (via Docker)
docker-compose up -d postgres redis

# Run database migrations
yarn --cwd backend prisma:generate
yarn --cwd backend db:migrate

# Start development server
yarn --cwd backend dev

# In another terminal, start the worker
yarn --cwd backend queue:worker
```

The API will be available at `http://localhost:3000`  
Swagger documentation: `http://localhost:3000/docs`

---

## 🏗️ Architecture Overview

### System Architecture

TaxBridge is built as a **monorepo** with the following components:

```
taxbridge/
├── backend/          # Node.js API (Fastify + Prisma)
├── mobile/           # React Native + Expo (offline-first)
├── admin-dashboard/  # Next.js admin panel
├── ml/               # OCR and ML services
├── packages/         # Shared packages
│   └── contracts/    # Shared types and constants
└── docs/             # Documentation
```

### Technology Stack

**Backend:**
- **Runtime:** Node.js 18+
- **Framework:** Fastify (high-performance HTTP server)
- **Database:** PostgreSQL 15+ (via Prisma ORM)
- **Cache/Queue:** Redis 7+ (BullMQ for job processing)
- **Validation:** Zod schemas
- **Authentication:** JWT with refresh tokens
- **Monitoring:** Sentry, Prometheus metrics

**Mobile:**
- **Framework:** React Native + Expo
- **Offline Storage:** SQLite
- **State Management:** React Context + Hooks
- **Sync:** Background sync with conflict resolution

**Admin Dashboard:**
- **Framework:** Next.js 14+ (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Deployment:** Vercel

### Key Design Patterns

1. **Offline-First (Mobile)**: All data writes go through `SyncContext` → SQLite → Background sync
2. **Service Layer**: Business logic in `/services`, routes are thin controllers
3. **Queue-Based Processing**: Long-running tasks (NRS stamping, payments) use BullMQ
4. **Mock Mode**: All integrations support mock mode for development/testing
5. **Type Safety**: End-to-end TypeScript with Zod runtime validation

---

## 💻 Development Setup

### Environment Variables

Create `backend/.env` from `.env.example`:

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/taxbridge"
DIRECT_URL="postgresql://postgres:password@localhost:5432/taxbridge"

# Redis
REDIS_URL="redis://localhost:6379"

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET="your-64-char-hex-secret"
JWT_REFRESH_SECRET="your-64-char-hex-secret"
ENCRYPTION_KEY="your-64-char-hex-secret"

# Integration Mock Modes (set to 'true' for development)
DIGITAX_MOCK_MODE="true"
REMITA_MOCK_MODE="true"
PAYSTACK_MOCK_MODE="true"
FLW_MOCK_MODE="true"
YOUVERIFY_SANDBOX="true"

# API URLs
DIGITAX_API_URL="https://api.digitax.ng"
REMITA_API_URL="https://remitademo.net"
```

### Database Setup

```bash
# Generate Prisma client
yarn --cwd backend prisma:generate

# Run migrations
yarn --cwd backend db:migrate

# (Optional) Seed database with sample data
yarn --cwd backend prisma db seed
```

### Running Services

**Development mode (with hot reload):**
```bash
# Terminal 1: API server
yarn --cwd backend dev

# Terminal 2: Queue worker
yarn --cwd backend queue:worker

# Terminal 3: Mobile app
yarn --cwd mobile start
```

**Production mode:**
```bash
# Build
yarn --cwd backend build

# Start
yarn --cwd backend start
yarn --cwd backend worker
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

---

## 📁 Project Structure

### Backend Structure

```
backend/
├── src/
│   ├── routes/              # API route handlers
│   │   ├── auth.ts          # Authentication endpoints
│   │   ├── tax.ts           # Tax calculation endpoints
│   │   ├── invoices.ts      # Invoice management
│   │   ├── payments.ts      # Payment processing
│   │   ├── expenses.ts      # Expense tracking
│   │   ├── payroll.ts       # Payroll & PAYE
│   │   ├── compliance.ts    # Compliance reminders
│   │   └── ...
│   ├── services/            # Business logic layer
│   │   ├── tax-engine.ts    # Tax calculations (NTA 2025)
│   │   ├── invoice.ts       # Invoice service
│   │   ├── payment-gateway.ts  # Multi-gateway manager
│   │   ├── expense.ts       # Expense service
│   │   ├── payroll.ts       # Payroll service
│   │   └── ...
│   ├── integrations/        # External API clients
│   │   ├── digitax/         # DigiTax/NRS integration
│   │   ├── remita/          # Remita payment gateway
│   │   ├── paystack/        # Paystack adapter
│   │   ├── flutterwave/     # Flutterwave adapter
│   │   └── youverify/       # Identity verification
│   ├── queue/               # BullMQ job processors
│   │   ├── client.ts        # Queue initialization
│   │   └── workers/         # Job handlers
│   ├── lib/                 # Utilities
│   │   ├── errors.ts        # Custom error classes
│   │   ├── logger.ts        # Winston logger
│   │   ├── security.ts      # Security utilities
│   │   └── prisma.ts        # Prisma client
│   ├── middleware/          # Request middleware
│   ├── __tests__/           # Test files
│   └── server.ts            # Application entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Migration history
│   └── seed.ts              # Seed script
├── Dockerfile               # Production Docker image
└── package.json
```

### Mobile Structure

```
mobile/
├── src/
│   ├── screens/             # Screen components
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React contexts
│   │   └── SyncContext.tsx  # Offline sync manager
│   ├── services/
│   │   ├── sqlite/          # SQLite database
│   │   ├── api/             # API clients
│   │   └── ocr/             # Receipt scanning
│   ├── tax/                 # Tax calculation engine
│   └── utils/               # Utilities
└── app.json                 # Expo configuration
```

---

## 🔌 API Development

### Creating a New Endpoint

**1. Define Zod Schema** (`backend/src/routes/example.ts`):

```typescript
import { z } from 'zod';
import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

const CreateItemSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  category: z.enum(['type1', 'type2'])
});

const exampleRoutes: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/v1/items',
    {
      schema: {
        tags: ['Items'],
        summary: 'Create a new item',
        body: CreateItemSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: z.object({
              id: z.string(),
              name: z.string(),
              amount: z.number()
            })
          })
        },
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const { name, amount, category } = request.body;
      
      // Business logic here
      const item = await itemService.create({ name, amount, category });
      
      return reply.code(201).send({
        success: true,
        data: item
      });
    }
  );
};

export default exampleRoutes;
```

**2. Register Route** (`backend/src/server.ts`):

```typescript
import exampleRoutes from './routes/example';

// In bootstrap() function
await app.register(exampleRoutes);
```

**3. Create Service** (`backend/src/services/item.ts`):

```typescript
import { getPrismaClient } from '../lib/prisma';

const prisma = getPrismaClient();

export class ItemService {
  async create(data: { name: string; amount: number; category: string }) {
    return await prisma.item.create({
      data: {
        ...data,
        createdAt: new Date()
      }
    });
  }
}

export const itemService = new ItemService();
```

**4. Add Tests** (`backend/src/__tests__/item-service.unit.test.ts`):

```typescript
import { itemService } from '../services/item';

describe('ItemService', () => {
  it('should create item with valid data', async () => {
    const item = await itemService.create({
      name: 'Test Item',
      amount: 100,
      category: 'type1'
    });
    
    expect(item).toHaveProperty('id');
    expect(item.name).toBe('Test Item');
  });
});
```

### Authentication

Protected endpoints require JWT authentication:

```typescript
import { authenticate } from '../lib/auth';

app.post('/api/v1/protected', async (request, reply) => {
  const { userId } = await authenticate(request);
  
  // userId is now available
  const data = await service.getUserData(userId);
  
  return reply.send({ data });
});
```

### Error Handling

Use custom error classes from `lib/errors.ts`:

```typescript
import { NotFoundError, ValidationError, AuthenticationError } from '../lib/errors';

// Throw errors - they're automatically formatted
if (!item) {
  throw new NotFoundError('Item not found');
}

if (amount < 0) {
  throw new ValidationError('Amount must be positive');
}
```

---

## 🧪 Testing Guidelines

### Test Structure

```
backend/src/__tests__/
├── unit/                    # Unit tests (60% of pyramid)
│   ├── tax-engine.unit.test.ts
│   ├── invoice-service.unit.test.ts
│   └── ...
├── integration/             # Integration tests (25%)
│   ├── api-routes.integration.test.ts
│   ├── duplo.integration.test.ts
│   └── ...
└── e2e/                     # End-to-end tests (15%)
    ├── critical-journeys.e2e.test.ts
    └── workflows.e2e.test.ts
```

### Running Tests

```bash
# All tests
yarn --cwd backend test

# Unit tests only
yarn --cwd backend test:unit

# Integration tests
yarn --cwd backend test:integration

# E2E tests
yarn --cwd backend test:e2e

# With coverage
yarn --cwd backend test --coverage

# Watch mode
yarn --cwd backend test:watch
```

### Writing Tests

**Unit Test Example:**

```typescript
describe('Tax Engine - PIT Calculation', () => {
  it('should calculate correct PIT for ₦500,000 income', () => {
    const result = taxEngine.calculatePIT(500000);
    
    expect(result.taxAmount).toBe(22000);
    expect(result.effectiveRate).toBeCloseTo(0.044);
    expect(result.breakdown).toHaveLength(2);
  });
  
  it('should apply CRA relief correctly', () => {
    const result = taxEngine.calculatePIT(500000, { cra: true });
    
    expect(result.taxableIncome).toBe(300000);
  });
});
```

**Integration Test Example:**

```typescript
describe('POST /api/v1/tax/calculate/pit', () => {
  it('should return tax calculation', async () => {
    const response = await request(app.server)
      .post('/api/v1/tax/calculate/pit')
      .send({ grossIncome: 500000, reliefs: { cra: true } })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.taxAmount).toBe(22000);
  });
});
```

### Coverage Requirements

- **Statements:** ≥65%
- **Branches:** ≥60%
- **Functions:** ≥60%
- **Lines:** ≥65%

---

## 🚀 Deployment

### Production Checklist

- [ ] All tests passing (`yarn test`)
- [ ] TypeScript compiles (`yarn build`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Secrets rotated (JWT, encryption keys)
- [ ] Mock modes disabled (`DIGITAX_MOCK_MODE=false`)
- [ ] Monitoring enabled (Sentry DSN set)
- [ ] Health checks responding
- [ ] Backup strategy verified

### Deployment Platforms

**Backend (Render):**
```bash
# Automatic deployment via render.yaml
git push origin main

# Manual deployment
curl -X POST "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}"
```

**Admin Dashboard (Vercel):**
```bash
cd admin-dashboard
vercel --prod
```

**Mobile (Expo EAS):**
```bash
cd mobile
eas build --platform all --profile production
eas submit --platform all --profile production
```

### Environment-Specific Configuration

**Development:**
- Mock modes enabled
- Detailed logging
- No rate limiting
- Local database

**Staging:**
- Mock modes enabled (for testing)
- Moderate logging
- Rate limiting enabled
- Cloud database (Supabase)

**Production:**
- Mock modes **disabled**
- Production logging (info level)
- Strict rate limiting
- Cloud database with backups
- Monitoring and alerts active

---

## 🤝 Contributing

### Code Style

- **TypeScript:** Strict mode enabled, no `any` types
- **Formatting:** Prettier (run `yarn lint:fix`)
- **Linting:** ESLint (run `yarn lint`)
- **Commits:** Conventional Commits format

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat(module): add new feature"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions/changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build/tooling changes

**Example:**
```
feat(payroll): add PAYE calculator with NTA 2025 rates

- Implement progressive tax brackets
- Add pension and NHF deductions
- Include CRA relief calculation
- Add comprehensive unit tests

Closes #123
```

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add changelog entry
4. Request review from maintainers
5. Address review feedback
6. Squash commits before merge

---

## 📚 Additional Resources

- **API Documentation:** http://localhost:3000/docs (Swagger UI)
- **Postman Collection:** `docs/postman/TaxBridge_API.postman_collection.json`
- **Architecture Diagrams:** `docs/architecture/`
- **Runbook:** `docs/runbook.md`
- **Security Guide:** `docs/SECURITY_ARCHITECTURE.md`

---

## 🆘 Getting Help

- **Issues:** https://github.com/Scardubu/taxbridge/issues
- **Discussions:** https://github.com/Scardubu/taxbridge/discussions
- **Email:** dev@taxbridge.ng
- **Slack:** #taxbridge-dev (internal)

---

**Happy Coding! 🚀**
