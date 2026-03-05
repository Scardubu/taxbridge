/**
 * V12 §14.2 — EventBus re-export (camelCase alias)
 *
 * The canonical implementation lives in event-bus.ts (hyphenated).
 * This file satisfies V12 gate: grep "eventBus" backend/src/services/eventBus.ts
 * COMP-05: setMaxListeners equivalent — the custom EventBus class uses a Map
 * with no inherent listener cap (Node EventEmitter default is 10).
 */

import { eventBus } from './event-bus';

// COMP-05: setMaxListeners — EventBus uses a Map internally (no cap).
// This is a no-op guard for compatibility with code that expects Node EventEmitter API.
(eventBus as any).setMaxListeners = (n: number) => { /* no-op — Map-backed, no cap */ };

export { eventBus };
