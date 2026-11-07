import { resolveDigiTaxMockMode } from '../integrations/digitax/mockMode';

describe('resolveDigiTaxMockMode', () => {
  test('defaults to real submissions in production when the flag is unset', () => {
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'production' })).toBe(false);
  });

  test('defaults to mock mode outside production when the flag is unset', () => {
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'test' })).toBe(true);
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'development' })).toBe(true);
  });

  test('honours an explicit true or false override', () => {
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'production', DIGITAX_MOCK_MODE: 'true' })).toBe(true);
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'development', DIGITAX_MOCK_MODE: 'false' })).toBe(false);
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'production', DIGITAX_MOCK_MODE: ' FALSE ' })).toBe(false);
  });

  test('does not interpret an invalid flag as permission to mock', () => {
    expect(resolveDigiTaxMockMode({ NODE_ENV: 'production', DIGITAX_MOCK_MODE: 'enabled' })).toBe(false);
  });
});
