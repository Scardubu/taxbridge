import { DuploClient } from './duplo';

describe('Duplo NRS Gateway migration guard', () => {
  let client: DuploClient;

  beforeEach(() => {
    client = new DuploClient();
  });

  it('reports the gateway as unconfigured until approved tenant credentials exist', async () => {
    await expect(client.checkHealth()).resolves.toEqual({
      status: 'unconfigured',
      latency: null,
    });
  });

  it('refuses legacy UBL XML submission rather than calling the obsolete OAuth API', async () => {
    await expect(client.submitEInvoice('<Invoice />')).rejects.toThrow(
      'NRS_GATEWAY_MIGRATION_REQUIRED',
    );
  });

  it('refuses legacy IRN status lookups rather than trusting the obsolete API', async () => {
    await expect(client.getEInvoiceStatus('IRN-UNVERIFIED')).rejects.toThrow(
      'NRS_GATEWAY_MIGRATION_REQUIRED',
    );
  });

  it('does not infer a gateway host from legacy DigiTax or Duplo OAuth variables', () => {
    expect(client.getBaseURL()).toBe('');
  });
});
