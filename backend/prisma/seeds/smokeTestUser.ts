import bcrypt from 'bcryptjs';
import { prisma } from '../../src/lib/prisma';

const OWNER_EMAIL = 'smoke.owner@taxbridge.ng';
const ADMIN_EMAIL = 'smoke.admin@taxbridge.ng';
const PASSWORD = 'SmokeTest123!';
const ORG_TIN = '19990000-0001';
const ORG_CAC = 'RC-199900';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    process.stderr.write('Refusing to seed smoke test users in production\n');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const smokeTestUser = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {
      name: 'Smoke Test Owner',
      phone: '+2348000000001',
      role: 'OWNER',
      passwordHash,
      verified: true,
      deleted: false,
    },
    create: {
      email: OWNER_EMAIL,
      name: 'Smoke Test Owner',
      phone: '+2348000000001',
      role: 'OWNER',
      passwordHash,
      verified: true,
      deleted: false,
    },
  });

  const smokeTestAdminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: 'Smoke Test Admin',
      phone: '+2348000000002',
      role: 'ADMIN',
      passwordHash,
      verified: true,
      deleted: false,
    },
    create: {
      email: ADMIN_EMAIL,
      name: 'Smoke Test Admin',
      phone: '+2348000000002',
      role: 'ADMIN',
      passwordHash,
      verified: true,
      deleted: false,
    },
  });

  const acmeOrg = await prisma.business.upsert({
    where: { cacNumber: ORG_CAC },
    update: {
      ownerId: smokeTestUser.id,
      name: 'Acme Ltd',
      tin: ORG_TIN,
      email: 'owner@acmeltd.ng',
      phone: '+2348000000010',
      addressStreet: '1 Marina Road',
      addressCity: 'Lagos',
      addressState: 'Lagos',
      addressZipCode: '100001',
      status: 'ACTIVE',
      tinVerified: true,
      cacVerified: true,
    },
    create: {
      ownerId: smokeTestUser.id,
      name: 'Acme Ltd',
      cacNumber: ORG_CAC,
      tin: ORG_TIN,
      email: 'owner@acmeltd.ng',
      phone: '+2348000000010',
      addressStreet: '1 Marina Road',
      addressCity: 'Lagos',
      addressState: 'Lagos',
      addressZipCode: '100001',
      businessType: 'LIMITED_COMPANY',
      status: 'ACTIVE',
      tinVerified: true,
      cacVerified: true,
      verifiedAt: new Date(),
    },
  });

  const authOrg = await (prisma as any).org.upsert({
    where: { id: acmeOrg.id },
    update: {
      name: acmeOrg.name,
      tin: acmeOrg.tin,
      cacNumber: acmeOrg.cacNumber,
      status: 'active',
    },
    create: {
      id: acmeOrg.id,
      name: acmeOrg.name,
      tin: acmeOrg.tin,
      cacNumber: acmeOrg.cacNumber,
      status: 'active',
    },
  });

  await (prisma as any).orgMember.upsert({
    where: { orgId_userId: { orgId: authOrg.id, userId: smokeTestUser.id } },
    update: {
      role: 'OWNER',
      removedAt: null,
    },
    create: {
      orgId: authOrg.id,
      userId: smokeTestUser.id,
      role: 'OWNER',
    },
  });

  await (prisma as any).orgMember.upsert({
    where: { orgId_userId: { orgId: authOrg.id, userId: smokeTestAdminUser.id } },
    update: {
      role: 'ADMIN',
      removedAt: null,
    },
    create: {
      orgId: authOrg.id,
      userId: smokeTestAdminUser.id,
      role: 'ADMIN',
    },
  });

  process.stdout.write(`smokeTestUser=${smokeTestUser.email}\n`);
  process.stdout.write(`smokeTestAdminUser=${smokeTestAdminUser.email}\n`);
  process.stdout.write(`acmeOrg=${acmeOrg.name}\n`);
  process.stdout.write(`authOrg=${authOrg.name}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
