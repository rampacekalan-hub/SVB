import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Floory...');

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
    where: { email: 'predseda@floory.local' },
    update: {},
    create: {
      email: 'predseda@floory.local',
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
    where: { email: 'vlastnik@floory.local' },
    update: {},
    create: {
      email: 'vlastnik@floory.local',
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

  // --- Demo hlasovanie (OPEN)
  const existingVoting = await prisma.voting.findFirst({
    where: { buildingId: building.id, title: 'Rekonštrukcia strechy 2026' },
  });
  if (!existingVoting) {
    await prisma.voting.create({
      data: {
        buildingId: building.id,
        title: 'Rekonštrukcia strechy 2026',
        description:
          'Návrh výmeny krytiny a zateplenia strechy. Odhadovaný náklad 28 000 € hradený z fondu opráv.',
        type: 'QUALIFIED_MAJORITY',
        status: 'OPEN',
        opensAt: new Date(Date.now() - 2 * 86400_000),
        closesAt: new Date(Date.now() + 7 * 86400_000),
        quorumRequired: '0.5001',
      },
    });
  }

  // --- Demo oznam (nástenka)
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { buildingId: building.id, title: 'Odstávka vody v stredu' },
  });
  const announcement =
    existingAnnouncement ??
    (await prisma.announcement.create({
      data: {
        buildingId: building.id,
        authorId: chairman.id,
        title: 'Odstávka vody v stredu',
        body:
          'V stredu od 08:00 do 14:00 bude odstavená studená voda. Dôvod: výmena hlavného uzáveru na stúpačke.',
        severity: 'WARNING',
      },
    }));
  // Doručenie všetkým členom budovy
  for (const user of [owner, chairman]) {
    await prisma.notificationReceipt.upsert({
      where: {
        announcementId_userId: { announcementId: announcement.id, userId: user.id },
      },
      update: {},
      create: { announcementId: announcement.id, userId: user.id },
    });
  }

  // --- Demo porucha
  const existingTicket = await prisma.ticket.findFirst({
    where: { buildingId: building.id, title: 'Nefunkčné svetlo v pivnici' },
  });
  if (!existingTicket) {
    await prisma.ticket.create({
      data: {
        buildingId: building.id,
        apartmentId: apartments[1].id,
        creatorId: owner.id,
        title: 'Nefunkčné svetlo v pivnici',
        description: 'Svetlo na chodbe v pivnici nesvieti. Pohybové čidlo pravdepodobne nefunguje.',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
      },
    });
  }

  // --- Demo faktúry pre vlastníka bytu 02 (peter)
  const invoiceData = [
    {
      number: '2026-02-0002',
      apartmentId: apartments[1].id,
      buildingId: building.id,
      category: 'SERVICES' as const,
      period: '2026-02',
      amount: '124.50',
      dueDate: new Date('2026-02-15'),
      status: 'PAID' as const,
      note: 'Zálohy na teplo, vodu a spoločnú elektrinu — február.',
    },
    {
      number: '2026-03-0002',
      apartmentId: apartments[1].id,
      buildingId: building.id,
      category: 'SERVICES' as const,
      period: '2026-03',
      amount: '124.50',
      dueDate: new Date('2026-03-15'),
      status: 'PAID' as const,
    },
    {
      number: '2026-04-0002',
      apartmentId: apartments[1].id,
      buildingId: building.id,
      category: 'SERVICES' as const,
      period: '2026-04',
      amount: '124.50',
      dueDate: new Date('2026-04-15'),
      status: 'DUE' as const,
    },
    {
      number: '2026-04-FO-0002',
      apartmentId: apartments[1].id,
      buildingId: building.id,
      category: 'MAINTENANCE_FUND' as const,
      period: '2026-04',
      amount: '45.00',
      dueDate: new Date('2026-04-15'),
      status: 'DUE' as const,
      note: 'Fond opráv — apríl.',
    },
  ];
  for (const inv of invoiceData) {
    const exists = await prisma.invoice.findUnique({
      where: { buildingId_number: { buildingId: inv.buildingId, number: inv.number } },
    });
    if (exists) continue;
    const created = await prisma.invoice.create({ data: inv });
    if (inv.status === 'PAID') {
      await prisma.payment.create({
        data: {
          apartmentId: inv.apartmentId,
          invoiceId: created.id,
          amount: inv.amount,
          paidAt: new Date(inv.dueDate.getTime() - 3 * 86400_000),
          source: 'BANK_IMPORT',
        },
      });
    }
  }

  // --- Demo schôdza
  const meetingExists = await prisma.meeting.findFirst({
    where: { buildingId: building.id, title: 'Výročné zhromaždenie vlastníkov 2026' },
  });
  if (!meetingExists) {
    await prisma.meeting.create({
      data: {
        buildingId: building.id,
        createdById: chairman.id,
        title: 'Výročné zhromaždenie vlastníkov 2026',
        scheduledAt: new Date(Date.now() + 14 * 86400_000),
        location: 'Spoločná miestnosť, prízemie',
        agenda:
          '1) Otvorenie a zistenie uznášaniaschopnosti\n' +
          '2) Schválenie účtovnej závierky 2025\n' +
          '3) Plán opráv 2026 (strecha, výmena vchodových dverí)\n' +
          '4) Hlasovanie o úvere zo ŠFRB na zateplenie\n' +
          '5) Rôzne',
        status: 'SCHEDULED',
      },
    });
  }

  // --- Druhá budova — aby sa dal demonštrovať Manager shell + building switcher
  const building2 = await prisma.building.upsert({
    where: { id: 'b0000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: 'b0000000-0000-0000-0000-000000000002',
      name: 'Bytový dom Obchodná 3',
      address: 'Obchodná 3',
      city: 'Bratislava',
      zip: '81101',
      country: 'SK',
      legalForm: 'BD',
      totalShares: '24000.000000',
    },
  });
  // 4 byty v druhej budove
  const apts2: any[] = [];
  for (let i = 1; i <= 4; i++) {
    const unit = String(i).padStart(2, '0');
    const apt = await prisma.apartment.upsert({
      where: { buildingId_unitNumber: { buildingId: building2.id, unitNumber: unit } },
      update: {},
      create: {
        buildingId: building2.id,
        unitNumber: unit,
        floor: Math.ceil(i / 2),
        area: '72.00',
        ownershipShare: String(24000 / 4),
      },
    });
    apts2.push(apt);
  }
  // Predseda je správca aj tejto budovy (MANAGER role)
  await prisma.membership.upsert({
    where: {
      userId_buildingId_apartmentId_role: {
        userId: chairman.id,
        buildingId: building2.id,
        apartmentId: apts2[0].id,
        role: 'MANAGER',
      },
    },
    update: {},
    create: {
      userId: chairman.id,
      buildingId: building2.id,
      apartmentId: apts2[0].id,
      role: 'MANAGER',
      verifiedAt: new Date(),
    },
  });

  console.log('Seed hotovo.');
  console.log('Login pre testovanie:');
  console.log('  predseda@floory.local / DemoHeslo12345!');
  console.log('  vlastnik@floory.local / DemoHeslo12345!');
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
