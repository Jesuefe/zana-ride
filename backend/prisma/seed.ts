import { PrismaClient, UserRole, DriverApprovalStatus, DriverOnlineStatus, ServiceType } from '@prisma/client';

const prisma = new PrismaClient();

// Kigali city center — matches KIGALI_CENTER used across the mobile apps.
const KIGALI_LAT = -1.9536;
const KIGALI_LNG = 30.0605;

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: '+250700000001' },
    update: {},
    create: {
      phone: '+250700000001',
      firstName: 'Ops',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      wallet: { create: { balance: 0 } },
    },
  });

  const merchantUser = await prisma.user.upsert({
    where: { phone: '+250700000002' },
    update: {},
    create: {
      phone: '+250700000002',
      firstName: 'Kigali',
      lastName: 'Fresh Grocers',
      role: UserRole.MERCHANT,
      wallet: { create: { balance: 50000 } },
      merchant: { create: { businessName: 'Kigali Fresh Grocers', branch: 'Kimihurura Branch' } },
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { phone: '+250700000003' },
    update: {},
    create: {
      phone: '+250700000003',
      firstName: 'Eric',
      lastName: 'Niyonzima',
      role: UserRole.DRIVER,
      wallet: { create: { balance: 0 } },
      driver: {
        create: {
          vehicle: 'TVS Motorcycle - Black',
          plate: 'RAD 412 B',
          serviceType: ServiceType.BIKE,
          approvalStatus: DriverApprovalStatus.APPROVED,
          onlineStatus: DriverOnlineStatus.ONLINE,
          lastLat: KIGALI_LAT,
          lastLng: KIGALI_LNG,
          lastLocationAt: new Date(),
        },
      },
    },
  });

  console.log('Seeded demo accounts:');
  console.log('  Admin    ->', admin.phone);
  console.log('  Merchant ->', merchantUser.phone);
  console.log('  Driver   ->', driverUser.phone, '(approved + online, ready to match)');
  console.log('\nRequest an OTP for any of these numbers via /auth/request-otp, then check');
  console.log('the container logs for the code, same as before.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
