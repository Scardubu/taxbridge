# 🚀 TaxBridge Local Development Setup

This guide helps you run TaxBridge backend locally **without Redis** for development purposes.

---

## ⚡ Quick Start (No Redis Required)

The backend is configured to run in **degraded mode** during development when Redis is unavailable. Background jobs will be processed synchronously instead of being queued.

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

The `.env` file is already configured with `REDIS_OPTIONAL=true`, which allows the server to start without Redis.

### 3. Start the Server

```bash
npm run dev
```

You should see:
```
⚠️  Redis unavailable - running in degraded mode (queues disabled)
✅ Server started on http://localhost:3000
✅ Swagger docs available at http://localhost:3000/docs
```

---

## 🔍 What Works Without Redis?

### ✅ Fully Functional
- All API endpoints
- Database operations
- Tax calculations
- Invoice creation and management
- Payment processing
- Authentication and authorization
- Swagger documentation
- Health checks

### ⚠️ Degraded (Synchronous Processing)
- **Invoice NRS stamping**: Processed immediately instead of queued
- **Device sync**: Processed immediately instead of queued
- **Payment webhooks**: Processed immediately instead of queued

### ❌ Not Available
- Background job retries
- Job scheduling
- Queue monitoring

---

## 🐳 Optional: Running with Redis (Full Features)

If you want to test queue functionality, you can run Redis locally:

### Option 1: Docker (Recommended)

```bash
# Start Redis in Docker
docker run -d -p 6379:6379 --name taxbridge-redis redis:7-alpine

# Verify it's running
docker ps
```

### Option 2: Windows Installation

1. Download Redis for Windows from: https://github.com/microsoftarchive/redis/releases
2. Install and start the Redis service
3. Verify with: `redis-cli ping` (should return `PONG`)

### Option 3: WSL2

```bash
# In WSL2 terminal
sudo apt update
sudo apt install redis-server
sudo service redis-server start
redis-cli ping  # Should return PONG
```

Once Redis is running, restart the backend:

```bash
npm run dev
```

You should see:
```
✅ Redis connected successfully
✅ Server started on http://localhost:3000
```

---

## 📊 Testing the Setup

### 1. Check Health Endpoints

```bash
# Liveness check
curl http://localhost:3000/health/live

# Readiness check (includes DB and Redis status)
curl http://localhost:3000/health/ready

# Full health check
curl http://localhost:3000/health
```

### 2. Access Swagger Documentation

Open your browser to: **http://localhost:3000/docs**

### 3. Test an API Endpoint

```bash
# Calculate PIT
curl -X POST http://localhost:3000/api/v1/tax/calculate/pit \
  -H "Content-Type: application/json" \
  -d '{
    "grossIncome": 5000000,
    "reliefs": {
      "cra": true,
      "pension": 400000,
      "nhf": 125000
    }
  }'
```

---

## 🔧 Troubleshooting

### Issue: "ECONNREFUSED ::1:6379"

**Solution**: This is expected if Redis is not running. The server will automatically switch to degraded mode in development.

**To verify degraded mode is working:**
- Look for: `⚠️  Redis unavailable - running in degraded mode`
- Server should still start successfully
- All API endpoints should work

### Issue: Database Connection Errors

**Check:**
1. `.env` file has correct `DATABASE_URL` and `DIRECT_URL`
2. Supabase database is accessible
3. SSL certificate path is correct

**Test connection:**
```bash
npx prisma db pull
```

### Issue: Port 3000 Already in Use

**Solution:**
```bash
# Find and kill the process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change the port in .env
PORT=3001
```

---

## 🧪 Running Tests

Tests run with an in-memory mock for Redis:

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

---

## 📝 Environment Variables

Key variables for local development:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database (Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis (optional in development)
REDIS_URL="redis://localhost:6379"
REDIS_OPTIONAL=true

# Mock Modes (enabled for development)
DIGITAX_MOCK_MODE=true
REMITA_MOCK_MODE=true
FLW_MOCK_MODE=true
PAYSTACK_MOCK_MODE=true
YOUVERIFY_SANDBOX=true
```

---

## 🎯 Next Steps

1. **Explore the API**: Visit http://localhost:3000/docs
2. **Seed the database**: `npx prisma db seed`
3. **Run tests**: `npm test`
4. **Read the Developer Guide**: `docs/DEVELOPER_GUIDE.md`
5. **Import Postman collection**: `docs/postman/TaxBridge_API.postman_collection.json`

---

## 💡 Tips

### Development Workflow

1. **Make code changes** - Server auto-reloads with `npm run dev`
2. **Test immediately** - Use Swagger UI or Postman
3. **Check logs** - Console shows detailed request/response logs
4. **Run tests** - `npm test` before committing

### Performance Optimization

- Redis is **not required** for development
- Mock modes prevent external API calls
- Database pooling is configured for local development
- Slow query logging enabled (>500ms)

### Security Notes

- All mock modes are **enabled by default** in development
- Real API keys are **not required** for local testing
- JWT secrets are **development-only** values
- HTTPS is **not enforced** in development

---

## 🆘 Getting Help

- **Documentation**: `docs/DEVELOPER_GUIDE.md`
- **API Reference**: http://localhost:3000/docs
- **Postman Collection**: `docs/postman/TaxBridge_API.postman_collection.json`
- **Phase Reports**: `docs/PHASE_*_COMPLETION_REPORT.md`

---

**Happy Coding! 🎉**
