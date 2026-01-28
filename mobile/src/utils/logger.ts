/**
 * Simple logger utility for mobile app
 * Provides structured logging with context tags
 */

export interface Logger {
  info: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
}

/**
 * Create a logger instance with a specific context tag
 * @param context - Context identifier (e.g., 'device-sync', 'sync-context')
 * @returns Logger instance
 */
export function createLogger(context: string): Logger {
  const isDev = __DEV__;

  function formatMessage(level: string, message: string, meta?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${context}] ${message}${metaStr}`;
  }

  return {
    info: (message: string, meta?: Record<string, any>) => {
      if (isDev) {
        console.log(formatMessage('INFO', message, meta));
      }
    },
    warn: (message: string, meta?: Record<string, any>) => {
      console.warn(formatMessage('WARN', message, meta));
    },
    error: (message: string, meta?: Record<string, any>) => {
      console.error(formatMessage('ERROR', message, meta));
    },
    debug: (message: string, meta?: Record<string, any>) => {
      if (isDev) {
        console.debug(formatMessage('DEBUG', message, meta));
      }
    }
  };
}
