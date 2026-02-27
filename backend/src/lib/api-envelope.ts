/**
 * TaxBridge — API v2 Response Envelope
 *
 * All /api/v2 endpoints use this standard envelope.
 * Provides consistent structure for mobile and admin consumers.
 */

export interface ApiResponse<T = unknown> {
  success:    boolean;
  data:       T | null;
  error:      string | null;
  code?:      string;
  meta?: {
    requestId?:    string;
    timestamp:     string;
    version:       string;
    deprecation?:  string;
    fromCache?:    boolean;
  };
}

/**
 * Build a success response envelope.
 */
export function successResponse<T>(
  data: T,
  meta?: Partial<ApiResponse['meta']>,
): ApiResponse<T> {
  return {
    success: true,
    data,
    error:   null,
    meta: {
      timestamp: new Date().toISOString(),
      version:   'v2',
      ...meta,
    },
  };
}

/**
 * Build an error response envelope.
 */
export function errorResponse(
  error: string,
  code?: string,
  meta?: Partial<ApiResponse['meta']>,
): ApiResponse<null> {
  return {
    success: false,
    data:    null,
    error,
    code,
    meta: {
      timestamp: new Date().toISOString(),
      version:   'v2',
      ...meta,
    },
  };
}
