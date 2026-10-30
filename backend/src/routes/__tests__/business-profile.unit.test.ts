import Fastify, { type FastifyInstance } from 'fastify';

const mockBusiness = {
  id: 'business-1',
  ownerId: 'user-a',
  name: 'Old Business',
  tradingName: null,
  cacNumber: null,
  tin: '12345678',
  bvn: null,
  email: 'old@example.com',
  phone: '08000000000',
  addressStreet: null,
  addressCity: null,
  addressState: null,
  addressZipCode: null,
  addressLga: null,
  sector: null,
  annualTurnover: null,
  monthlyRevenue: null,
  totalFixedAssets: null,
  employeeCount: 0,
  isVatRegistered: false,
  vatNumber: null,
  businessType: 'SOLE_PROPRIETOR',
  status: 'PENDING',
  tinVerified: false,
  bvnVerified: false,
  cacVerified: false,
  verifiedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const mockPrisma = {
  business: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLog: { create: jest.fn() },
};

jest.mock('../../integrations/youverify/service', () => ({
  youverifyService: { verifyBusiness: jest.fn() },
}));

import businessRoutes from '../business';

describe('Business profile persistence contract', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.business.findFirst.mockResolvedValue({ ...mockBusiness });
    mockPrisma.business.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...mockBusiness,
      ...data,
    }));
    mockPrisma.business.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...mockBusiness,
      ...data,
      updatedAt: new Date('2026-10-30T12:00:00.000Z'),
    }));
    mockPrisma.auditLog.create.mockResolvedValue({});
    app = Fastify({ logger: false });
    (app as any).decorate('resolveOrgContext', async (request: any) => {
      request.orgContext = { orgId: 'org-a' };
    });
    (app as any).decorate('authenticate', async (request: any, reply: any) => {
      const authorization = request.headers.authorization;
      if (authorization !== 'Bearer user-a') return reply.code(401).send({ error: 'UNAUTHORIZED' });
      request.user = { userId: 'user-a', orgId: 'org-a', role: 'OWNER', roleVersion: 0 };
    });
    await app.register(businessRoutes as any, { prisma: mockPrisma as any });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('persists the complete supported mobile business profile', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/business/profile',
      headers: { authorization: 'Bearer user-a' },
      payload: {
        businessName: 'New Business',
        tradingName: 'Trading Name',
        tin: '12345678',
        rcNumber: 'RC123456',
        sector: 'Technology',
        businessType: 'limited_company',
        annualTurnover: 45_000_000,
        monthlyRevenue: 3_500_000,
        totalFixedAssets: 12_000_000,
        employeeCount: 8,
        isVatRegistered: true,
        vatNumber: 'VAT-123',
        lga: 'Ikeja',
        state: 'Lagos',
        phone: '08011112222',
        email: 'new@example.com',
        hasValidTIN: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.business.update).toHaveBeenCalledWith({
      where: { id: 'business-1' },
      data: {
        name: 'New Business',
        tradingName: 'Trading Name',
        cacNumber: 'RC123456',
        sector: 'Technology',
        annualTurnover: 45_000_000,
        monthlyRevenue: 3_500_000,
        totalFixedAssets: 12_000_000,
        employeeCount: 8,
        isVatRegistered: true,
        vatNumber: 'VAT-123',
        addressLga: 'Ikeja',
        addressState: 'Lagos',
        phone: '08011112222',
        email: 'new@example.com',
        businessType: 'LIMITED_COMPANY',
      },
    });
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.hasValidTIN).toBe(false);
    expect(body.data.annualTurnover).toBe(45_000_000);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('creates a business with the full profile when no server business exists', async () => {
    mockPrisma.business.findFirst.mockResolvedValue(null);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/business',
      headers: { authorization: 'Bearer user-a' },
      payload: {
        name: 'New Business',
        rcNumber: 'RC123456',
        tin: '12345678',
        tradingName: 'Trading Name',
        sector: 'Technology',
        annualTurnover: 45_000_000,
        monthlyRevenue: 3_500_000,
        totalFixedAssets: 12_000_000,
        employeeCount: 8,
        isVatRegistered: true,
        vatNumber: 'VAT-123',
        businessType: 'limited_company',
        address: { state: 'Lagos', lga: 'Ikeja' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockPrisma.business.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: 'user-a',
        organizationId: 'org-a',
        cacNumber: 'RC123456',
        tradingName: 'Trading Name',
        sector: 'Technology',
        annualTurnover: 45_000_000,
        employeeCount: 8,
        isVatRegistered: true,
        addressLga: 'Ikeja',
        businessType: 'LIMITED_COMPANY',
      }),
    });
  });

  it('does not accept a client assertion of TIN verification', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/business/profile',
      headers: { authorization: 'Bearer user-a' },
      payload: { hasValidTIN: true },
    });
    expect(response.statusCode).toBe(400);
    expect(mockPrisma.business.update).not.toHaveBeenCalled();
  });

  it('resets verification when the TIN or CAC value actually changes', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/v1/business/profile',
      headers: { authorization: 'Bearer user-a' },
      payload: { tin: '87654321', rcNumber: 'RC999999' },
    });

    expect(mockPrisma.business.update).toHaveBeenCalledWith({
      where: { id: 'business-1' },
      data: {
        tin: '87654321',
        cacNumber: 'RC999999',
        tinVerified: false,
        cacVerified: false,
        status: 'PENDING',
        verifiedAt: null,
      },
    });
  });
});
