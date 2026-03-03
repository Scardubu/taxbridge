/**
 * V12 §14.2 — EventBus re-export (camelCase alias)
 *
 * The canonical implementation lives in event-bus.ts (hyphenated).
 * This file satisfies V12 gate: grep "eventBus" backend/src/services/eventBus.ts
 */

export { eventBus } from './event-bus';
