# Operation processing contract

## State model
- `pending`: accepted durably; waiting for dispatch.
- `processing`: a worker owns an execution attempt.
- `retry_scheduled`: transient failure; PostgreSQL stores `nextAttemptAt`.
- `acknowledged`: handler confirms the business outcome.
- `dead_letter`: terminal failure; a durable `OperationDeadLetter` row exists.

## Required handler guarantees
Every handler validates its payload/schema version, derives actor and organization from the persisted operation, re-checks resource ownership in the same tenant, uses transactional idempotency, ignores client-supplied identity/approval/status fields, and treats external provider timeouts as ambiguous until reconciled.

## Phase 1C registered operation

The first registered handler is deliberately narrow:
- operation type: `crud`
- action: `EXPENSE_CREATE`
- schema version: `1`
- required payload: business ID, amount, category, description, ISO date, VAT amount and VAT eligibility.

The handler requires the business owner and `Business.organizationId` to match the persisted operation. It writes the expense plus an `operation_effects` receipt in one serializable PostgreSQL transaction. The receipt is unique on `operation_id`; concurrent duplicate execution rolls back the losing transaction and is retried against the committed receipt. The payload cannot choose user, organization, status, approval, or payment state.

Business records are organization-bound on creation. Legacy businesses are backfilled only when the owner has exactly one active organization membership; ambiguous/unmapped rows remain unbound and cannot receive offline writes until explicitly reconciled.

Other CRUD actions and all `sync`, `filing`, and `payment` operations remain unsupported and fail closed. VAT eligibility is required explicitly; this handler does not infer tax treatment.

### Phase 1C.2 invoice draft operation

The CRUD allow-list also accepts `INVOICE_CREATE` at schema version 1. The backend validates line-item arithmetic and requires VAT to be explicitly supplied; it does not infer a tax rate or calculate tax eligibility. It re-checks active membership and business ownership/organization binding, then creates a `draft` invoice and the operation-effect receipt in one serializable transaction.

The handler does not assign an invoice number, stamp or submit to NRS, send an invoice, initiate payment, or mark the invoice as tax compliant. These are separate workflows and remain outside this operation. The mobile offline queue accepts `INVOICE_CREATE` after SQLite schema migration v8. Existing pending rows are preserved by the table rebuild.

Receipt upload/capture is deliberately not registered in this milestone: the current database does not provide a tenant-bound, immutable upload-object registry from which the worker can prove that a supplied storage key belongs to the submitting user and business. A client-provided URL or arbitrary object key is not accepted as receipt evidence. Receipt capture remains blocked until that storage ownership contract is implemented.

## Payment and filing rule
Payment initiation and filing operations must never be automatically replayed after an ambiguous external outcome. Recovery requires explicit authorization and provider reconciliation.

## Release gate
The pipeline is not production-ready until remaining handlers, audited resolution controls, contract compatibility tests, and PostgreSQL-backed end-to-end integration tests pass.
