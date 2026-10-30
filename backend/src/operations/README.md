# Operation processing contract

## State model
- `pending`: accepted durably; waiting for dispatch.
- `processing`: a worker owns an execution attempt.
- `retry_scheduled`: transient failure; PostgreSQL stores `nextAttemptAt`.
- `acknowledged`: handler confirms the business outcome.
- `dead_letter`: terminal failure; a durable `OperationDeadLetter` row exists.

## Required handler guarantees
Every registered handler must:
1. Validate payload by operation type and schema version.
2. Re-check the organization and resource ownership using server-side records.
3. Use the operation idempotency key in the domain transaction.
4. Never trust user/device/org IDs from the payload.
5. For external effects, persist provider intent/reference before or atomically with dispatch where possible.
6. Use provider idempotency keys where supported.
7. Treat timeouts after provider submission as unknown and reconcile before another submission.
8. Throw `OperationFailure` with `retryable=true` only for transient errors where repeating the handler is safe.
9. Throw non-retryable `OperationFailure` for validation, authorization, unsupported, and terminal business errors.
10. Never convert ambiguous payment or filing outcomes into success.

## Retry policy
The approved policy is eight automatic attempts, 2-second base delay, exponential backoff, full jitter, 15-minute cap, and 24-hour operation deadline. The retry counter and deadline live in PostgreSQL. BullMQ is a transport, not the retry authority.

## Payment and filing rule
After an operation enters `dead_letter`, it is never automatically enqueued again. Recovery requires explicit authorization and provider reconciliation. Do not implement an admin "retry" button that simply requeues a payment or filing.

## Important implementation note
This overlay does not include concrete domain handlers. Registering a handler is a security-sensitive act and requires reviewing the corresponding domain service and external-provider behavior. Until those handlers, an audited manual resolution endpoint, and end-to-end tests are present, this operation pipeline is not ready for production traffic.
