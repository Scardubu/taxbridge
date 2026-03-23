export function normalizeNigeriaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+234') && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  return raw;
}

export async function requestOTP(raw: string) {
  const { apiRequest } = await import('./api');
  return apiRequest<{ success: boolean; message: string }>('/api/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizeNigeriaPhone(raw) }),
  });
}

export async function verifyOTP(raw: string, code: string): Promise<boolean> {
  const { apiRequest } = await import('./api');
  const response = await apiRequest<{ valid: boolean }>('/api/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizeNigeriaPhone(raw), code }),
  });
  return response.valid;
}
