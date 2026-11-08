import { DuploClient } from '../integrations/duplo';

describe('Duplo NRS Gateway migration boundary', () => {
  const client = new DuploClient();

  afterEach(() => {
    delete process.env.DUPLO_GATEWAY_URL;
  });

  test('does not claim gateway health before approved provisioning', async () => {
    await expect(client.checkHealth()).resolves.toEqual({
      status: 'unconfigured',
      latency: null,
    });
  });

  test('does not expose a legacy provider URL as the approved gateway URL', () => {
    expect(client.getBaseURL()).toBe('');
  });

  test('rejects legacy UBL submission instead of reporting a false NRS stamp', async () => {
    await expect(client.submitEInvoice('<Invoice/>')).rejects.toThrow(
      'NRS_GATEWAY_MIGRATION_REQUIRED',
    );
  });

  test('rejects legacy status lookups until the NRS Gateway adapter is implemented', async () => {
    await expect(client.getEInvoiceStatus('IRN-TEST')).rejects.toThrow(
      'NRS_GATEWAY_MIGRATION_REQUIRED',
    );
  });
});
