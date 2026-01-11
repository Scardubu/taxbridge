# TaxBridge Testing & Quality Assurance Framework

This document outlines the comprehensive testing infrastructure and quality gates implemented for TaxBridge to ensure production-ready quality and compliance with 2026 NRS (Nigeria Revenue Service) requirements, with enhanced focus on Duplo e-invoicing and Remita payment integration.

## Testing Pyramid Overview

```
    E2E Tests (10%)
   ┌─────────────────┐
  │  Full User Flows │
 ┌─────────────────────┐
│ Integration Tests (25%) │
│  API & External APIs   │
├─────────────────────────┤
│   Unit Tests (60%)      │
│ Functions & Modules     │
├─────────────────────────┤
│ Security/Performance (5%) │
│ OWASP & Load Testing     │
└──────────────────────────┘
```

## Enhanced Quality Gates Checklist

### ✅ Current Test Status (January 2026)

| Component | Tests | Status | Framework |
|-----------|-------|--------|-----------|
| **Backend** | 68 | ✅ All Passing | Jest 29.7 + Supertest |
| **Admin Dashboard** | 8 | ✅ All Passing | Jest 29.7 + @testing-library/react |
| **Mobile** | 38 | ✅ All Passing | Jest 30 + jest-expo 54 + @testing-library/react-native |
| **Total** | **114+** | ✅ All Passing | - |

### ✅ Code Coverage Requirements

- **Backend**: 85%+ coverage across all metrics
  - Branches: ≥85%
  - Functions: ≥85%
  - Lines: ≥85%
  - Statements: ≥85%
- **Mobile**: 80%+ coverage
- **Admin Dashboard**: 80%+ coverage
- **Critical Paths**: 100% coverage required
  - UBL generation (55 mandatory fields)
  - Duplo integration (OAuth 2.0 + e-invoicing)
  - Remita payment flow (RRR + status)
  - Tax calculations (7.5% VAT)

### ✅ Test Execution Requirements

- **All tests passing**: Unit, Integration, E2E, API-specific
- **Zero flaky tests**: All tests must be deterministic
- **Test isolation**: No cross-test dependencies
- **Mock coverage**: All external APIs properly mocked
- **API Integration Tests**: Duplo and Remita specific validation

### ✅ Performance Requirements (NRS 2026 Compliance)

- **API Response Times**: p95 <300ms (NRS requirement)
  - Health checks: <100ms
  - Duplo submission: <2000ms
  - Remita RRR generation: <3000ms
  - Invoice listing: <500ms
  - Status checks: <1000ms
- **Load Testing**: Support 150+ concurrent users (peak load)
- **Error Rates**: <10% overall, <5% for critical APIs
- **Memory Usage**: No memory leaks in sustained load

### ✅ Security Requirements

- **Zero high-severity vulnerabilities**: npm audit + OWASP ZAP
- **API Security**: All endpoints authenticated/authorized
- **Data Protection**: Sensitive data encrypted at rest/transit
- **Input Validation**: All user inputs sanitized
- **Hash Security**: SHA512 for Remita payment validation

### ✅ Compliance Requirements

- **UBL 3.0 Validation**: 55 mandatory fields checked 100%
- **Peppol BIS Billing 3.0**: Schema validation 100%
- **NRS 2026 Compliance**: All tax rules implemented
- **NDPR Compliance**: Data privacy requirements met
- **Duplo APP Integration**: NITDA-accredited Access Point compliance

## Test Categories

### 1. Unit Tests (60%)

**Location**: `backend/src/**/__tests__/*.unit.test.ts`

**Coverage**:
- UBL generator with 55 mandatory fields validation ✅
- Tax calculator (VAT, withholding tax) ✅
- OCR processing functions ✅
- Utility functions and helpers ✅
- Business logic validation ✅
- VAT calculation accuracy (7.5%) ✅
- Line item calculations ✅
- Nigerian TIN format validation ✅

**Key Test Files**:
- `src/__tests__/ubl.generator.unit.test.ts` - UBL 3.0 generation with full Peppol BIS compliance
- `src/lib/tax/calculator.unit.test.ts` - Tax calculations
- `src/lib/ocr/processor.unit.test.ts` - OCR functions

**Enhanced Coverage** (January 2026 Update):
- ✅ All 55 mandatory UBL fields validated
- ✅ 7.5% VAT calculation accuracy tests
- ✅ Line item calculations sum to subtotal
- ✅ Namespace compliance with UBL 2.1 and Peppol BIS
- ✅ Business rules validation (TIN format, date format, invoice type)
- ✅ Multiple invoice lines handling
- ✅ Edge cases and error scenarios

### 2. Integration Tests (25%)

**Location**: `backend/src/**/__tests__/*.integration.test.ts`

**Coverage**:
- Duplo API integration (OAuth 2.0, e-invoice submission) ✅
- Remita API integration (RRR generation, status checks) ✅
- Database operations (CRUD, migrations) ✅
- Queue processing (BullMQ workers) ✅
- External service integrations ✅
- **Database persistence integration** ✅
- **Webhook idempotency** ✅

