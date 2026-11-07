type MockModeEnvironment = {
  NODE_ENV?: string;
  DIGITAX_MOCK_MODE?: string;
};

/**
 * Resolve DigiTax mock mode without ever defaulting production to synthetic
 * stamping. An explicit configuration wins; an unset/blank value defaults
 * to mock outside production and real mode in production.
 */
export function resolveDigiTaxMockMode(
  environment: MockModeEnvironment = process.env,
): boolean {
  const configured = environment.DIGITAX_MOCK_MODE?.trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return environment.NODE_ENV !== 'production';
}
