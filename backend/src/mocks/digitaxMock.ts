import Fastify from 'fastify';
import crypto from 'crypto';

const server = Fastify({ logger: true });

server.post('/v1/invoices/submit', async (request, reply) => {
  const body: any = request.body || {};
  const invoiceId = String(body.invoiceId || '');
  const ublXml = String(body.ublXml || '');

  const apiKey = String((request.headers['x-api-key'] || request.headers['authorization'] || '') || '').replace(/^Bearer\s+/i, '');
  const ts = String(request.headers['x-timestamp'] || '');
  const sig = String(request.headers['x-signature'] || '');

  // Validate API key if configured in env
  if (process.env.DIGITAX_API_KEY && process.env.DIGITAX_API_KEY !== apiKey) {
    return reply.code(401).send({ status: 'error', message: 'Invalid API key' });
  }

  // Validate signature if secret present
  if (process.env.DIGITAX_HMAC_SECRET) {
    const payload = JSON.stringify({ invoiceId, ublXml, timestamp: ts });
    const expected = crypto.createHmac('sha256', process.env.DIGITAX_HMAC_SECRET).update(payload).digest('hex');
    if (!sig || sig !== expected) {
      return reply.code(400).send({ status: 'rejected', message: 'Invalid signature' });
    }
  }

  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 400));

  const nrsReference = `NRS-LOCAL-${invoiceId.slice(0, 8)}`;
  const csid = `CSID-LOCAL-${Date.now()}`;
  const irn = `IRN-LOCAL-${Date.now()}`;
  const qrCodeData = 'data:image/png;base64,MOCKQRLOCAL';

  return reply.send({ status: 'accepted', nrsReference, csid, irn, qrCodeData });
});

server.get('/v1/invoices/status/:ref', async (request, reply) => {
  const ref = String((request.params as any).ref || '');
  // Always return accepted for mock
  return { status: 'accepted', reference: ref };
});

const port = Number(process.env.DIGITAX_MOCK_PORT || 4000);

server.listen({ port, host: '0.0.0.0' }).then(() => {
  server.log.info(`DigiTax mock running on http://localhost:${port}`);
}).catch((err) => {
  server.log.error({ err }, 'Failed to start DigiTax mock');
  process.exit(1);
});