**Key Test Files**:
- `src/integrations/duplo.integration.test.ts` - Duplo API with DB persistence
- `src/integrations/remita.integration.test.ts` - Remita API with webhook idempotency
- `src/api/routes.integration.test.ts` - API endpoints

**Enhanced Coverage** (January 2026 Update):

**Duplo Integration:**
- ✅ OAuth 2.0 client credentials flow
- ✅ Token caching and refresh
- ✅ E-invoice submission with UBL XML
- ✅ Status checking with IRN validation
- ✅ Database record creation (pending → stamped)
- ✅ Submission attempt audit trail
- ✅ Duplicate submission prevention
- ✅ Rejection handling with error details

**Remita Integration:**
- ✅ SHA512 hash generation for security
- ✅ RRR generation with validation
- ✅ Payment status tracking
- ✅ Transaction history retrieval
- ✅ Webhook signature verification (HMAC-SHA512)
- ✅ Idempotency check for duplicate webhooks
- ✅ Payment and invoice status updates
- ✅ Failed payment handling with error details
- ✅ Audit trail of payment status transitions
- ✅ Queue-based webhook processing

### 3. E2E Tests (10%)

**Location**: `mobile/src/__tests__/`

**Test Suites** (38 tests total):

| File | Tests | Description |
|------|-------|-------------|
| `e2e.test.tsx` | 19 | Core E2E integration tests |
| `payment.e2e.test.tsx` | 16 | Payment flow E2E tests |
| `CreateInvoiceScreen.test.tsx` | 2 | Invoice creation tests |
| `SyncContext.test.tsx` | 1 | Sync context test |

**Coverage**:
- Complete invoice creation to Duplo submission flow ✅
- Payment generation to confirmation flow ✅
- OCR capture to invoice creation ✅
- Offline sync scenarios ✅
- User accessibility features ✅
- **Mobile payment E2E flow** ✅

**Test Scenarios**:
- Invoice creation → UBL generation → Duplo submission → IRN receipt
- RRR generation → Payment simulation → Webhook confirmation
- Receipt capture → OCR processing → Invoice creation
- Offline invoice creation → Sync when online
- **Full payment flow (form input → RRR → status check)** ✅

**Enhanced Coverage** (January 2026 Update):

**Mobile Payment E2E (payment.e2e.test.tsx - 16 tests):**
- ✅ Form rendering with all input fields
- ✅ Invoice information display
- ✅ Payer name input handling (placeholder: "e.g., John Doe")
- ✅ Email input handling (placeholder: "e.g., john@example.com")
- ✅ Phone input handling (placeholder: "e.g., 08012345678")
- ✅ Generate Payment Code (RRR) button functionality
- ✅ Loading state during API calls
- ✅ Error handling for API failures
- ✅ RRR generation with success alert
- ✅ Payment status checking with status alert
- ✅ Navigation integration with React Navigation

**Core E2E (e2e.test.tsx - 19 tests):**
- ✅ HomeScreen rendering and navigation
- ✅ CreateInvoiceScreen form validation
- ✅ InvoicesScreen list rendering
- ✅ SettingsScreen language selection
- ✅ Offline invoice creation flow
- ✅ API integration mocking
- ✅ Error boundary handling
- ✅ Accessibility compliance testing

**Mobile Test Infrastructure:**
- Jest 30 with jest-expo 54 preset (npm workspaces compatible)
- @testing-library/react-native 13.x
- Comprehensive React Native mocking (~300 lines)
- jsdom test environment with `__DEV__` global
- Custom moduleDirectories for monorepo resolution

### 4. Security & Performance Tests (5%)

**Security Tests**:
- OWASP ZAP automated scanning ✅
- npm audit vulnerability scanning ✅
- Input validation testing ✅
- Authentication/authorization testing ✅
- Trivy container scanning ✅

**Performance Tests**:
- k6 load testing scripts ✅
- API response time validation ✅
- Concurrent user handling ✅
- Memory leak detection ✅
- **Enhanced Duplo/Remita scenarios** ✅

**Enhanced Coverage** (January 2026 Update):

**Load Testing Scenarios:**
- ✅ Duplo stress test (10 concurrent submissions)
- ✅ Remita stress test (10 concurrent RRR generations)
- ✅ API spike test (50 requests in rapid succession)
- ✅ End-to-end invoice payment flow
- ✅ Performance benchmark with p50/p95/p99 metrics
- ✅ Health check, Duplo submit, Remita RRR, invoice list tests
- ✅ Specialized scenarios for critical paths

**Performance Gates:**
- ✅ Overall p95 < 300ms (NRS requirement)
- ✅ Duplo submission p95 < 2000ms
- ✅ Remita RRR p95 < 3000ms
- ✅ Health check p95 < 100ms
- ✅ Invoice list p95 < 500ms
- ✅ Status checks p95 < 1000ms
- ✅ Error rate < 10% overall
- ✅ Critical API error rate < 5%

## Running Tests

### Backend Tests

