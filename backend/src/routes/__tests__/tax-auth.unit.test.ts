import Fastify, { type FastifyInstance } from 'fastify';
import taxRoutes from '../tax';

describe('tax calculation route authentication and contracts', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    (app as any).decorate('authenticate', async (request: any, reply: any) => {
      if (request.headers.authorization !== 'Bearer valid-user') {
        return reply.code(401).send({ error: 'UNAUTHORIZED' });
      }
      request.user = { userId: '00000000-0000-4000-8000-000000000001' };
    });
    await app.register(taxRoutes as any);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated tax calculations', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/calculate/pit',
      payload: { grossIncome: 1_000_000 },
    });
    expect(response.statusCode).toBe(401);
  });

  it('executes the explicitly selected calculator with the route-specific schema', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/calculate/cit',
      headers: { authorization: 'Bearer valid-user' },
      payload: { revenue: 10_000_000, expenses: 2_000_000, employeeCount: 5 },
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({ success: true, data: expect.any(Object) }),
    );
  });

  it('does not expose the old non-discriminated generic calculator URL', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tax/calculate',
      headers: { authorization: 'Bearer valid-user' },
      payload: { annual_turnover: 10_000_000 },
    });
    expect(response.statusCode).toBe(404);
  });
});
