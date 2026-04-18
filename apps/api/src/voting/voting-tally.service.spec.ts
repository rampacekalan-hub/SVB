import { Prisma } from '@prisma/client';
import { VotingTallyService } from './voting-tally.service';

/**
 * Testuje legislatívne pravidlá:
 *  1. Listinný hlas má prioritu pred elektronickým.
 *  2. Započítava sa NAJNOVŠÍ elektronický pred closesAt (ak neexistuje listinný).
 *  3. Hlas sa váži podielom bytu (ownershipShare).
 *  4. Kvórum počíta sa zo súčtu hlasujúcich podielov / celkových.
 */

function makeBuilding(apartmentShares: Array<[string, string]>) {
  return {
    apartments: apartmentShares.map(([id, share]) => ({
      id,
      ownershipShare: new Prisma.Decimal(share),
    })),
  };
}

function voteRecord(over: Partial<any>) {
  return {
    id: over.id ?? cryptoId(),
    votingId: over.votingId ?? 'v1',
    apartmentId: over.apartmentId,
    channel: over.channel,
    choice: over.choice,
    castAt: over.castAt,
    electronicSessionHash: null,
    paperBallotReference: null,
    recordedById: null,
    integrityHash: 'x',
    prevHash: null,
  };
}

function cryptoId() {
  return Math.random().toString(36).slice(2);
}

function mockPrisma(voting: any) {
  return {
    voting: {
      findUniqueOrThrow: async () => voting,
    },
  } as any;
}

describe('VotingTallyService', () => {
  const closesAt = new Date('2026-05-01T12:00:00Z');
  const building = makeBuilding([
    ['apt-1', '100'],
    ['apt-2', '100'],
    ['apt-3', '100'],
  ]);

  it('paper has priority over electronic for same apartment', async () => {
    const voting = {
      id: 'v1',
      type: 'SIMPLE_MAJORITY',
      closesAt,
      quorumRequired: new Prisma.Decimal('0.5'),
      building,
      records: [
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-04-30T10:00:00Z'),
        }),
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'PAPER',
          choice: 'NO',
          castAt: new Date('2026-04-29T08:00:00Z'),
        }),
      ],
    };
    const svc = new VotingTallyService(mockPrisma(voting));
    const outcome = await svc.tally('v1');
    expect(outcome.noShares.toString()).toBe('100');
    expect(outcome.yesShares.toString()).toBe('0');
  });

  it('latest electronic vote wins before closesAt', async () => {
    const voting = {
      id: 'v1',
      type: 'SIMPLE_MAJORITY',
      closesAt,
      quorumRequired: new Prisma.Decimal('0.5'),
      building,
      records: [
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-04-29T10:00:00Z'),
        }),
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'NO',
          castAt: new Date('2026-04-30T15:00:00Z'),
        }),
      ],
    };
    const svc = new VotingTallyService(mockPrisma(voting));
    const outcome = await svc.tally('v1');
    expect(outcome.noShares.toString()).toBe('100');
    expect(outcome.yesShares.toString()).toBe('0');
  });

  it('ignores electronic records cast after closesAt', async () => {
    const voting = {
      id: 'v1',
      type: 'SIMPLE_MAJORITY',
      closesAt,
      quorumRequired: new Prisma.Decimal('0.5'),
      building,
      records: [
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-05-02T10:00:00Z'),
        }),
      ],
    };
    const svc = new VotingTallyService(mockPrisma(voting));
    const outcome = await svc.tally('v1');
    expect(outcome.yesShares.toString()).toBe('0');
    expect(outcome.totalShares.toString()).toBe('0');
  });

  it('quorum computed from shares ratio', async () => {
    const voting = {
      id: 'v1',
      type: 'SIMPLE_MAJORITY',
      closesAt,
      quorumRequired: new Prisma.Decimal('0.5'),
      building,
      records: [
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-04-30T10:00:00Z'),
        }),
      ],
    };
    const svc = new VotingTallyService(mockPrisma(voting));
    const outcome = await svc.tally('v1');
    // 100 / 300 = 0.333 < 0.5 kvórum
    expect(outcome.quorumReached).toBe(false);
    expect(outcome.accepted).toBe(false);
  });

  it('qualified majority needs >= 2/3 of cast shares', async () => {
    const voting = {
      id: 'v1',
      type: 'QUALIFIED_MAJORITY',
      closesAt,
      quorumRequired: new Prisma.Decimal('0.5'),
      building,
      records: [
        voteRecord({
          apartmentId: 'apt-1',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-04-30T10:00:00Z'),
        }),
        voteRecord({
          apartmentId: 'apt-2',
          channel: 'ELECTRONIC',
          choice: 'YES',
          castAt: new Date('2026-04-30T10:00:00Z'),
        }),
        voteRecord({
          apartmentId: 'apt-3',
          channel: 'ELECTRONIC',
          choice: 'NO',
          castAt: new Date('2026-04-30T10:00:00Z'),
        }),
      ],
    };
    const svc = new VotingTallyService(mockPrisma(voting));
    const outcome = await svc.tally('v1');
    expect(outcome.quorumReached).toBe(true);
    // 200/300 = 0.666… => >= 2/3
    expect(outcome.accepted).toBe(true);
  });
});
