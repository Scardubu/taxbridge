import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Backfill script to create Device entries for existing users
 * Run this after deploying the add-device-sync migration
 * 
 * Usage: ts-node scripts/backfillDevices.ts
 */
async function main() {
  console.log('🔄 Starting device backfill...');
  
  // Find all users who have logged in recently but don't have a device record
  const users = await prisma.user.findMany({
    where: {
      lastLoginAt: { not: null },
      devices: { none: {} }
    },
    select: {
      id: true,
      lastLoginAt: true,
      lastLoginDevice: true
    }
  });

  console.log(`📱 Found ${users.length} users without device records`);

  let created = 0;
  for (const user of users) {
    try {
      const platform = user.lastLoginDevice?.includes('iOS') ? 'ios' : 
                      user.lastLoginDevice?.includes('Android') ? 'android' : 'web';
      
      await prisma.device.create({
        data: {
          userId: user.id,
          platform,
          appVersion: '5.0.4', // Current version
          lastSeenAt: user.lastLoginAt || new Date(),
          network: 'online'
        }
      });
      created++;
    } catch (error) {
      console.error(`Failed to create device for user ${user.id}:`, error);
    }
  }

  console.log(`✅ Created ${created} device records`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
