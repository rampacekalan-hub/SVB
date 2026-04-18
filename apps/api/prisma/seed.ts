import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DomovPlus...');

  const passwordHash = await argon2.hash('DemoHeslo12345!');

  // --- Demo budova v Bratislave
  const building = await prisma.building.upsert({
    where: { id: 'b0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Bytový dom Hviezdoslavova 12',
      address: 'Hviezdoslavova 12',
      city: 'Bratislava',
      zip: '81102',
      country: 'SK',
      legalForm: 'SVB',
      totalShares: '10000.000000',
    },
  });

  // --- Byty (každý s podielom)
  const apartments = [];
  for (let i = 1; i <= 6; i++) {
    const unit = String(i).padStart(2, '0');
    const apt = await prisma.apartment.upsert({
      where: { buildingId_unitNumber: { buildingId: building.id, unitNumber: unit } },
      update: {},
      create: {
        buildingId: building.id,
        unitNumber: unit,
        floor: Math.ceil(i / 2),
        area: '65.50',
        ownershipShare: String(10000 / 6),
      },
    });
    apartments.push(apt);
  }

  // --- Používatelia
  const chairman = await prisma.user.upsert({
    where: { email: 'predseda@domovplus.local' },
    update: {},
    create: {
      email: 'predseda@domovplus.local',
      passwordHash,
      firstName: 'Jana',
      lastName: 'Predsedová',
      locale: 'SK',
      emailVerified: true,
    },
  });
  await prisma.membership.upsert({
    where: {
      userId_buildingId_apartmentId_role: {
        userId: chairman.id,
        buildingId: building.id,
        apartmentId: apartments[0].id,
        role: 'CHAIRMAN',
      },
    },
    update: {},
    create: {
      userId: chairman.id,
      buildingId: building.id,
      apartmentId: apartments[0].id,
      role: 'CHAIRMAN',
      verifiedAt: new Date(),
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'vlastnik@domovplus.local' },
    update: {},
    create: {
      email: 'vlastnik@domovplus.local',
      passwordHash,
      firstName: 'Peter',
      lastName: 'Vlastník',
      locale: 'SK',
      emailVerified: true,
    },
  });
  await prisma.membership.upsert({
    where: {
      userId_buildingId_apartmentId_role: {
        userId: owner.id,
        buildingId: building.id,
        apartmentId: apartments[1].id,
        role: 'OWNER',
      },
    },
    update: {},
    create: {
      userId: owner.id,
      buildingId: building.id,
      apartmentId: apartments[1].id,
      role: 'OWNER',
      verifiedAt: new Date(),
    },
  });

  // --- Aktivačný kód pre byt 03
  await prisma.membership.upsert({
    where: { activationCode: 'DEMO-ACT-003' },
    update: {},
    create: {
      buildingId: building.id,
      apartmentId: apartments[2].id,
      role: 'OWNER',
      activationCode: 'DEMO-ACT-003',
    },
  });

  // --- PV meter na streche
  await prisma.meter.upsert({
    where: { serialNumber: 'PV-ROOF-001' },
    update: {},
    create: {
      buildingId: building.id,
      type: 'PV_PRODUCTION',
      serialNumber: 'PV-ROOF-001',
      label: 'Strešná FVE 10 kWp',
      installedAt: new Date(),
    },
  });

  console.log('Seed hotovo.');
  console.log('Login pre testovanie:');
  console.log('  predseda@domovplus.local / DemoHeslo12345!');
  console.log('  vlastnik@domovplus.local / DemoHeslo12345!');
  console.log('Aktivačný kód pre registráciu bytu 03: DEMO-ACT-003');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
