import { registerOperationHandler } from './registry';
import { handleCrudOperation } from './handlers/crud';

let registered = false;
export function registerBuiltinOperationHandlers(): void {
  if (registered) return;
  registerOperationHandler('crud', handleCrudOperation);
  registered = true;
}