```bash
# Install dependencies
cd backend && npm ci

# Run all tests with coverage
npm run test

# Run specific test categories
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:security      # Security audit + ZAP
npm run test:performance   # k6 load tests

# Watch mode for development
npm run test:watch
```

### Mobile Tests

```bash
# Install dependencies
cd mobile && npm ci

# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

### Load Tests

```bash
# Install k6 (see load-test/README.md)
k6 run backend/load-test/k6-script.js

# Against staging
BASE_URL=https://staging-api.taxbridge.com k6 run backend/load-test/k6-script.js

# Specialized tests
k6 run -e SCENARIO=duploStressTest backend/load-test/k6-script.js
```

## CI/CD Integration

### Automated Pipeline

The testing framework is integrated into GitHub Actions (`.github/workflows/test-automation.yml`):

1. **Backend Tests**: Unit + Integration with coverage
2. **Mobile Tests**: Unit tests with coverage
3. **Security Scanning**: npm audit + OWASP ZAP + Trivy
4. **Load Testing**: k6 performance tests (staging only)
5. **Quality Gates**: Automated checks before deployment

### Environment Variables

Required secrets for CI/CD:
- `DUPLO_CLIENT_ID` - Duplo API client ID
- `DUPLO_CLIENT_SECRET` - Duplo API client secret
- `DUPLO_API_URL` - Duplo API endpoint
- `REMITA_API_KEY` - Remita API key
- `REMITA_MERCHANT_ID` - Remita merchant ID
- `REMITA_SERVICE_TYPE_ID` - Remita service type ID
- `REMITA_API_URL` - Remita API endpoint

## Production Readiness Checklist

### Pre-Deployment Requirements

- [ ] All tests passing (unit, integration, E2E)
- [ ] Coverage thresholds met (85%+ backend, 80%+ mobile)
- [ ] Security scan passed (zero high/critical vulnerabilities)
- [ ] Load tests completed (p95 <300ms, 100+ concurrent users)
- [ ] UBL validation 100% (all 55 mandatory fields)
- [ ] Duplo integration certified (sandbox → production)
- [ ] Remita integration tested (RRR generation, webhooks)
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Rollback plan documented

### Post-Deployment Verification

- [ ] Health checks passing
- [ ] Smoke tests successful
- [ ] Monitoring alerts configured
- [ ] Error tracking enabled
- [ ] Performance metrics baseline established

## Monitoring & Alerting

### Key Metrics

- **API Response Times**: p95, p99, averages
- **Error Rates**: By endpoint, error type
- **Throughput**: Requests per second
- **External API Health**: Duplo, Remita status
- **Database Performance**: Query times, connection pools
- **Queue Processing**: Worker health, backlog size

### Alert Thresholds

- **Response Time**: p95 >500ms (warning), >1000ms (critical)
- **Error Rate**: >5% (warning), >10% (critical)
- **External API**: >90% success rate required
- **Database**: >80% connection pool usage
- **Queue**: >1000 items in backlog

## Test Data Management

### Mock Data Strategy

- **Unit Tests**: Minimal, focused mock data
- **Integration Tests**: Realistic test data sets
- **E2E Tests**: Complete user journey data
- **Load Tests**: Dynamically generated data

### Data Privacy

- **PII Redaction**: All test data anonymized
- **TIN Validation**: Valid format but fake numbers
- **Payment Data**: Test amounts and RRRs only
- **GDPR/NDPR Compliance**: No real user data

## Troubleshooting Guide

### Common Issues

1. **Test Failures on CI**
   - Check environment variables
   - Verify service dependencies (PostgreSQL, Redis)
   - Review test isolation

2. **Coverage Thresholds Not Met**
   - Identify uncovered code paths
   - Add missing test cases
   - Review exclusion patterns

3. **Load Test Failures**
   - Check API endpoint availability
   - Verify test data generation
   - Monitor resource utilization

4. **Security Scan Failures**
   - Update vulnerable dependencies
   - Review security configurations
   - Address OWASP findings

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run test

# Run tests with verbose output
npm run test -- --verbose

# Run specific test file
npm test -- src/lib/ubl/generator.unit.test.ts
```

## Continuous Improvement

### Metrics Tracking

- Test execution time trends
- Coverage percentage changes
- Defect detection rates
- Performance regression detection

### Process Enhancements

- Regular test maintenance
- Mock data updates
- Performance benchmark updates
- Security scan frequency optimization

## Compliance Documentation

### NRS 2026 Requirements

- **E-Invoicing**: Peppol BIS Billing 3.0 compliance
- **Tax Calculations**: 7.5% VAT, withholding tax
- **Data Retention**: Statutory requirements met
- **Audit Trail**: Complete transaction logging

### Technical Standards

- **UBL 3.0**: 55 mandatory fields validation
- **OAuth 2.0**: Secure API authentication
- **SHA512**: Remita payment hash generation
- **TLS 1.3**: All communications encrypted

This comprehensive testing framework ensures TaxBridge meets the highest quality standards for Nigerian tax compliance under the 2026 NRS mandate, providing reliable, secure, and performant tax management for SMEs.
