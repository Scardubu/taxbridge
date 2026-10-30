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

## Payment and filing rule
Payment initiation and filing operations must never be automatically replayed after an ambiguous external outcome. Recovery requires explicit authorization and provider reconciliation.

## Release gate
The pipeline is not production-ready until remaining handlers, audited resolution controls, contract compatibility tests, and PostgreSQL-backed end-to-end integration tests pass.
