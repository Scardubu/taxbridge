// Jest mock for @sentry/react-native
// Prevents native module initialisation errors (hasViewManagerConfig) in Jest environment

const noop = () => undefined;
const noopPromise = () => Promise.resolve();

module.exports = {
  init: noop,
  captureException: noop,
  captureMessage: noop,
  captureEvent: noop,
  addBreadcrumb: noop,
  configureScope: noop,
  withScope: (cb) => cb({ setTag: noop, setExtra: noop, setUser: noop, setLevel: noop }),
  setUser: noop,
  setTag: noop,
  setExtra: noop,
  setContext: noop,
  setLevel: noop,
  startTransaction: () => ({ finish: noop, setTag: noop, setData: noop }),
  getCurrentHub: () => ({
    getClient: () => null,
    getScope: () => ({ getUser: () => null }),
    addBreadcrumb: noop,
    captureException: noop,
  }),
  withErrorBoundary: (Component) => Component,
  ErrorBoundary: ({ children }) => children,
  wrap: (Component) => Component,
  Severity: { Info: 'info', Warning: 'warning', Error: 'error', Fatal: 'fatal' },
  flush: noopPromise,
  close: noopPromise,
  lastEventId: () => undefined,
  isInitialized: () => false,
  defaultStackParser: () => [],
};
