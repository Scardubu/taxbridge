# @taxbridge/contracts 📜

<div align="center">

**Canonical Tax Engine, Rate Constants, Invoicing Schemas & RBAC Contracts**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-green)](/)
[![NTA 2025](https://img.shields.io/badge/NTA%202025-compliant-green)](/)
[![NRS 2026](https://img.shields.io/badge/NRS%202026-e--invoicing-green)](/)

</div>

---

## 🏛️ Overview

`@taxbridge/contracts` is the **single authoritative source of truth** for all tax calculations, statutory rates, invoicing schemas, offline sync operations, and role-based access control (RBAC) types across the TaxBridge ecosystem.

### Architectural Invariants
- **C-04**: Sole tax-math package across the monorepo.
- **C-09**: All calculations live here; never duplicated or re-implemented in `backend`, `mobile`, or `admin-dashboard`.
- **Zero Rate Drift**: All consumers must import rates and formulas exclusively from `@taxbridge/contracts`.
- **Append-Only Contract Compatibility**: The `/api/v1` API schemas are guaranteed backward-compatible and append-only via automated CI verification.

---

## 📦 Exported Modules

### 1. Canonical Tax Calculators
- `calculatePIT(input: PITInput): PITResult`
  - Compliant with **Nigeria Tax Act (NTA) 2025** progressive personal income tax bands:
    - ₦0 – ₦800,000: 0%
    - ₦800,001 – ₦3,000,000: 15%
    - ₦3,000,001 – ₦12,000,000: 18%
    - ₦12,000,001 – ₦25,000,000: 21%
    - ₦25,000,001 – ₦50,000,000: 23%
    - Above ₦50,000,000: 25%
  - Automatically incorporates **Rent Relief Allowance (RRA)**, pension contributions, and statutory deductions.
- `calculateCIT(input: CITInput): CITResult`
  - Compliant with **NTA 2025 Company Income Tax 3-Tier Structure**:
    - Small Company (Turnover ≤ ₦25M): 0%
    - Medium Company (Turnover ₦25M – ₦100M): 20%
    - Large Company (Turnover > ₦100M): 30%
  - Calculates Development Levy (4%) and Education Tax (EDT 2%) where applicable.
- `calculateVAT(input: VATInput): VATResult`
  - Standard rate: **7.5%**.
  - Handles exempt categories (basic food, medical, books) and zero-rated transactions.
- `calculateWHT(input: WHTInput): WHTResult`
  - Covers 22 canonical withholding tax categories (professional fees, construction, dividends, contracts).
- `calculatePenalty(input: PenaltyInput): PenaltyResult`
  - Statutory late filing and payment penalty engine with phase-specific calculations.

### 2. Canonical Invoicing Contracts (`invoice.ts`)
- Strict Zod schemas for `/api/v1/invoices`:
  - `CreateInvoiceV1RequestSchema`
  - `CreateInvoiceV1ResponseSchema`
  - `InvoiceStatusEnum`: `DRAFT`, `ISSUED`, `PAID`, `CANCELLED`, `PENDING_SYNC`, `SYNCED`, `FAILED`
  - `PaymentStatusEnum`: `PENDING`, `RESERVED`, `SUCCESSFUL`, `FAILED`, `REFUNDED`
- UBL 3.0 / Peppol BIS Billing 3.0 required fields and validation metadata.

### 3. Role-Based Access Control (`rbac.ts`)
- Strict separation between platform administrator roles and tenant roles:
  - **Platform Administrator Roles**: `SUPER_ADMIN`, `ADMIN` (enforced via database-backed `requirePlatformAdmin` plugin).
  - **Tenant / Operational Roles**: `ACCOUNTANT`, `OPERATOR`, `AUDITOR`, `TENANT_USER`, `DEVICE_AGENT`.

### 4. Sync & Operations (`sync.ts`, `operations.ts`)
- Standardized offline-first operation queue contracts (`OperationTypeEnum`, `SyncStatusEnum`).
- Deterministic API error responses (`ApiErrorResponseSchema`).

---

## 🛠️ Verification & Quality Assurance

```bash
# Build the package
npm run build

# Run unit tests (10/10 passing)
npm run test

# Run append-only contract compatibility check
npm run compatibility:check
```

All public exports are strictly typechecked (`tsc --noEmit`).
